const prism = require('prism-media');
const axios = require('axios');

module.exports = async function handleAudio({ connection, message, userId, playbackQueue, isPlaying, playNext, textChannel }) {
  const user = message.guild.members.cache.get(userId);
  if (!user || user.user.bot) return;

  const opusStream = connection.receiver.subscribe(userId, {
    end: { behavior: 1, duration: 500 }
  });

  const pcmStream = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 48000 });

  opusStream.pipe(pcmStream);

  const chunks = [];
  pcmStream.on('data', chunk => chunks.push(chunk));

  pcmStream.on('end', async () => {
    if (chunks.length === 0) return;
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 32000) return;

    const float32Array = new Float32Array(buffer.length / 2);
    for (let i = 0; i < buffer.length; i += 2) {
      float32Array[i / 2] = buffer.readInt16LE(i) / 32768;
    }

    try {
      const speakerName = Buffer.from(user.displayName, 'utf-8').toString('base64');
      const response = await axios.post('https://aurabot-1.onrender.com/recognize', {
        audio: Array.from(float32Array)
      }, {
        responseType: 'stream',
        headers: { 'X-Speaker-Name': speakerName }
      });

      const generatedTextEncoded = response.headers['x-generated-text'];
      let decodedText = null;

      if (generatedTextEncoded) {
        decodedText = Buffer.from(generatedTextEncoded, 'base64').toString('utf-8');
        if (textChannel) textChannel.send(`**Ответ для ${user.displayName}:** ${decodedText}`);
      }

      playbackQueue.push({ stream: response.data, text: decodedText });
      if (!isPlaying) playNext();
    } catch (err) {
      console.error('❌ Ошибка при отправке аудио:', err.message);
    }
  });
};
