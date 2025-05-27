const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PassThrough } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

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
// Получаем аудио поток с YouTube
const ytStream = ytdlp.exec(url, {
output: '-',
format: 'bestaudio',
quiet: true,
restrictFilenames: true,
noWarnings: true,
});

javascript
Копировать
Редактировать
const ffmpegStream = new PassThrough();

// Преобразуем поток через ffmpeg в подходящий формат
ffmpeg(ytStream.stdout)
  .audioCodec('libopus')
  .format('opus')
  .on('error', (err) => {
    console.error('FFmpeg error:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply('❌ Ошибка при обработке аудио.');
    }
    connection.destroy();
  })
  .pipe(ffmpegStream, { end: true });

const resource = createAudioResource(ffmpegStream, {
  inputType: StreamType.Opus,
});

player.play(resource);

player.once(AudioPlayerStatus.Playing, async () => {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(`🎶 Сейчас играет: ${url}`);
    }
  } catch (err) {
    console.warn('⚠️ Не удалось отправить reply:', err.message);
  }
});

player.once(AudioPlayerStatus.Idle, () => {
  connection.destroy();
});

player.on('error', async (error) => {
  console.error('Ошибка аудио:', error);
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply('❌ Ошибка воспроизведения аудио.');
    } else {
      await interaction.followUp('❌ Ошибка воспроизведения аудио.');
    }
  } catch (e) {
    console.warn('⚠️ Не удалось отправить сообщение об ошибке:', e.message);
  }
  connection.destroy();
});
} catch (error) {
console.error('❌ Общая ошибка воспроизведения:', error);
try {
if (!interaction.replied && !interaction.deferred) {
await interaction.reply('❌ Ошибка воспроизведения. Возможно, видео недоступно.');
} else {
await interaction.followUp('❌ Ошибка воспроизведения. Возможно, видео недоступно.');
}
} catch (e) {
console.warn('⚠️ Не удалось отправить сообщение об ошибке:', e.message);
}
connection.destroy();
}
}

module.exports = { playMusicInVoiceChannel };