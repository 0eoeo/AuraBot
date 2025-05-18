const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

async function playMusicInVoiceChannel(url, interaction) {
  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('🔇 Ты должен быть в голосовом канале!');
      } else {
        await interaction.editReply('🔇 Ты должен быть в голосовом канале!');
      }
      return;
    }

    // Сразу откладываем ответ, чтобы Discord не посчитал интеракцию просроченной
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    // Запускаем yt-dlp для получения аудио потока
    const ytdlp = spawn('yt-dlp', ['--cookies-from-browser', 'chrome', '-f', 'bestaudio', '-o', '-', url]);
    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
    });

    // Прогоняем через ffmpeg, чтобы преобразовать аудио в нужный формат
    const ffmpegProcess = spawn(ffmpeg, [
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ]);
    ffmpegProcess.stderr.on('data', data => {
      console.error(`ffmpeg error: ${data.toString()}`);
    });

    ytdlp.stdout.pipe(ffmpegProcess.stdin);

    const resource = createAudioResource(ffmpegProcess.stdout, {
      inputType: StreamType.Raw
    });

    const player = createAudioPlayer();
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Playing, () => {
      console.log('▶️ Музыка проигрывается');
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('⏹️ Музыка остановлена');
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    player.on('error', error => {
      console.error('🎧 Ошибка проигрывания:', error.message);
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    // После того, как deferred ответ отправлен, редактируем его
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply('🎶 Воспроизвожу музыку!');
    }
  } catch (error) {
    console.error('Ошибка в playMusicInVoiceChannel:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Произошла ошибка при воспроизведении музыки.', ephemeral: true });
      } else {
        await interaction.editReply('Произошла ошибка при воспроизведении музыки.');
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = { playMusicInVoiceChannel };
