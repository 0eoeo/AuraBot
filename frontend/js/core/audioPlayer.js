const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

async function playMusicInVoiceChannel(url, interaction) {
  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '🔇 Ты должен быть в голосовом канале!', ephemeral: true });
      } else {
        await interaction.editReply('🔇 Ты должен быть в голосовом канале!');
      }
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    // Обработка ошибок соединения
    connection.on('error', error => {
      console.error('Ошибка соединения с голосовым каналом:', error);
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    // Запуск yt-dlp с передачей cookies
    const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '--cookies', cookiePath, '-o', '-', url]);
    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
    });

    ytdlp.on('close', code => {
      if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
    });

    // Запуск ffmpeg для конвертации в PCM формат
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

    ffmpegProcess.on('close', code => {
      if (code !== 0) console.error(`ffmpeg exited with code ${code}`);
    });

    // Прокачиваем аудио поток
    ytdlp.stdout.pipe(ffmpegProcess.stdin);

    // Создаем аудио ресурс для Discord
    const resource = createAudioResource(ffmpegProcess.stdout, { inputType: StreamType.Raw });
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
      console.error('Ошибка проигрывания:', error.message, error.stack);
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

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
