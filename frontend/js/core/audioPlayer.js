const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const play = require('play-dl');

async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member.voice.channel;

  if (!voiceChannel) {
    if (!interaction.replied && !interaction.deferred) {
      return await interaction.reply({ content: '❌ Зайди в голосовой канал сначала!', ephemeral: true });
    } else {
      return await interaction.followUp({ content: '❌ Зайди в голосовой канал сначала!', ephemeral: true });
    }
  }

  // Подключение к голосовому каналу
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch (error) {
    connection.destroy();
    console.error('Ошибка подключения:', error);
    return interaction.reply('❌ Не удалось подключиться к каналу.');
  }

  const player = createAudioPlayer();
  connection.subscribe(player);

  try {
    const stream = await play.stream(url);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    player.play(resource);

    player.on(AudioPlayerStatus.Playing, async () => {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(`🎶 Сейчас играет: ${url}`);
      } else {
        await interaction.editReply(`🎶 Сейчас играет: ${url}`);
      }
    });

    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', async (error) => {
      console.error('Ошибка проигрывания:', error);
      await interaction.channel.send('❌ Ошибка проигрывания аудио.');
      connection.destroy();
    });

  } catch (error) {
    console.error('Ошибка получения аудио:', error);
    connection.destroy();
    await interaction.reply('❌ Не удалось получить поток.');
  }
}

module.exports = { playMusicInVoiceChannel };
