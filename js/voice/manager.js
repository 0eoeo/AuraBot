const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');
const { handleAudio } = require('./js/audio_handler');

const guildStates = new Map();

async function joinVoice(message) {
  const guildId = message.guild.id;
  if (guildStates.has(guildId)) return message.reply('Я уже подключён!');

  const connection = joinVoiceChannel({
    channelId: message.member.voice.channel.id,
    guildId: guildId,
    adapterCreator: message.guild.voiceAdapterCreator
  });

  const player = createAudioPlayer();
  const playbackQueue = [];
  let isPlaying = false;

  function playNext() {
    if (playbackQueue.length === 0) {
      isPlaying = false;
      return;
    }

    isPlaying = true;
    const { stream } = playbackQueue.shift();

    const resource = require('@discordjs/voice').createAudioResource(stream, {
      inputType: StreamType.Arbitrary
    });

    player.play(resource);
    connection.subscribe(player);
  }

  player.on(AudioPlayerStatus.Idle, playNext);
  player.on('error', error => {
    console.error('Player error:', error);
    playNext();
  });

  connection.receiver.speaking.on('start', userId => {
    handleAudio({
      connection,
      message,
      userId,
      playbackQueue,
      isPlaying,
      playNext
    });
  });

  guildStates.set(guildId, { connection, player });
  message.reply('✅ Подключился!');
}

function leaveVoice(message) {
  const guildId = message.guild.id;
  const state = guildStates.get(guildId);
  if (!state) return message.reply('Я не в голосовом канале!');

  state.player.stop();
  state.connection.destroy();
  guildStates.delete(guildId);
  message.reply('👋 Отключился.');
}

module.exports = {
  joinVoice,
  leaveVoice
};
