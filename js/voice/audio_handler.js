const prism = require('prism-media');
const axios = require('axios');

async function handleAudio({ connection, message, userId, playbackQueue, isPlaying, playNext, textChannel }) {
  const user = message.guild.members.cache.get(userId);
  if (!user || user.user.bot) return;

  const opusStream = connection.receiver.subscribe(userId, {
    end: {
      behavior: require('@discordjs/voice').EndBehaviorType.AfterSilence,
      duration: 1000
    }
  });

  const pcmStream = new prism.opus.Decoder({
    rate: 16000,
    channels: 1,
    frameSize: 960
  });

  opusStream.pipe(pcmStream);

  const chunks = [];

  pcmStream.on('data', chunk => {
    chunks.push(chunk);
  });

  pcmStream.on('end', async () => {
    if (chunks.length === 0) return;

    const buffer = Buffer.concat(chunks);
    if (buffer.length < 32000) return;

    const float32Array = new Float32Array(buffer.length / 2);
    for (let i = 0; i < buffer.length; i += 2) {
      float32Array[i / 2] = buffer.readInt16LE(i) / 32768;
    }

    const payload = {
      audio: Array.from(float32Array)
    };

    try {
      const speakerName = Buffer.from(user.displayName, 'utf-8').toString('base64');
      const response = await axios.post('http://localhost:8000/recognize', payload, {
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
          'X-Speaker-Name': speakerName
        },
        validateStatus: () => true
      });

      if (response.status !== 200) {
        console.error(`❌ Bad server response: ${response.status}`);
        return;
      }

      const generatedTextEncoded = response.headers['x-generated-text'];
      let decodedText = null;

      if (generatedTextEncoded) {
        try {
          decodedText = Buffer.from(generatedTextEncoded, 'base64').toString('utf-8');
          console.log(`📢 Ответ бота: ${decodedText}`);
        } catch (e) {
          console.error('❌ Ошибка при декодировании ответа:', e);
        }
      }

      if (textChannel && decodedText) {
        textChannel.send(`**Ответ для ${user.displayName}:** ${decodedText}`);
      }

      playbackQueue.push({ stream: response.data, text: decodedText });

      if (!isPlaying) {
        playNext();
      }

    } catch (err) {
      console.error('❌ Ошибка при отправке аудио:', err.message);
    }
  });
}

module.exports = {
  handleAudio
};
