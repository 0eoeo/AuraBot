const { REST } = require('@discordjs/rest');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { GatewayIntentBits } = require('discord.js');
require('dotenv').config({path: '../../.env'});

// Получаем переменные из .env файла
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.BOT_TOKEN;

console.log(`Токен: ${token}`);
console.log(`Client ID: ${clientId}`);
console.log(`Guild ID: ${guildId}`);

// Создание REST-клиента для взаимодействия с Discord API
const rest = new REST({ version: '10' }).setToken(token);

// Список команд, которые вы хотите зарегистрировать
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Играть музыку').addStringOption(option =>
    option.setName('url').setDescription('URL для воспроизведения').setRequired(true)
  ),
  new SlashCommandBuilder().setName('stop').setDescription('Остановить музыку'),
  new SlashCommandBuilder().setName('join').setDescription('Добавить в голосовой канал'),
  new SlashCommandBuilder().setName('leave').setDescription('Выгнать из голосового канала'),
  new SlashCommandBuilder().setName('casino').setDescription('Крутка!'),
  new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Перевести монеты')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Количество монет для перевода')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Пользователь для перевода монет')
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName('balance').setDescription('Проверить баланс'),
  new SlashCommandBuilder().setName('collection').setDescription('Просмотреть коллекцию'),
  new SlashCommandBuilder().setName('prize').setDescription('Отправить приз (только для админа)').addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Количество монет для перевода')
        .setRequired(true)
    ).addUserOption(option =>
      option.setName('user')
        .setDescription('Пользователь для перевода монет')
        .setRequired(true)
    )
];

// Функция для регистрации команд
async function registerCommands() {
  try {
    console.log('Начинаю регистрацию команд...');
    console.log(JSON.stringify(commands.map(command => command.toJSON()), null, 2));


    // Отправка запроса на регистрацию команд
   await rest.put(
      `/applications/${clientId}/guilds/${guildId}/commands`,
      { body: commands.map(command => command.toJSON()) }
    );

    console.log('Команды успешно зарегистрированы!');
  } catch (error) {
    console.error('Ошибка при регистрации команд:', error);
  }
}

// Запуск функции регистрации команд
registerCommands();
