const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');

const play = require('play-dl');

async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member.voice.channel;

  if (!voiceChannel) {
    return interaction.reply('❌ Ты должен быть в голосовом канале, чтобы включить музыку!');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();

  connection.subscribe(player);

  try {
    // Получаем аудио-поток с YouTube
    const stream = await play.stream(url);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.play(resource);

    player.on(AudioPlayerStatus.Playing, () => {
      interaction.reply(`🎶 Сейчас играет: ${url}`);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', error => {
      console.error('Ошибка аудио-плеера:', error);
      interaction.channel.send('❌ Ошибка воспроизведения музыки.');
      connection.destroy();
    });

  } catch (error) {
    console.error('Ошибка при воспроизведении:', error);
    interaction.reply('❌ Не удалось воспроизвести аудио.');
    connection.destroy();
  }
}

module.exports = { playMusicInVoiceChannel };
