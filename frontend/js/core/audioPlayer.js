const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');

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

    if (!interaction.guild?.voiceAdapterCreator) {
      throw new Error('❌ Не удалось получить адаптер голосового канала');
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

    // Ожидаем подключения
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const cookiesExists = fs.existsSync('cookies.txt');

    const formatId = await new Promise((resolve, reject) => {
      const args = ['-J', url];
      if (cookiesExists) args.splice(1, 0, '--cookies', 'cookies.txt');
      const ytdlpFormats = spawn('yt-dlp', args);

      let stdout = '', stderr = '';

      ytdlpFormats.stdout.on('data', data => stdout += data.toString());
      ytdlpFormats.stderr.on('data', data => stderr += data.toString());

      ytdlpFormats.on('close', code => {
        if (code !== 0) {
          console.error('❌ yt-dlp (format fetch) error:', stderr);
          return reject(new Error('yt-dlp exited with code ' + code));
        }

        try {
          const json = JSON.parse(stdout);
          const audioFormats = json.formats
            .filter(f =>
              f.acodec !== 'none' &&
              f.ext !== 'mhtml' &&
              f.url
            )
            .sort((a, b) => ((b.abr || 0) - (a.abr || 0)));

          if (!audioFormats.length) {
            return reject(new Error('❌ Не найдено аудиоформатов'));
          }

          resolve(audioFormats[0].format_id);
        } catch (e) {
          console.error('❌ Ошибка парсинга JSON от yt-dlp:', e);
          reject(e);
        }
      });
    });

    const ytdlpArgs = [
      '-f', formatId,
      '-o', '-',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0',
      '--referer', 'https://www.youtube.com',
      '--add-header', 'Accept-Language: en-US,en;q=0.9',
      url
    ];
    if (cookiesExists) {
      ytdlpArgs.splice(2, 0, '--cookies', 'cookies.txt');
    }

    const ytdlp = spawn('yt-dlp', ytdlpArgs);

    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
    });

    ytdlp.on('close', code => {
      if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
    });

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
      ytdlp.kill('SIGKILL');
      ffmpegProcess.kill('SIGKILL');
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    player.on('error', error => {
      console.error('Ошибка проигрывания:', error);
      ytdlp.kill('SIGKILL');
      ffmpegProcess.kill('SIGKILL');
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
