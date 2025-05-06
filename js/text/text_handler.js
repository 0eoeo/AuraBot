const axios = require('axios');

async function handleTextMessage(message, playbackQueue, isPlaying, playNext) {
  if (message.author.bot) return;
  if (message.channel.name !== "герта") return;

  const speaker = Buffer.from(message.member.displayName, 'utf-8').toString('base64');
  const text = message.content;

  try {
    const replyResponse = await axios.post('http://localhost:8000/reply', {
      speaker: message.member.displayName,
      text
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const replyText = replyResponse.data?.text?.trim();

    if (!replyText) {
      await message.reply("🤖 Бот не ответил.");
      return;
    }

    console.log("✅ Текст ответа:", replyText);
    await message.reply(`${replyText}`);  // <-- отвечает на сообщение

    const botVoiceChannel = message.guild.members.me.voice.channel;

    if (!botVoiceChannel) {
      console.log("🎧 Бот не в голосовом канале. Пропускаем воспроизведение.");
      return;  // только текст
    }

    const voiceResponse = await axios.post('http://localhost:8000/voice', {
      text: replyText
    }, {
      responseType: 'stream',
      headers: { 'Content-Type': 'application/json' }
    });

    playbackQueue.push({ stream: voiceResponse.data, text: replyText });
    if (!isPlaying) playNext();

  } catch (err) {
    console.error('❌ Ошибка при обращении к API:', err.message);
    await message.reply("⚠️ Произошла ошибка при запросе к API.");
  }
}

module.exports = handleTextMessage;
