const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const voiceManager = require('./voiceManager');

function createStream(url, onError) {
  const cookiesPath = 'cookies.txt';
  const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', url]);
  const ffmpegProcess = spawn(ffmpeg, [
    '--cookies', cookiesPath,
    '-i', 'pipe:0',
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ]);

  let pipeActive = true;

  function cleanupPipe() {
    if (pipeActive) {
      pipeActive = false;
      try {
        ytdlp.stdout.unpipe(ffmpegProcess.stdin);
      } catch {}
      try {
        if (!ffmpegProcess.stdin.destroyed) ffmpegProcess.stdin.end();
      } catch {}
    }
  }

  ytdlp.stderr.on('data', data => console.warn(`yt-dlp stderr: ${data}`));
  ffmpegProcess.stderr.on('data', data => console.warn(`ffmpeg stderr: ${data}`));

  ytdlp.on('error', error => {
    console.error('yt-dlp error:', error);
    cleanupPipe();
    onError?.(error);
  });

  ffmpegProcess.on('error', error => {
    console.error('ffmpeg error:', error);
    cleanupPipe();
    onError?.(error);
  });

  ytdlp.on('close', code => {
    if (code !== 0) console.warn(`yt-dlp exited with code ${code}`);
    cleanupPipe();
  });

  ffmpegProcess.on('close', code => {
    if (code !== 0) console.warn(`ffmpeg exited with code ${code}`);
    cleanupPipe();
  });

  // Обработка ошибок pipe (например, EPIPE)
  ytdlp.stdout.on('error', err => {
    if (err.code === 'EPIPE') {
      // Обычно происходит, если ffmpegProcess.stdin закрылся
      // Можно просто игнорировать или залогировать
      console.warn('yt-dlp.stdout EPIPE error:', err);
    } else {
      console.error('yt-dlp.stdout error:', err);
      cleanupPipe();
      onError?.(err);
    }
  });

  ffmpegProcess.stdin.on('error', err => {
    if (err.code === 'EPIPE') {
      console.warn('ffmpegProcess.stdin EPIPE error:', err);
    } else {
      console.error('ffmpegProcess.stdin error:', err);
      cleanupPipe();
      onError?.(err);
    }
  });

  try {
    if (!ytdlp.stdout.destroyed && !ffmpegProcess.stdin.destroyed) {
      ytdlp.stdout.pipe(ffmpegProcess.stdin);
    }
  } catch (err) {
    console.error('❗ Ошибка pipe:', err);
    cleanupPipe();
    onError?.(err);
  }

  return {
    stream: ffmpegProcess.stdout,
    processes: [ytdlp, ffmpegProcess]
  };
}

function playNext(guildId) {
  const state = voiceManager.getGuildState(guildId);
  if (!state || state._isPlayingNext) return;

  state._isPlayingNext = true;

  if (state.isSkipping) {
    state.isSkipping = false;
    state._isPlayingNext = false;
    return;
  }

  const next = state.playbackQueue.shift();

  if (state.currentProcesses?.length) {
    state.currentProcesses.forEach(proc => {
      if (!proc.killed) proc.kill();
    });
    state.currentProcesses = null;
  }

  if (!next) {
    state.player.stop();
    try {
      if (state.connection && state.connection.state.status !== 'destroyed') {
        state.connection.destroy();
      }
    } catch (e) {
      console.warn('❗ Ошибка при уничтожении соединения:', e);
    }
    voiceManager.clearGuildState(guildId);
    state._isPlayingNext = false;
    return;
  }

  const { stream, processes } = createStream(next.url, error => {
    console.error('Ошибка во время создания потока:', error);
    state._isPlayingNext = false;
    playNext(guildId);
  });

  state.currentProcesses = processes;

  const resource = createAudioResource(stream, {
    inputType: StreamType.Raw
  });

  state.currentTrack = next;
  state.player.play(resource);
  state._isPlayingNext = false;
}

async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return safeReply(interaction, '❗ Ты должен быть в голосовом канале!');
  }

  let state = voiceManager.getGuildState(interaction.guild.id);
  if (!state) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    state = {
      player,
      connection,
      playbackQueue: [],
      currentTrack: null,
      currentProcesses: null,
      isSkipping: false,
      _isPlayingNext: false
    };

    voiceManager.setGuildState(interaction.guild.id, state);

    player.on(AudioPlayerStatus.Idle, () => {
      playNext(interaction.guild.id);
    });

    player.on('error', error => {
      console.error('🎧 Ошибка проигрывания:', error);
      playNext(interaction.guild.id);
    });
  }

  state.playbackQueue.push({ url, requestedBy: interaction.user.username });

  if (state.player.state.status !== AudioPlayerStatus.Playing) {
    playNext(interaction.guild.id);
  }

  await safeReply(interaction, `🎶 Добавлено ${interaction.user.username} в очередь: ${url}`);
}

function skipSong(interaction) {
  const state = voiceManager.getGuildState(interaction.guild.id);
  if (!state || !state.player) {
    return safeReply(interaction, '❗ Нет музыки для пропуска.');
  }

  state.isSkipping = true;

  if (state.currentProcesses?.length) {
    state.currentProcesses.forEach(proc => {
      if (!proc.killed) proc.kill();
    });
    state.currentProcesses = null;
  }

  safeReply(interaction, '⏭️ Пропускаем песню...');

  // Останавливаем плеер, затем запускаем playNext, чтобы заново создать поток и начать следующую песню
  state.player.stop();
  playNext(interaction.guild.id);
}

async function stopMusic(interaction) {
  const state = voiceManager.getGuildState(interaction.guild.id);
  if (!state) {
    return safeReply(interaction, '❗ Нет музыки для остановки.');
  }

  if (state.currentProcesses) {
    state.currentProcesses.forEach(proc => {
      if (!proc.killed) proc.kill();
    });
    state.currentProcesses = null;
  }

  state.playbackQueue = [];
  state.currentTrack = null;

  state.player.removeAllListeners();

  state.player.stop();

  try {
    if (state.connection && state.connection.state.status !== 'destroyed') {
      state.connection.destroy();
    }
  } catch (e) {
    console.warn('❗ Ошибка при уничтожении соединения:', e);
  }

  voiceManager.clearGuildState(interaction.guild.id);
  await safeReply(interaction, '⏹️ Музыка остановлена.');
}

async function safeReply(interaction, text) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(text).catch(console.warn);
    } else {
      await interaction.reply(text).catch(console.warn);
    }
  } catch (e) {
    console.warn('⚠️ Не удалось отправить сообщение:', e);
  }
}

module.exports = {
  playMusicInVoiceChannel,
  skipSong,
  stopMusic
};
