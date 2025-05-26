const cron = require('node-cron');
const axios = require('axios');

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

// Получаем положение планет
async function getPlanetsData() {
  try {
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];

    const response = await axios.get('https://api.freeastrologyapi.com/planets', {
      headers: {
        'X-API-KEY': ASTRO_API_KEY
      },
      params: {
        date: isoDate,
        location: 'Moscow'
      }
    });

    const data = response.data?.data;
    if (!data || !Array.isArray(data)) throw new Error('Неверный формат данных');

    return data.map(planet => ({
      name: planetNamesRu[planet.name] || planet.name,
      sign: zodiacSignsRu[planet.sign] || planet.sign,
      deg: planet.deg // если нужно, можно добавить градусы
    }));
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
