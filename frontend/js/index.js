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
  startVoiceCoinsTask(client, GUILD_ID, VOICE_CHANNEL_ID);
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
  try {
     if (interaction.isChatInputCommand()) {
        await handleInteraction(interaction);
       }
     }
  catch (error) {
    console.error('❌ Ошибка обработки команды:', error);
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp('Произошла ошибка при выполнении команды.');
      } else {
        await interaction.reply('Произошла ошибка при выполнении команды.');
      }
  }
});

client.login(process.env.BOT_TOKEN);
