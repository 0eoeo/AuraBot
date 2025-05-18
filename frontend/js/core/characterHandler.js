const { getUser, updateCoins, addCharacter, getCollection } = require('./db');
const { EmbedBuilder } = require('discord.js');
const PRICE = 100;

const characters = [
  { name: 'Сопля', rarity: 'Common', chance: 0.9, preview: 'https://i.pinimg.com/originals/ff/98/6c/ff986c4116c1551007ff0152e2a4d85e.gif' },
  { name: 'Птичка', rarity: 'Rare', chance: 0.07, preview: 'https://i.pinimg.com/originals/af/e2/52/afe2524e0c5047a7024ff3e35cc2b09d.gif' },
  { name: 'Лисичка', rarity: 'Epic', chance: 0.02, preview: 'https://i.pinimg.com/originals/de/4e/57/de4e57e4e2cdf53dba84a026fe61086e.gif' },
  { name: 'Кошька', rarity: 'Legendary', chance: 0.01, preview: 'https://i.pinimg.com/originals/a6/c2/f0/a6c2f03d5f21dbd24166ba8211366f74.gif' },
];

function getRarityColor(rarity) {
  switch (rarity) {
    case 'Common': return '#7a7a7a';
    case 'Rare': return '#4682b4';
    case 'Epic': return '#9b30ff';
    case 'Legendary': return '#ffd700';
    default: return '#ffffff';
  }
}

