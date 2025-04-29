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

                const payload = {
                    speaker: user.displayName,
                    audio: buffer // передаем сырое аудио как Buffer
                };

                try {
                    const response = await axios.post('http://localhost:8000/recognize', payload, {
                        responseType: 'stream',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    const player = createAudioPlayer();
                    connection.subscribe(player);

                    const chunks = [];
                    response.data.on('data', chunk => {
                        chunks.push(chunk);
                    });

                    response.data.on('end', () => {
                        const audioBuffer = Buffer.concat(chunks);
                        const resource = createAudioResource(audioBuffer, { inputType: StreamType.Arbitrary });
                        player.play(resource);

                        player.on(AudioPlayerStatus.Idle, () => {
                            console.log('🔊 Проигрывание завершено');
                        });

                        player.on('error', error => {
                            console.error('🎧 Ошибка проигрывания:', error.message);
                        });
                    });
                } catch (error) {
                    console.error('❌ Ошибка при отправке аудио:', error.message);
                }
            });
        });
    }
});

client.login(process.env.BOT_TOKEN);
