const { Client, GatewayIntentBits } = require('discord.js');
const { handleInteraction } = require('./core/messageHandler');
const { handleTextMessage } = require('./core/textHandler');
const { getGuildState } = require('./core/voiceManager');
const { startVoiceCoinsTask } = require('./core/characterHandler');
const express = require('express');
require('dotenv').config({ path: '../.env' });

const GUILD_ID = process.env.GUILD_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, () => {
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🔊 Logged in как ${client.user.tag}`);
  startVoiceCoinsTask(client, GUILD_ID);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.name === 'бот') {
    const state = getGuildState(message.guild.id);
    const { playbackQueue = [], isPlaying = false, playNext = () => {} } = state || {};

    const wrappedPlayNext = () => {
      if (state) {
        state.isPlaying = true;
        playNext();
      }
    };

    handleTextMessage(message, playbackQueue, isPlaying, wrappedPlayNext);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply({ ephemeral: true });
    await handleInteraction(interaction);
  } catch (error) {
    console.error('❌ Ошибка обработки команды:', error);

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Произошла ошибка при выполнении команды.' });
      } else {
        await interaction.reply({ content: 'Произошла ошибка при выполнении команды.' });
      }
    } catch (replyError) {
      console.error('⚠️ Ошибка при отправке follow-up:', replyError);
    }
  }
});

client.login(BOT_TOKEN);
