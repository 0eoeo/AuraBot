const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleInteraction } = require('./core/messageHandler');
const { handleTextMessage } = require('./core/textHandler');
const { getGuildState } = require('./core/voiceManager');
const { startVoiceCoinsTask } = require('./core/characterHandler');
const express = require('express');
require('dotenv').config({ path: '../.env' });

const GUILD_ID = process.env.GUILD_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('❌ Убедись, что BOT_TOKEN и GUILD_ID заданы в .env');
  process.exit(1);
}

// 🌐 HTTP-сервер для проверки работоспособности
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`🌐 HTTP server listening on port ${PORT}`));

// 🤖 Клиент Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
  startVoiceCoinsTask(client, GUILD_ID);
});

// 💬 Обработка текстовых сообщений
client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.name !== 'бот') return;

  const state = getGuildState(message.guild.id) || {};
  const { playbackQueue = [], isPlaying = false, playNext = () => {} } = state;

  const wrappedPlayNext = () => {
    state.isPlaying = true;
    playNext();
  };

  handleTextMessage(message, playbackQueue, isPlaying, wrappedPlayNext);
});

// ⚙️ Обработка slash-команд
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply({ ephemeral: true });
    await handleInteraction(interaction);
  } catch (error) {
    console.error('❌ Ошибка при выполнении команды:', error);

    try {
      const errorMsg = { content: 'Произошла ошибка при выполнении команды.' };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    } catch (followUpError) {
      console.error('⚠️ Ошибка при отправке follow-up:', followUpError);
    }
  }
});

client.login(BOT_TOKEN);