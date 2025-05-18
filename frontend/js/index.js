const { Client, GatewayIntentBits } = require('discord.js');
const { handleInteraction } = require('./core/messageHandler');
const { handleTextMessage } = require('./core/textHandler');
const { getGuildState } = require('./core/voiceManager');
const { startVoiceCoinsTask } = require('./core/characterHandler'); // корректный путь
require('dotenv').config({ path: '../.env' });

const GUILD_ID = process.env.GUILD_ID; // замените на реальный ID сервера

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

  // Запускаем таймер начисления монет для голосового канала
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
    await interaction.deferReply(); // безопасный вариант, если обработка может занять время
    await handleInteraction(interaction); // ваша логика
  } catch (error) {
    console.error('❌ Ошибка обработки команды:', error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Произошла ошибка при выполнении команды.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Произошла ошибка при выполнении команды.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('⚠️ Ошибка при отправке follow-up ответа:', replyError);
    }
  }
});


client.login(process.env.BOT_TOKEN);
