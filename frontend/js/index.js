const { Client, GatewayIntentBits } = require('discord.js');
const { handleCommand } = require('./core/messageHandler');
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
  handleCommand(message);
});

client.login(process.env.BOT_TOKEN);