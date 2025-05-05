const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const joinCommand = require('./js/commands/join');
const leaveCommand = require('./js/commands/leave');
const handleTextMessage = require('./js/commands/text_handler');

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
  if (message.content === '!join') return joinCommand(message);
  if (message.content === '!leave') return leaveCommand(message);
  handleTextMessage(message, playbackQueue, isPlaying, playNext);
});

client.login(process.env.BOT_TOKEN);
