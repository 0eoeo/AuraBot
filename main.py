import discord
from discord.ext import commands
# from recognizer_client import RecognizerClient
# from tts_generator import TTSGenerator
from audio_recorder import AudioRecorder
from config import BOT_TOKEN

# Инициализация клиентов для распознавания речи и TTS
# recognizer = RecognizerClient()
# tts = TTSGenerator()

# Инициализация бота с нужными интентами
intents = discord.Intents.default()
intents.messages = True
intents.voice_states = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

# Инициализация AudioRecorder с реальными объектами recognizer и tts
audio_recorder = AudioRecorder(bot, '', '')

@bot.event
async def on_ready():
    print(f"✅ Бот запущен как {bot.user}")

@bot.command()
async def join(ctx):
    """Команда для присоединения к голосовому каналу, где находится пользователь."""
    print('Запуск join...')
    if ctx.author.voice:
        channel = ctx.author.voice.channel  # Получаем голосовой канал, в котором находится пользователь
        await audio_recorder.join(ctx, channel)  # Передаем канал в метод join
    else:
        await ctx.send("❌ Вы не находитесь в голосовом канале!")

@bot.command()
async def leave(ctx):
    """Команда для выхода из голосового канала."""
    print('Запуск leave...')
    await audio_recorder.leave(ctx)

# Запуск бота
bot.run(BOT_TOKEN)
