const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const { joinVoice, leaveVoice, getGuildState } = require('./js/voice/manager');
const handleTextMessage = require('./js/text/text_handler');

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

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!join') return joinVoice(message);
  if (message.content === '!leave') return leaveVoice(message);

  if (message.channel.name !== 'герта') return;

  const state = getGuildState(message.guild.id);
  if (!state) return;

  const { playbackQueue, isPlaying, playNext } = state;

  const wrappedPlayNext = () => {
    state.isPlaying = true;
    playNext();
  };

  handleTextMessage(message, playbackQueue, isPlaying, wrappedPlayNext);
});

client.login(process.env.BOT_TOKEN);
