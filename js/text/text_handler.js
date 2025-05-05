process.stdout.setEncoding('utf8');
const axios = require('axios');

async function handleTextMessage(message, playbackQueue, isPlaying, playNext) {
  if (message.author.bot) return;
  if (message.channel.name !== "герта") return;

  const speaker = Buffer.from(message.member.displayName, 'utf-8').toString('base64');
  const text = message.content;

  try {
    const response = await axios.post('http://localhost:8000/reply', {
      speaker: message.member.displayName,
      text
    }, {
      responseType: 'stream',
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    if (response.status !== 200) {
      console.error(`❌ Ошибка ответа API: ${response.status}`);
      return;
    }

    const encodedText = response.headers['x-generated-text'];
    let replyText = null;
    if (encodedText) {
      try {
        replyText = Buffer.from(encodedText, 'base64').toString('utf-8');
        console.log('✅ Раскодированный текст:', replyText);
      } catch (e) {
        console.error('❌ Ошибка декодирования Base64:', e);
      }
    }

    if (replyText) {
      await message.channel.send(`**Ответ:** ${replyText}`);
    }

    playbackQueue.push({ stream: response.data, text: replyText });
    if (!isPlaying) playNext();
  } catch (err) {
    console.error('❌ Ошибка при обращении к /reply:', err.message);
  }
}

module.exports = handleTextMessage;
