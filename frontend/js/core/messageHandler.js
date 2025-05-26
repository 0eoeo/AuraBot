const { joinVoice, leaveVoice } = require('./voiceManager');
const { playMusicInVoiceChannel, skipSong, stopMusic } = require('./audioPlayer');
const { getUser, updateCoins, addCharacter, getCollection } = require('./db');
const { handleCasino, handleCollection, handleCoin, handleBalance, handlePrize } = require('./characterHandler');
const { getHoroscopeMessage } = require('./horoscopeSender');
const { EmbedBuilder } = require('discord.js');


async function handleInteraction(interaction) {
  const { commandName } = interaction;

  try {
    // Для команд, где требуется задержка с ответом, делаем deferReply один раз в начале
    if (
      ['horoscope', 'play', 'skip', 'stop', 'join', 'leave', 'casino', 'collection', 'balance', 'prize'].includes(commandName)
    ) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    }

    switch (commandName) {
      case 'horoscope': {
        const parts = await getHoroscopeMessage();

        const embeds = parts.map((part, i) =>
          new EmbedBuilder()
            .setColor('#0099ff')
            .setDescription(part)
            .setFooter({ text: `Страница ${i + 1} из ${parts.length}` })
        );

        await interaction.editReply({ embeds: [embeds[0]] });

        for (let i = 1; i < embeds.length; i++) {
          await interaction.followUp({ embeds: [embeds[i]] });
        }
        break;
      }

      case 'coin': {
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');

        // Здесь можно добавить проверку и логику перевода монет из db.js

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(`${interaction.user.username} перевел(а) ${amount} монет(ы) пользователю ${user.username}.`);
        } else {
          await interaction.editReply(`${interaction.user.username} перевел(а) ${amount} монет(ы) пользователю ${user.username}.`);
        }
        break;
      }

      case 'play': {
        const url = interaction.options.getString('url');
        await playMusicInVoiceChannel(url, interaction);
        break;
      }

      case 'skip': {
        await skipSong(interaction);
        break;
      }

      case 'stop': {
        await stopMusic(interaction);
        break;
      }

      case 'join': {
        await joinVoice(interaction);
        break;
      }

      case 'leave': {
        await leaveVoice(interaction);
        break;
      }

      case 'casino': {
        await handleCasino(interaction);
        break;
      }

      case 'collection': {
        await handleCollection(interaction);
        break;
      }

      case 'balance': {
        await handleBalance(interaction);
        break;
      }

      case 'prize': {
        await handlePrize(interaction);
        break;
      }

      default: {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Неизвестная команда.', ephemeral: true });
        } else {
          await interaction.editReply('Неизвестная команда.');
        }
      }
    }
  } catch (error) {
    console.error(`Ошибка в обработке команды "${commandName}":`, error);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Произошла внутренняя ошибка.', ephemeral: true });
      } else {
        await interaction.editReply('Произошла внутренняя ошибка.');
      }
    } catch (err) {
      console.error('Ошибка при отправке сообщения об ошибке:', err);
    }
  }
}

module.exports = { handleInteraction };