async function getUserCollection(userId) {
  return new Promise((resolve, reject) => {
    getCollection(userId, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function getRandomCharacter(userId) {
  const rand = Math.random();
  let userCharacters = await getUserCollection(userId);

  const rarityCounts = characters.reduce((acc, char) => {
    acc[char.rarity] = userCharacters.filter(c => c.rarity === char.rarity).length;
    return acc;
  }, {});

  const updatedCharacters = characters.map(char => {
    const bonus = (rarityCounts[char.rarity] || 0) * 0.01;
    return { ...char, chance: Math.min(char.chance + bonus, 1) };
  });

  const totalChance = updatedCharacters.reduce((sum, c) => sum + c.chance, 0);
  const normalizedCharacters = updatedCharacters.map(char => ({
    ...char,
    chance: char.chance / totalChance,
  }));

  let sum = 0;
  for (const char of normalizedCharacters) {
    sum += char.chance;
    if (rand < sum) return char;
  }

  return normalizedCharacters[0];
}

async function handleCasino(interaction) {
  const userId = interaction.user.id;

  try {
    const user = await new Promise((resolve, reject) => {
      getUser(userId, (err, data) => err ? reject(err) : resolve(data));
    });

    if (user.coins < PRICE) {
      return await interaction.followUp(`У вас ${user.coins} монет. Для крутки необходимо: ${PRICE}`);
    }

    const character = await getRandomCharacter(userId);

    await new Promise((resolve, reject) => {
      updateCoins(userId, -PRICE, err => err ? reject(err) : resolve());
    });

    const rows = await getUserCollection(userId);
    const alreadyOwned = rows.some(row => row.character === character.name);

    const embed = new EmbedBuilder()
      .setColor(getRarityColor(character.rarity))
      .setTitle(`Вы получили: ${character.name}!`)
      .setDescription(`Редкость: **${character.rarity}**`)
      .setImage(character.preview);

    await interaction.followUp({
      content: `🎉 Поздравляем! Вы получили персонажа!`,
      embeds: [embed],
    });

    if (!alreadyOwned) {
      await new Promise((resolve, reject) => {
        addCharacter(userId, character.name, character.rarity, character.preview, err => {
          if (err) return reject('Ошибка добавления персонажа.');
          resolve();
        });
      });
    }

  } catch (err) {
    console.error('❌ Ошибка в казино:', err);
    await interaction.followUp('Произошла ошибка при выполнении команды.');
  }
}

async function handleCollection(interaction) {
  try {
    const rows = await getUserCollection(interaction.user.id);
    if (rows.length === 0) return await interaction.followUp('Коллекция пуста.');

    for (const row of rows) {
      const char = characters.find(c => c.name === row.character);
      if (!char) continue;

      const embed = new EmbedBuilder()
        .setColor(getRarityColor(row.rarity))
        .setTitle(`Персонаж: ${row.character}`)
        .setDescription(`Редкость: **${row.rarity}**`)
        .setImage(char.preview);

      await interaction.followUp({ embeds: [embed] });
    }

    await interaction.followUp('📦 Ваша коллекция:');

  } catch (err) {
    console.error('❌ Ошибка получения коллекции:', err);
    await interaction.followUp('Ошибка при получении коллекции.');
  }
}

async function handleCoin(interaction) {
  const senderId = interaction.user.id;
  const amount = interaction.options.getInteger('amount');
  const recipient = interaction.options.getUser('user');
  const recipientId = recipient.id;

  if (amount <= 0) return await interaction.followUp('Сумма должна быть положительным числом.');

  try {
    const sender = await new Promise((resolve, reject) => {
      getUser(senderId, (err, user) => err ? reject(err) : resolve(user));
    });

    if (sender.coins < amount) {
      return await interaction.followUp('У вас недостаточно монет.');
    }

    await new Promise((resolve, reject) => {
      updateCoins(senderId, -amount, err => err ? reject(err) : resolve());
    });

    await new Promise((resolve, reject) => {
      updateCoins(recipientId, amount, err => err ? reject(err) : resolve());
    });

    await interaction.followUp(`${amount} монет переведены пользователю ${recipient.username}.`);

  } catch (err) {
    console.error('❌ Ошибка перевода монет:', err);
    await interaction.followUp('Произошла ошибка при переводе монет.');
  }
}

async function handleBalance(interaction) {
  try {
    const user = await new Promise((resolve, reject) => {
      getUser(interaction.user.id, (err, data) => err ? reject(err) : resolve(data));
    });

    await interaction.followUp(`💰 У вас ${user.coins} монет.`);
  } catch (err) {
    console.error('❌ Ошибка получения баланса:', err);
    await interaction.followUp('Ошибка при получении баланса.');
  }
}

async function handlePrize(interaction) {
  const amount = interaction.options.getInteger('amount');
  const recipient = interaction.options.getUser('user');
  const guildOwnerId = interaction.guild.ownerId;

  if (interaction.user.id !== guildOwnerId) {
    return await interaction.followUp('❌ Только владелец сервера может использовать эту команду.');
  }

  try {
    await new Promise((resolve, reject) => {
      updateCoins(recipient.id, amount, err => err ? reject(err) : resolve());
    });

    await interaction.followUp(`✅ Начислено ${amount} монет пользователю ${recipient.username}.`);

  } catch (err) {
    console.error('❌ Ошибка выдачи приза:', err);
    await interaction.followUp('Ошибка при выдаче монет.');
  }
}

function startVoiceCoinsTask(client, guildId) {
  setInterval(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return;

      let total = 0;

      for (const [, channel] of guild.channels.cache) {
        if (channel.isVoiceBased()) {
          for (const [memberId, member] of channel.members) {
            if (member.user.bot) continue;

            await new Promise((resolve, reject) => {
              updateCoins(memberId, 1, err => {
                if (err) {
                  console.error(`Ошибка начисления монет пользователю ${memberId}:`, err);
                  return reject(err);
                }
                resolve();
              });
            });

            total++;
          }
        }
      }

      if (total > 0) {
        console.log(`✅ Начислено 1 монету каждому из ${total} участников голосовых каналов.`);
      }

    } catch (error) {
      console.error('Ошибка в startVoiceCoinsTask:', error);
    }
  }, 60 * 1000);
}

module.exports = {
  handleCasino,
  handleCollection,
  handleCoin,
  handleBalance,
  handlePrize,
  startVoiceCoinsTask,
};