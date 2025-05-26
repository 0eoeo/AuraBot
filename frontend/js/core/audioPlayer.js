const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

(async () => {
  await play.setToken({
    youtube: {
      cookie: fs.readFileSync('./cookies.txt', 'utf8')
    }
  });
})();

async function playMusicInVoiceChannel(url, interaction) {
  const voiceChannel = interaction.member.voice.channel;

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
    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    player.play(resource);

    player.on(AudioPlayerStatus.Playing, () => {
      interaction.reply(`🎶 Сейчас играет: ${url}`);
    });

    player.on(AudioPlayerStatus.Idle, () => connection.destroy());

    player.on('error', (error) => {
      console.error('Ошибка аудио:', error);
      interaction.channel.send('❌ Ошибка воспроизведения аудио.');
      connection.destroy();
    });

  } catch (error) {
    console.error('Ошибка воспроизведения:', error);
    connection.destroy();
    interaction.reply('❌ Ошибка воспроизведения.');
  }
}

module.exports = { playMusicInVoiceChannel };
