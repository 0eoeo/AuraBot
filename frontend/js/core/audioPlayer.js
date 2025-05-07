const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

async function playMusicInVoiceChannel(url, message) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('🔇 Ты должен быть в голосовом канале!');

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator
  });

  const ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', url]);
  const ffmpegProcess = spawn(ffmpeg, ['-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);

  ytdlp.stdout.pipe(ffmpegProcess.stdin);

  const resource = createAudioResource(ffmpegProcess.stdout, {
    inputType: StreamType.Raw
  });

  const player = createAudioPlayer();
  connection.subscribe(player);
  player.play(resource);

  player.on(AudioPlayerStatus.Playing, () => {
    console.log('▶️ Музыка проигрывается');
    message.reply('🎶 Воспроизвожу музыку!');
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log('⏹️ Музыка остановлена');
    if (connection.state.status !== 'destroyed') connection.destroy();
  });

  player.on('error', error => {
    console.error('🎧 Ошибка проигрывания:', error.message);
    if (connection.state.status !== 'destroyed') connection.destroy();
  });
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