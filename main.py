import discord
from discord.ext import commands
from audio_recorder import AudioRecorder
from recognizer_client import RecognizerClient
from tts_generator import TTSGenerator
from config import BOT_TOKEN

recognizer = RecognizerClient()
tts = TTSGenerator()

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.voice_states = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

audio_recorder = AudioRecorder(bot, 'recognizer', 'tts')

@bot.event
async def on_ready():
    print(f"✅ Бот запущен как {bot.user}")

@bot.event
async def on_message(message):
    if message.author.bot:
        return
    if message.content.lower() == "!join":
        await audio_recorder.join(message)

@bot.command()
async def leave(ctx):
    """Команда для выхода из голосового канала."""
    await audio_recorder.leave(ctx)

bot.run(BOT_TOKEN)
