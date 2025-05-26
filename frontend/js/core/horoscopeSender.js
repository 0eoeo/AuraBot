const cron = require('node-cron');
const request = require('request');

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
function getPlanetsData() {
  return new Promise((resolve, reject) => {
    const now = new Date();

    const options = {
      method: 'POST',
      url: 'https://json.freeastrologyapi.com/western/planets',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ASTRO_API_KEY
      },
      body: JSON.stringify({
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        date: now.getUTCDate(),
        hours: now.getUTCHours(),
        minutes: now.getUTCMinutes(),
        seconds: now.getUTCSeconds(),
        latitude: 55.7558,
        longitude: 37.6173,
        timezone: 3, // Москва UTC+3
        config: {
          observation_point: 'topocentric',
          ayanamsha: 'tropical',
          language: 'ru'
        }
      })
    };

    request(options, (error, response) => {
      if (error) {
        console.error('❌ Ошибка API планет:', error.message);
        return resolve(null);
      }

      try {
        const data = JSON.parse(response.body);
        if (!data || !data.planets || !Array.isArray(data.planets)) {
          throw new Error('Неверный формат данных');
        }

        const planets = data.planets.map(planet => ({
          name: planetNamesRu[planet.name] || planet.name,
          sign: zodiacSignsRu[planet.sign] || planet.sign,
          deg: planet.deg
        }));

        resolve(planets);
      } catch (err) {
        console.error('❌ Ошибка обработки ответа API планет:', err.message);
        resolve(null);
      }
    });
  });
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
    return '⚠️ Не удалось получить данные о планетах.';
  }
  const horoscopeText = await getHoroscopeFromAPI(planets);
  const today = new Date().toLocaleDateString('ru-RU');
  return `🔮 **Гороскоп на ${today}**\n\n${horoscopeText}`;
}

// Запускаем ежедневную задачу, отправляющую гороскоп в канал
function startHoroscopeTask(client, guildId) {
  cron.schedule('0 0 * * *', async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.find(ch => ch.name === 'бот' && ch.isTextBased());
      if (!channel) {
        console.warn('⚠️ Канал "бот" не найден');
        return;
      }

      const message = await getHoroscopeMessage();
      await channel.send(message);
      console.log('✅ Гороскоп отправлен в канал "бот"');
    } catch (err) {
      console.error('❌ Ошибка при отправке гороскопа:', err.message);
    }
  }, {
    timezone: 'Europe/Moscow'
  });
}

module.exports = { startHoroscopeTask, getHoroscopeMessage };
