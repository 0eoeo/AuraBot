const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');

async function handleTextMessage(message, playbackQueue, isPlaying, playNext) {
  const speaker = Buffer.from(message.member.displayName, 'utf-8').toString('base64');
  const text = message.content;

  try {
    const replyResponse = await axios.post('https://aurabot-1.onrender.com/reply', {
      speaker: message.member.displayName,
      text
    });

    const { type, text: replyText, image_base64, filename } = replyResponse.data;

    if (type === 'image') {
      if (!image_base64 || !filename) {
        await message.reply('⚠️ Картинка не получена.');
        return;
      }

      const imageBuffer = Buffer.from(image_base64, 'base64');
      const attachment = new AttachmentBuilder(imageBuffer, { name: filename || 'image.jpg' });

      await message.reply({ content: '🖼 Вот что получилось:', files: [attachment] });
      return;
    }

    if (!replyText?.trim()) {
      await message.reply('🤖 Бот не ответил.');
      return;
    }

    await message.reply(replyText);

    const botVoiceChannel = message.guild.members.me.voice.channel;
    if (!botVoiceChannel) return;

    const voiceResponse = await axios.post('https://aurabot-1.onrender.com/voice', {
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