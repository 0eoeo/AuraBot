const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

// ✅ Функция для парсинга Netscape cookie в строку для play-dl
function parseCookiesFromNetscapeFile(filePath) {
  const cookieLines = fs.readFileSync(filePath, 'utf8').split('\n');
  const cookies = cookieLines
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split('\t');
      if (parts.length < 7) return null;
      const name = parts[5];
      const value = parts[6];
      return `${name}=${value}`;
    })
    .filter(Boolean); // удалить null
  return cookies.join('; ');
}

// ✅ Установка cookie ТОЛЬКО ОДИН РАЗ при запуске
const COOKIE_PATH = './cookies.txt';

(async () => {
  try {
    const cookieString = parseCookiesFromNetscapeFile(COOKIE_PATH);
    await play.setToken({
      youtube: {
        cookie: cookieString
      }
    });
    console.log('✅ Cookies установлены для YouTube');
  } catch (err) {
    console.error('❌ Ошибка при установке cookies:', err);
  }
})();

// 🎵 Функция для воспроизведения музыки
async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply('❌ Ты должен быть в голосовом канале!');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  try {
    const stream = await play.stream(url); // ⚠️ может выбросить ошибку при проблеме с cookie
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.play(resource);

    player.once(AudioPlayerStatus.Playing, () => {
      interaction.reply(`🎶 Сейчас играет: ${url}`);
    });

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', (error) => {
      console.error('Ошибка аудио:', error);
      interaction.channel.send('❌ Ошибка воспроизведения аудио.');
      connection.destroy();
    });

  } catch (error) {
    console.error('❌ Ошибка воспроизведения:', error);
    connection.destroy();
    interaction.reply('❌ Ошибка воспроизведения. Видео может быть недоступно или защищено.');
  }
}

module.exports = { playMusicInVoiceChannel };
