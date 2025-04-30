const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Очередь проигрывания
const playbackQueue = [];
let isPlaying = false;

function playNext(player, connection) {
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

client.once('ready', () => {
  console.log(`🔊 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!join') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('Ты должен быть в голосовом канале!');
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    connection.on('error', error => {
      console.error('VoiceConnection error:', error);
    });

    const receiver = connection.receiver;
    const subscribedUsers = new Set();
    const player = createAudioPlayer();

    // Убираем warning про слишком много слушателей
    player.setMaxListeners(20);

    player.on(AudioPlayerStatus.Idle, () => {
      playNext(player, connection);
    });

    player.on('error', error => {
      console.error('🎧 Ошибка проигрывания:', error.message);
      playNext(player, connection);
    });

    receiver.speaking.on('start', userId => {
      if (subscribedUsers.has(userId)) return;
      subscribedUsers.add(userId);

      const user = message.guild.members.cache.get(userId);
      if (!user || user.user.bot) return;

      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
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
        subscribedUsers.delete(userId);

        if (chunks.length === 0) return;
        const buffer = Buffer.concat(chunks);

        const float32Array = new Float32Array(buffer.length / 2);
        for (let i = 0; i < buffer.length; i += 2) {
          const int16 = buffer.readInt16LE(i);
          float32Array[i / 2] = int16 / 32768;
        }

        const payload = {
          audio: Array.from(float32Array)
        };

        try {
          const speakerName = Buffer.from(user.displayName, 'utf-8').toString('base64');

          const response = await axios.post('http://localhost:5000/recognize', payload, {
            responseType: 'stream',
            headers: {
              'Content-Type': 'application/json',
              'X-Speaker-Name': speakerName
            }
          });

          playbackQueue.push({ stream: response.data });

          if (!isPlaying) {
            playNext(player, connection);
          }
        } catch (error) {
          console.error('❌ Ошибка при отправке аудио:', error.message);
        }
      });
    });
  }
});

client.login(process.env.BOT_TOKEN);
