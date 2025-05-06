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

const { joinVoice, leaveVoice, getGuildState } = require('./js/voice/manager');
const handleTextMessage = require('./js/text/text_handler');

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

  if (message.content.startsWith('!play ')) {
        const url = message.content.split(' ')[1];
        if (!url || !ytdl.validateURL(url)) {
            return message.reply('❗ Невалидная ссылка на YouTube!');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('🔇 Ты должен быть в голосовом канале!');

        try {
            // Асинхронно воспроизводим музыку
            await playMusicInVoiceChannel(url, message, voiceChannel);
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

  if (message.content === '!join') return joinVoice(message);
  if (message.content === '!leave') return leaveVoice(message);

  if (message.channel.name !== 'герта') return;

  const state = getGuildState(message.guild.id);
  const { playbackQueue = [], isPlaying = false, playNext = () => {} } = state || {};

  const wrappedPlayNext = () => {
    if (state) {
      state.isPlaying = true;
      playNext();
    }
  };

  handleTextMessage(message, playbackQueue, isPlaying, wrappedPlayNext);
});

// Вспомогательная функция для воспроизведения музыки
async function playMusicInVoiceChannel(url, message, voiceChannel) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
    });

    const ytdlpProcess = spawn('yt-dlp', [
        '-f', 'bestaudio',
        '-o', '-',
        '--retries', '10',
        '--fragment-retries', '10',
        '--socket-timeout', '15',
        '--force-ipv4', // помогает при странном поведении IPv6
        url
    ]);

    const ffmpegProcess = spawn(ffmpeg, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    ytdlpProcess.stdout.once('readable', () => {
        ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);
    });

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
}

// Функция для проигрывания песен из очереди
function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    const resource = createAudioResource(song.stream, {
        inputType: StreamType.Arbitrary,
        metadata: { title: song.title }
    });

    serverQueue.player.play(resource);

    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.on(AudioPlayerStatus.Playing, () => {
        console.log(`▶️ Воспроизведение: ${song.title}`);
        serverQueue.textChannel.send(`🎶 Сейчас играет: ${song.title}`);
    });

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });

    serverQueue.player.on('error', (error) => {
        console.error('🎧 Ошибка проигрывания:', error);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });
}

// Функция для пропуска текущей песни
function skipSong(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('❗ В очереди нет музыки для пропуска.');
    }
    serverQueue.player.stop();
    message.reply('⏩ Песня пропущена!');
}

// Функция для остановки музыки
function stopMusic(message) {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('❗ Нет музыки для остановки.');
    }
    serverQueue.songs = [];
    serverQueue.player.stop();
    message.reply('⏹️ Музыка остановлена!');
}

client.login(process.env.BOT_TOKEN);
