const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = new Player(client, {
  ytdlOptions: {
    // Параметры для yt-dlp
    quality: 'highestaudio',
    filter: 'audioonly',
    highWaterMark: 1 << 25,
  },
  // Путь к ffmpeg из ffmpeg-static
  ffmpeg: require('ffmpeg-static'),
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

async function playMusicInVoiceChannel(url, interaction) {
  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      const msg = '🔇 Ты должен быть в голосовом канале!';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        await interaction.editReply(msg);
      }
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Создаем или получаем очередь воспроизведения для гильдии
    const queue = player.nodes.create(interaction.guild, {
      metadata: {
        channel: interaction.channel,
        client: client.user,
        requestedBy: interaction.user,
      },
      selfDeaf: true,
      volume: 80,
    });

    // Подключаемся к голосовому каналу (если не подключены)
    if (!queue.connection) await queue.connect(voiceChannel);

    // Добавляем трек в очередь
    const track = await player
      .search(url, {
        requestedBy: interaction.user,
      })
      .then(x => x.tracks[0]);

    if (!track) {
      const msg = '❌ Не удалось найти трек по ссылке или запросу.';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        await interaction.editReply(msg);
      }
      return;
    }

    queue.addTrack(track);

    if (!queue.node.isPlaying()) {
      await queue.node.play();
    }

    const msg = `🎶 Добавлено в очередь: **${track.title}**`;
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply(msg);
    }
  } catch (error) {
    console.error('❌ Ошибка в playMusicInVoiceChannel:', error);
    const msg = '❌ Не удалось воспроизвести музыку. Убедись, что ссылка корректна и видео доступно.';
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = { playMusicInVoiceChannel, client };
