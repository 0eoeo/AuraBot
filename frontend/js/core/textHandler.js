const axios = require('axios');

async function handleTextMessage(message, playbackQueue, isPlaying, playNext) {
  const speaker = Buffer.from(message.member.displayName, 'utf-8').toString('base64');
  const text = message.content;

  try {
    const replyResponse = await axios.post('http://localhost:8000/reply', {
      speaker: message.member.displayName,
      text
    });

    const replyText = replyResponse.data?.text?.trim();
    if (!replyText) return await message.reply('🤖 Бот не ответил.');

    await message.reply(replyText);

    const botVoiceChannel = message.guild.members.me.voice.channel;
    if (!botVoiceChannel) return;

    const voiceResponse = await axios.post('http://localhost:8000/voice', {
      text: replyText
    }, { responseType: 'stream' });

    playbackQueue.push({ stream: voiceResponse.data, text: replyText });
    if (!isPlaying) playNext();
  } catch (err) {
    console.error('❌ Ошибка API:', err.message);
    await message.reply('⚠️ Ошибка при обращении к API.');
  }
}

module.exports = { handleTextMessage };