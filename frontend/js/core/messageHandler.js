const { joinVoice, leaveVoice } = require('./voiceManager');
const { playMusicInVoiceChannel, skipSong, stopMusic } = require('./audioPlayer');
const { getUser, updateCoins, addCharacter, getCollection } = require('./db');
const { handleCasino, handleCollection, handleCoin, handleBalance, handlePrize } = require('./characterHandler');
const { getHoroscopeMessage } = require('./horoscopeSender');
const { EmbedBuilder } = require('discord.js')

const characters = [
  { url: 'https://gif.guru/file/aHR0cHM6Ly9pLnBpbmltZy5jb20vb3JpZ2luYWxzL2FmL2UyLzUyL2FmZTI1MjRlMGM1MDQ3YTcwMjRmZjNlMzVjYzJiMDlkLmdpZg.mp4', rarity: 'Common', chance: 0.9 },
  { url: 'https://gif.guru/file/aHR0cHM6Ly9pLnBpbmltZy5jb20vb3JpZ2luYWxzL2RlLzRlLzU3L2RlNGU1N2U0ZTJjZGY1M2RiYTg0YTAyNmZlNjEwODZlLmdpZg.mp4', rarity: 'Rare', chance: 0.08 },
  { url: 'https://gif.guru/file/aHR0cHM6Ly9zdXJ2ZXltb25rZXktYXNzZXRzLnMzLmFtYXpvbmF3cy5jb20vc3VydmV5LzE1OTg3NzMzMS8zOGFjMmZjZi01YjQwLTRiNGYtOTc1ZC1kOWUyZjQwOTI3NmEuZ2lm.mp4', rarity: 'Epic', chance: 0.0198 },
  { url: 'https://gif.guru/file/aHR0cHM6Ly9pLnBpbmltZy5jb20vb3JpZ2luYWxzLzI5LzAwLzkyLzI5MDA5MjBlMmFjMGEwYzhmMTZlYmE1M2M4MzczMTViLmdpZg.mp4', rarity: 'Legendary', chance: 0.0002 }
];

async function handleInteraction(interaction) {
  const { commandName } = interaction;

  if (commandName === 'horoscope') {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }

      const parts = await getHoroscopeMessage();

      const embeds = parts.map((part, i) =>
        new EmbedBuilder()
          .setColor('#0099ff')
          .setDescription(part)
          .setFooter({ text: `Страница ${i + 1} из ${parts.length}` })
      );

      // Отправляем первую часть через editReply
      await interaction.editReply({ embeds: [embeds[0]] });

      // Отправляем остальные части через followUp, всем видимые (без ephemeral)
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]] });
      }
  return;
}


  if (commandName === 'coin') {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');

    // Логика перевода монет
    await interaction.reply(`${interaction.user.username} перевел(а) ${amount} монет(ы) пользователю ${user.username}.`);
  }

  // Для обработки команд через обычные сообщения
  if (commandName === 'play') {
    const url = interaction.options.getString('url'); // Предположим, что это строка URL
    return playMusicInVoiceChannel(url, interaction);
  }

  if (commandName === 'skip') {
    return skipSong(interaction);
  }

  if (commandName === 'stop') {
    return stopMusic(interaction);
  }

  // Обработка других команд
  if (commandName === 'join') {
    return joinVoice(interaction);
  }

  if (commandName === 'leave') {
    return leaveVoice(interaction);
  }

  if (commandName === 'casino') {
    return handleCasino(interaction);
  }

  if (commandName === 'collection') {
    return handleCollection(interaction);
  }

  if (commandName === 'balance') {
    return handleBalance(interaction);
  }

  if (commandName === 'prize') {
    return handlePrize(interaction);
  }
}

module.exports = { handleInteraction };
