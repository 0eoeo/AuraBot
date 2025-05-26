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
const ytdlpExec = require('yt-dlp-exec').default;
const fs = require('fs');

async function playMusicInVoiceChannel(url, interaction) {
  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      const msg = '🔇 Ты должен быть в голосовом канале!';
      // Если интеракция не была обработана — отвечаем reply, иначе editReply
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(msg);
      }
      return;
    }

    // Делаем defer только если это не сделано
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

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const cookiesExists = fs.existsSync('cookies.txt');

    // Получаем инфо о видео/аудио
    const info = await ytdlpExec(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      noCallHome: true,
      noPlaylist: true,
      referer: 'https://www.youtube.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      addHeader: ['Accept-Language: en-US,en;q=0.9'],
      ...(cookiesExists ? { cookies: 'cookies.txt' } : {}),
    });

    const audioFormats = info.formats
      .filter(f => f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));

    if (!audioFormats.length) throw new Error('❌ Не найдено аудиоформатов');

    const bestAudio = audioFormats[0];

    console.log('▶️ Воспроизводим:', info.title);

    const ffmpegProcess = spawn(ffmpeg, [
      '-i', bestAudio.url,
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

    const resource = createAudioResource(ffmpegProcess.stdout, { inputType: StreamType.Raw });
    const player = createAudioPlayer();

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Playing, () => {
      console.log('▶️ Музыка проигрывается');
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('⏹️ Музыка остановлена');
      ffmpegProcess.kill('SIGKILL');
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    player.on('error', error => {
      console.error('Ошибка проигрывания:', error);
      ffmpegProcess.kill('SIGKILL');
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    // Если был defer и еще не был ответ — отвечаем через editReply
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(`🎶 Воспроизвожу: **${info.title}**`);
    } else if (!interaction.deferred && !interaction.replied) {
      // Если случайно defer не вызван, отвечаем сразу
      await interaction.reply(`🎶 Воспроизвожу: **${info.title}**`);
    }

  } catch (error) {
    console.error('❌ Ошибка в playMusicInVoiceChannel:', error);
    const msg = '❌ Не удалось воспроизвести музыку. Убедись, что ссылка корректна и видео доступно.';
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = { playMusicInVoiceChannel };
