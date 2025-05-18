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
      // Если интеракция еще не была отвечена, отвечаем
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('🔇 Ты должен быть в голосовом канале!');
      } else {
        // Если уже отвечали, то просто редактируем или ничего не делаем
        await interaction.editReply('🔇 Ты должен быть в голосовом канале!');
      }
      return;
    }

    // Деферим ответ, чтобы Discord не закрыл интеракцию
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    const ytdlp = spawn('yt-dlp', ['--cookies-from-browser', 'chrome', '-f', 'bestaudio', '-o', '-', url]);
    ytdlp.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data.toString()}`);
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

    // Редактируем ответ, если интеракция не была ранее ответом
    if (!interaction.replied) {
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

function skipSong(message) {
  const state = require('./voiceManager').getGuildState(message.guild.id);
  if (!state) return message.reply('❗ В очереди нет музыки для пропуска.');
  state.player.stop();
  message.reply('⏩ Песня пропущена!');
}

function stopMusic(message) {
  const state = require('./voiceManager').getGuildState(message.guild.id);
  if (!state) return message.reply('❗ Нет музыки для остановки.');
  state.playbackQueue = [];
  state.player.stop();
  message.reply('⏹️ Музыка остановлена!');
}

module.exports = { playMusicInVoiceChannel, skipSong, stopMusic };
