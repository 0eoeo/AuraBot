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
const ytdlpExec = require('yt-dlp-exec');
const fs = require('fs');

async function playMusicInVoiceChannel(url, interaction) {
  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({ content: '🔇 Ты должен быть в голосовом канале!', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        return await interaction.editReply('🔇 Ты должен быть в голосовом канале!');
      }
      return;
    }

    // Обязательно дефирим сразу, если это долгое действие
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // ... Твой код для joinVoiceChannel и yt-dlp

    // После получения информации об аудио отправляем ответ
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(`🎶 Воспроизвожу: **${info.title}**`);
    }

  } catch (error) {
    console.error('❌ Ошибка в playMusicInVoiceChannel:', error);
    const msg = '❌ Не удалось воспроизвести музыку. Убедись, что ссылка корректна и видео доступно.';
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}


module.exports = { playMusicInVoiceChannel };
