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
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const RECORDINGS_DIR = './recordings';
const SILENCE_TIMEOUT = 5000;

if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const activeTalkers = new Map();         // userId -> last talk time
const recordingInProgress = new Set();   // userId currently being recorded

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
        message.reply('🔊 Подключился к голосовому каналу!');
    }

    if (message.content === '!leave') {
        const conn = getVoiceConnection(message.guild.id);
        if (conn) {
            conn.destroy();
            message.reply('🚪 Вышел из голосового канала.');
        }
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;
    const userId = newState.id;

    if (!member || member.user.bot) return;

    const channel = newState.channel;
    if (!channel || !channel.members.has(client.user.id)) return;

    const connection = getVoiceConnection(channel.guild.id);
    if (!connection) return;

    if (recordingInProgress.has(userId) || !canStartNewRecording(userId)) return;

    activeTalkers.set(userId, Date.now());
    recordingInProgress.add(userId);
    console.log(`🎙️ ${member.displayName} начал говорить`);

    startRecording(userId, member, connection);
});

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
            const buffer = await fs.promises.readFile(filepath);
            if (!buffer || buffer.length === 0) {
                console.warn('⚠️ Пустой аудиофайл — пропускаем');
                return;
            }

            // Преобразуем PCM → Float32[]
            const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / Int16Array.BYTES_PER_ELEMENT);
            const float32Array = Float32Array.from(int16Array, x => x / 32768);
            const audioArray = Array.from(float32Array);

            const res = await axios.post('http://127.0.0.1:5000/recognize', {
                speaker: user.displayName,
                audio: audioArray
            });

            if (res.data && res.data.status === 'accepted') {
                console.log('✅ Задача отправлена на сервер');
            } else {
                console.log('⚠️ Сервер вернул неожиданный ответ');
            }
        } catch (err) {
            console.error('❌ Ошибка при обработке аудио:', err.message);
        } finally {
            recordingInProgress.delete(userId); // 💡 важно!
            setTimeout(async () => {
                await fs.promises.unlink(filepath);
                console.log(`🗑️ Удалён ${filepath}`);
            }, 5000);
        }
    });
}

client.login(token);
