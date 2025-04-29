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
const { Readable } = require('stream');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`🔊 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('Ты должен быть в голосовом канале!');

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        });

        const receiver = connection.receiver;

        receiver.speaking.on('start', userId => {
            const user = message.guild.members.cache.get(userId);
            if (user?.user?.bot) return;

            const opusStream = receiver.subscribe(userId, {
                end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
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
                const buffer = Buffer.concat(chunks);

                // Int16 -> Float32 [-1.0, 1.0]
                const float32Array = new Float32Array(buffer.length / 2);
                for (let i = 0; i < buffer.length; i += 2) {
                    const int16 = buffer.readInt16LE(i);
                    float32Array[i / 2] = int16 / 32768;
                }

                const payload = {
                    speaker: user.displayName,
                    audio: Array.from(float32Array)
                };

                try {
                    const response = await axios.post('http://localhost:8000/recognize', payload, {
                        responseType: 'arraybuffer',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    // Преобразуем arraybuffer в stream
                    const audioBuffer = Buffer.from(response.data);
                    const audioStream = Readable.from(audioBuffer);

                    const resource = createAudioResource(audioStream, {
                        inputType: StreamType.Arbitrary
                    });

                    const player = createAudioPlayer();
                    player.play(resource);
                    connection.subscribe(player);

                    player.on(AudioPlayerStatus.Idle, () => {
                        console.log('🔊 Проигрывание завершено');
                    });

                    player.on('error', err => {
                        console.error('❌ Ошибка проигрывания:', err.message);
                    });

                } catch (error) {
                    console.error('❌ Ошибка при отправке аудио:', error.message);
                }
            });
        });
    }
});

client.login(process.env.BOT_TOKEN);
