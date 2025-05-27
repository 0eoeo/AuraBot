const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdlp = require('yt-dlp-exec');
const path = require('path');

async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply('❌ Ты должен быть в голосовом канале!');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  try {
    // Запускаем yt-dlp-exec и получаем stdout как поток
    const process = ytdlp.raw(
      url,
      {
        format: 'bestaudio',
        output: '-',
        quiet: true,
        noWarnings: true,
        cookies: path.join(__dirname, 'cookies.txt'),
      },
      { stdio: ['ignore', 'pipe', 'ignore'] }
    );

    const resource = createAudioResource(process.stdout, {
      inputType: 'arbitrary',
    });

    player.play(resource);

    player.once(AudioPlayerStatus.Playing, () => {
      interaction.reply(`🎶 Сейчас играет: ${url}`);
    });

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', (error) => {
      console.error('Ошибка аудио:', error);
      interaction.channel.send('❌ Ошибка воспроизведения аудио.');
      connection.destroy();
    });

  } catch (error) {
    console.error('❌ Ошибка воспроизведения:', error);
    connection.destroy();
    interaction.reply('❌ Ошибка воспроизведения. Видео может быть недоступно или защищено.');
  }
}

module.exports = { playMusicInVoiceChannel };
