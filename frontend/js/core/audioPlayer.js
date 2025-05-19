const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { spawnSync, spawn } = require('child_process');
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

    // === Получаем доступные форматы через yt-dlp ===
    const formatsResult = spawnSync('yt-dlp', ['-J', '--cookies', 'cookies.txt', url], {
      encoding: 'utf-8'
    });

    if (formatsResult.status !== 0) {
      console.error('yt-dlp -J error:', formatsResult.stderr);
      await interaction.editReply('❌ Не удалось получить информацию о формате видео.');
      return;
    }

    let formatId = null;

    try {
      const json = JSON.parse(formatsResult.stdout);
      const audioFormats = json.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
      // Сортировка по качеству (более высокий абитрейт — выше)
      audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
      formatId = audioFormats[0]?.format_id;

      if (!formatId) {
        await interaction.editReply('❌ Не удалось найти аудиоформат для воспроизведения.');
        return;
      }
    } catch (err) {
      console.error('Ошибка парсинга JSON от yt-dlp:', err);
      await interaction.editReply('❌ Не удалось распознать данные о формате.');
      return;
    }

    // === Подключение к голосовому каналу ===
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    connection.on('error', error => {
      console.error('Ошибка соединения с голосовым каналом:', error);
      if (connection.state.status !== 'destroyed') connection.destroy();
    });

    // === Запуск yt-dlp ===
    const ytdlp = spawn('yt-dlp', ['-f', formatId, '--cookies', 'cookies.txt', '-o', '-', url]);
    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
    });

    ytdlp.on('close', code => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}`);
      }
    });

    // === Запуск ffmpeg ===
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
      if (code !== 0) {
        console.error(`ffmpeg exited with code ${code}`);
      }
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

    await interaction.editReply('🎶 Воспроизвожу музыку!');

  } catch (error) {
    console.error('Ошибка в playMusicInVoiceChannel:', error);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Произошла ошибка при воспроизведении музыки.', ephemeral: true });
      } else {
        await interaction.editReply('❌ Произошла ошибка при воспроизведении музыки.');
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = { playMusicInVoiceChannel };
