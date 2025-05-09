const { Client, GatewayIntentBits } = require('discord.js');
const { handleInteraction } = require('./core/messageHandler');
const { handleTextMessage } = require('./core/textHandler');
const { getGuildState } = require('./core/voiceManager');
require('dotenv').config({path: '../.env'});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🔊 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.name === 'инлинь') {
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
    if (!interaction.isCommand()) return;

    console.log(`🛠 Interaction command received: ${interaction.commandName}`);
    await handleInteraction(interaction);

  } catch (error) {
    console.error('❌ Error in interaction handler:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Произошла ошибка при обработке команды.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Произошла ошибка при обработке команды.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('❌ Failed to send error reply:', replyError);
    }
  }
});

client.login(process.env.BOT_TOKEN);