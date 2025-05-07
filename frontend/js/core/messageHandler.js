const { joinVoice, leaveVoice, getGuildState } = require('./voiceManager');
const { handleTextMessage } = require('./textHandler');
const { playMusicInVoiceChannel, skipSong, stopMusic } = require('./audioPlayer');

async function handleCommand(message) {
  const content = message.content.trim();

  if (content.startsWith('!play ')) {
    const url = content.split(' ')[1];
    return playMusicInVoiceChannel(url, message);
  }
  if (content === '!skip') return skipSong(message);
  if (content === '!stop') return stopMusic(message);
  if (content === '!join') return joinVoice(message);
  if (content === '!leave') return leaveVoice(message);

  if (message.channel.name === 'герта') {
    const state = getGuildState(message.guild.id);
    const { playbackQueue = [], isPlaying = false, playNext = () => {} } = state || {};

    const wrappedPlayNext = () => {
      if (state) {
        state.isPlaying = true;
        playNext();
      }
    };

    handleTextMessage(message, playbackQueue, isPlaying, wrappedPlayNext);
  }
}

module.exports = { handleCommand };