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
      const msg = '🔇 Ты должен быть в голосовом канале!';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        await interaction.editReply(msg);
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

    connection.on('error', error => {
      console.error('❌ Ошибка соединения с голосовым каналом:', error);
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    // Получаем доступные форматы через yt-dlp -J (JSON)
    const formatInfo = await new Promise((resolve, reject) => {
      const ytdlpFormats = spawn('yt-dlp', ['-J', '--cookies', 'cookies.txt', url]);
      let stdout = '';
      let stderr = '';

      ytdlpFormats.stdout.on('data', data => stdout += data.toString());
      ytdlpFormats.stderr.on('data', data => stderr += data.toString());

      ytdlpFormats.on('close', code => {
        if (code !== 0) {
          console.error('❌ yt-dlp (format fetch) error:', stderr);
          return reject(new Error('yt-dlp exited with code ' + code));
        }

        try {
          const json = JSON.parse(stdout);
          console.log('📦 Форматы yt-dlp:', json.formats.map(f => ({
            format_id: f.format_id,
            ext: f.ext,
            acodec: f.acodec,
            vcodec: f.vcodec,
            abr: f.abr
          })));

          // Находим только аудиоформаты (или комбинированные, если аудио отдельно нет)
          let audioFormats = json.formats.filter(f => f.acodec !== 'none');
          if (!audioFormats.length) return reject(new Error('❌ Не найдено аудиоформатов'));

          // Выбираем лучший по битрейту
          audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
          resolve(audioFormats[0].format_id);
        } catch (e) {
          console.error('❌ Ошибка парсинга форматов:', e);
          reject(e);
        }
      });
    });

    const formatId = formatInfo || 'bestaudio';

    // Запускаем yt-dlp
    const ytdlp = spawn('yt-dlp', [
      '-f', formatId,
      '--cookies', 'cookies.txt',
      '-o', '-',
      url
    ]);
    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
    });
    ytdlp.on('close', code => {
      if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
    });

    // Запускаем ffmpeg
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

    ytdlp.stdout.pipe(ffmpegProcess.stdin);

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
    console.error('❌ Ошибка в playMusicInVoiceChannel:', error);
    const msg = '❌ Не удалось воспроизвести музыку. Убедись, что ссылка корректна и видео доступно.';
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = { playMusicInVoiceChannel };
