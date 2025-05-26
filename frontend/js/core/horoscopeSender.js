const cron = require('node-cron');
const request = require('request');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

const ASTRO_API_KEY = process.env.ASTRO_API_KEY;

const planetNamesRu = {
  Sun: 'Солнце',
  Moon: 'Луна',
  Mercury: 'Меркурий',
  Venus: 'Венера',
  Mars: 'Марс',
  Jupiter: 'Юпитер',
  Saturn: 'Сатурн',
  Uranus: 'Уран',
  Neptune: 'Нептун',
  Pluto: 'Плутон',
};

const zodiacSignsRu = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы'
};

// Получаем положение планет с помощью request и промиса
async function getPlanetsData() {
  const now = new Date();
  const body = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    date: now.getUTCDate(),
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    seconds: now.getUTCSeconds(),
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 3,
    config: {
      observation_point: 'topocentric',
      ayanamsha: 'tropical',
      language: 'en'
    }
  };

  try {
    const response = await axios.post('https://json.freeastrologyapi.com/western/planets', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ASTRO_API_KEY
      }
    });

    const data = response.data;

    if (!data || !Array.isArray(data.output)) {
      throw new Error('Неверный формат данных от API');
    }

    const planets = data.output.map(item => {
      const planetEn = item.planet.en;
      const signEn = item.zodiac_sign.name.en;
      const normDeg = item.normDegree;
      const isRetro = item.isRetro.toLowerCase() === 'true';

      return {
        name: planetNamesRu[planetEn] || planetEn,
        sign: zodiacSignsRu[signEn] || signEn,
        deg: normDeg,
        retro: isRetro
      };
    });

    return planets;
  } catch (err) {
    console.error('❌ Ошибка API планет:', err.message);
    return null;
  }
}

// Запрашиваем гороскоп у FastAPI по положению планет
async function getHoroscopeFromAPI(planets) {
  try {
    const response = await axios.post('https://aurabot-1.onrender.com/horoscope', {
      planets: planets
    });

    return response.data?.text || '⚠️ Не удалось получить гороскоп.';
  } catch (err) {
    console.error('❌ Ошибка при обращении к API гороскопа:', err.message);
    return '⚠️ Не удалось получить гороскоп.';
  }
}

// Получить полный текст гороскопа (планеты + гороскоп)
async function getHoroscopeMessage() {
  const planets = await getPlanetsData();
  if (!planets) {
    return ['⚠️ Не удалось получить данные о планетах.'];
  }
  const horoscopeText = await getHoroscopeFromAPI(planets);
  const today = new Date().toLocaleDateString('ru-RU');
  const header = `🔮 **Гороскоп на ${today}**`;

  const maxLen = 1500;
  const parts = [];
  parts.push(header);

  let text = horoscopeText;
  while (text.length > 0) {
    if (text.length <= maxLen) {
      parts.push(text);
      break;
    }
    let sliceIndex = text.lastIndexOf('\n', maxLen);
    if (sliceIndex === -1 || sliceIndex < maxLen / 2) {
      sliceIndex = text.lastIndexOf(' ', maxLen);
    }
    if (sliceIndex === -1 || sliceIndex < maxLen / 2) {
      sliceIndex = maxLen;
    }
    parts.push(text.slice(0, sliceIndex).trim());
    text = text.slice(sliceIndex).trim();
  }

  return parts;
}

function startHoroscopeTask(client, guildId) {
  cron.schedule('0 0 * * *', async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.find(ch => ch.name === 'бот' && ch.isTextBased());
      if (!channel) {
        console.warn('⚠️ Канал "бот" не найден');
        return;
      }

      const parts = await getHoroscopeMessage();

      const embeds = parts.map((part, i) =>
        new EmbedBuilder()
          .setColor('#0099ff')
          .setDescription(part)
          .setFooter({ text: `Страница ${i + 1} из ${parts.length}` })
      );

      for (const embed of embeds) {
        await channel.send({ embeds: [embed] });
        await new Promise(r => setTimeout(r, 500));
      }

      console.log('✅ Гороскоп отправлен в канал "бот"');
    } catch (err) {
      console.error('❌ Ошибка при отправке гороскопа:', err.message);
    }
  }, {
    timezone: 'Europe/Moscow'
  });
}

module.exports = { startHoroscopeTask, getHoroscopeMessage };
