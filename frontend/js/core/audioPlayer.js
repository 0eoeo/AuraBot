const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const prism = require('prism-media');
const ytdlp = require('yt-dlp-exec');

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
    // 1. Скачиваем аудио с YouTube
    const stream = ytdlp.exec(url, {
      output: '-',
      quiet: true,
      format: 'bestaudio',
    });

    // 2. Преобразуем в формат Discord с помощью ffmpeg через prism-media
    const transcoder = new prism.FFmpeg({
      args: [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      ],
      shell: false,
      executable: ffmpegPath,
    });

    const opusStream = stream.stdout.pipe(transcoder);

    const resource = createAudioResource(opusStream, {
      inputType: 'arbitrary',
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
