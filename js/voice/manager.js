const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  AudioPlayerStatus,
  StreamType,
  createAudioResource
} = require('@discordjs/voice');
const { handleAudio } = require('./audio_handler');

const guildStates = new Map();

async function joinVoice(message) {
  const guildId = message.guild.id;
  if (guildStates.has(guildId)) {
    return message.reply('Я уже подключён!');
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply('Сначала зайди в голосовой канал!');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
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

    const resource = createAudioResource(stream, {
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

  const textChannel = message.guild.channels.cache.find(
    ch => ch.name === "герта" && ch.type === 0
  );

  if (!textChannel) {
    console.warn('⚠️ Текстовый канал "герта" не найден.');
  }

  connection.receiver.speaking.on('start', userId => {
    handleAudio({
      connection,
      message,
      userId,
      playbackQueue,
      isPlaying,
      playNext,
      textChannel
    });
  });

  guildStates.set(guildId, {
    connection,
    player,
    playbackQueue,
    get isPlaying() {
      return isPlaying;
    },
    set isPlaying(val) {
      isPlaying = val;
    },
    playNext,
    textChannel
  });

  message.reply('✅ Подключился к голосовому каналу!');
}

function leaveVoice(message) {
  const guildId = message.guild.id;
  const state = guildStates.get(guildId);
  if (!state) {
    return message.reply('Я не в голосовом канале!');
  }

  state.player.stop();
  state.connection.destroy();
  guildStates.delete(guildId);

  message.reply('👋 Отключился.');
}

function getGuildState(guildId) {
  return guildStates.get(guildId);
}

module.exports = {
  joinVoice,
  leaveVoice,
  getGuildState
};
