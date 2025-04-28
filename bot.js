const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    getVoiceConnection,
    EndBehaviorType,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');
const fs = require('fs');
const axios = require('axios');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const COOKIE_STRING = 'PREF=...; VISITOR_INFO1_LIVE=...; YSC=...; SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...; LOGIN_INFO=...';
const SILENCE_TIMEOUT = 5000;
const RECORDINGS_DIR = './recordings';
const queue = new Map(); // Очередь воспроизведения для каждого канала

// Путь до папки
const recordingsDir = path.join(__dirname, 'recordings');

// Проверяем и создаём папку
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR);

const activeTalkers = new Map();
const recordingInProgress = new Set();

function canStartNewRecording(userId) {
    const now = Date.now();
    const lastTime = activeTalkers.get(userId) || 0;
    return (now - lastTime) > SILENCE_TIMEOUT;
}

client.once('ready', () => {
    console.log(`🔊 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!play ')) {
        const url = message.content.split(' ')[1];
        if (!url || !ytdl.validateURL(url)) {
            return message.reply('❗ Невалидная ссылка на YouTube!');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('🔇 Ты должен быть в голосовом канале!');

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });

            const ytdlpProcess = spawn('yt-dlp', [
                '-f', 'bestaudio',
                '-o', '-',
                url
            ]);

            const ffmpegProcess = spawn(ffmpeg, [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1'
            ]);

            ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);

            ytdlpProcess.stderr.on('data', data => {
                console.error(`yt-dlp error: ${data}`);
            });

            ytdlpProcess.on('close', code => {
                if (code !== 0) {
                    console.error(`yt-dlp exited with code ${code}`);
                }
            });

            const resource = createAudioResource(ffmpegProcess.stdout, {
                inputType: StreamType.Raw
            });

            const player = createAudioPlayer();
            connection.subscribe(player);
            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log('▶️ Музыка проигрывается');
                message.reply('🎶 Воспроизвожу музыку!');
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log('⏹️ Музыка остановлена');
                if (connection.state.status !== 'destroyed') {
                    connection.destroy();
                }
            });

            player.on('error', error => {
                console.error('🎧 Ошибка проигрывания:', error.message);
                if (connection.state.status !== 'destroyed') {
                    connection.destroy();
                }
            });
        } catch (err) {
            console.error('❌ Ошибка при воспроизведении:', err.message);
            message.reply('⚠️ Произошла ошибка при попытке воспроизвести видео');
        }
    }

    if (message.content === '!skip') {
        skipSong(message);
    }

    if (message.content === '!stop') {
        stopMusic(message);
    }

   if (message.content === '!join') {
        if (!message.member.voice.channel) {
            return message.reply('Ты должен быть в голосовом канале!');
        }

        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        });

        console.log('✅ Подключился к голосовому каналу');

        const receiver = connection.receiver;

        receiver.speaking.on('start', userId => {
            const user = message.guild.members.cache.get(userId);
            if (user?.user?.bot) return;
            if (!user || recordingInProgress.has(userId) || !canStartNewRecording(userId)) return;

            activeTalkers.set(userId, Date.now());
            recordingInProgress.add(userId);
            console.log(`🎙️ ${user.displayName} начал говорить`);

            startRecording(userId, user, connection);
        });
    }

    if (message.content === '!leave') {
        const conn = getVoiceConnection(message.guild.id);
        if (conn) {
            conn.destroy();
            message.reply('🚪 Вышел из голосового канала.');
        }
    }
});

function skipSong(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('❗ В очереди нет музыки для пропуска.');
    }
    serverQueue.player.stop();
    message.reply('⏩ Песня пропущена!');
}

function stopMusic(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('❗ Нет музыки для остановки.');
    }
    serverQueue.songs = [];
    serverQueue.player.stop();
    message.reply('⏹️ Музыка остановлена!');
}

function startRecording(userId, user, connection) {
    const receiver = connection.receiver;

    const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual }
    });

    const pcmStream = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
    });

    const filename = `${user.displayName}-${Date.now()}.pcm`;
    const filepath = path.join(RECORDINGS_DIR, filename);
    const output = fs.createWriteStream(filepath);

    opusStream.pipe(pcmStream).pipe(output);

    let stopTimeout;
    const stopRecording = () => {
        opusStream.destroy();
        output.end();
        clearTimeout(stopTimeout);
    };

    opusStream.on('data', () => {
        clearTimeout(stopTimeout);
        stopTimeout = setTimeout(stopRecording, SILENCE_TIMEOUT);
    });

    opusStream.on('end', () => {
        stopRecording();
    });

    output.on('finish', async () => {
        console.log(`📁 Записан файл: ${filepath}`);

        try {
            const audioData = await fs.promises.readFile(filepath);
            if (audioData.length === 0 || !fs.existsSync(filepath)) {
                console.warn('⚠️ Пустой аудиофайл — пропускаем');
                return;
            }


            const speakerName = Buffer.from(user.displayName, 'utf-8').toString('base64');
            const res = await axios.post('http://0.0.0.0:5000/recognize', audioData, {
                responseType: 'arraybuffer',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Speaker-Name': speakerName
                }
            });

            if (res && res.data.byteLength > 0) {
                const outputAudioPath = path.join(RECORDINGS_DIR, `output-${Date.now()}.wav`);
                fs.writeFileSync(outputAudioPath, Buffer.from(res.data), 'binary');

                const player = createAudioPlayer();
                const resource = createAudioResource(outputAudioPath);
                connection.subscribe(player);
                player.play(resource);

                player.on('error', err => console.error('🎧 Ошибка проигрывания:', err.message));

                player.once(AudioPlayerStatus.Playing, () => {
                    console.log('🔊 Проигрываю ответ');
                });

                player.once(AudioPlayerStatus.Idle, () => {
                    console.log('✅ Проигрывание завершено');
                    setTimeout(async () => {
                        await fs.promises.unlink(filepath);
                        console.log(`🗑️ Удалён ${filepath}`);
                    }, 1000);
                });
            } else {
                console.log('ℹ️ Пустой ответ от сервера');
            }
        } catch (err) {
            console.error('❌ Ошибка при обработке аудио:', err.message);
        } finally {
            setTimeout(async () => {
                await fs.promises.unlink(filepath);
                console.log(`🗑️ Удалён ${filepath}`);
            }, 5000);
        }
    });
}

client.login(token);
