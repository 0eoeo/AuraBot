const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const ytdlpExec = require('youtube-dl-exec');
const fs = require('fs');

async function playMusicInVoiceChannel(url, interaction) {
  if (!interaction.member.voice.channel) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply('Ты должен быть в голосовом канале!');
    }
    return;
  }

  const voiceChannel = interaction.member.voice.channel;
  const connection = await voiceChannel.join();

  const stream = ytdlpExec.raw(url, {
    o: '-',
    q: '',
    f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
    r: '100K'
  });

  const dispatcher = connection.play(stream, { type: 'opus' });

  dispatcher.on('finish', () => {
    voiceChannel.leave();
  });

  dispatcher.on('error', console.error);

  await interaction.reply(`🎶 Играет: ${url}`);
}


module.exports = { playMusicInVoiceChannel };
