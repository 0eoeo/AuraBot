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

// Очередь для проигрывания
const playbackQueue = [];
let isPlaying = false;

client.once('ready', () => {
  console.log(`🔊 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!join') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.reply('Ты должен быть в голосовом канале!');

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    const receiver = connection.receiver;
    const player = createAudioPlayer();
    connection.subscribe(player);

    const activeStreams = new Map();

    const playNext = () => {
      if (playbackQueue.length === 0) {
        isPlaying = false;
        return;
      }

      const next = playbackQueue.shift();
      isPlaying = true;
      player.play(next);
    };

    player.on(AudioPlayerStatus.Idle, () => {
      playNext();
    });

    player.on('error', error => {
      console.error('🎧 Ошибка проигрывания:', error.message);
      playNext();
    });

    receiver.speaking.on('start', userId => {
      if (activeStreams.has(userId)) return;

      const user = message.guild.members.cache.get(userId);
      if (!user || user.user.bot) return;

      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
      });

      const pcmStream = new prism.opus.Decoder({
        rate: 16000,
        channels: 1,
        frameSize: 960
      });

      opusStream.pipe(pcmStream);
      activeStreams.set(userId, true);

      const chunks = [];
      pcmStream.on('data', chunk => {
        chunks.push(chunk);
      });

      pcmStream.on('end', async () => {
        activeStreams.delete(userId);
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
          const response = await axios.post('http://localhost:8000/recognize', payload, {
            responseType: 'stream',
            headers: {
              'Content-Type': 'application/json',
              'X-Speaker-Name': speakerName
            }
          });

          const resource = createAudioResource(response.data, {
            inputType: StreamType.Arbitrary
          });

          playbackQueue.push(resource);

          if (!isPlaying) {
            playNext();
          }
        } catch (error) {
          console.error('❌ Ошибка при отправке аудио:', error.message);
        }
      });
    });
  }
});

client.login(process.env.BOT_TOKEN);
