const { joinVoice } = require('../voice/manager');

module.exports = async function join(message) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('Ты должен быть в голосовом канале!');
  await joinVoice(message);
};
