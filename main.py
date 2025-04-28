import discord
from audio_recorder import AudioRecorder
from recognizer_client import RecognizerClient
from tts_generator import TTSGenerator
from config import BOT_TOKEN

# recognizer = RecognizerClient()
# tts = TTSGenerator()

intents = discord.Intents.default()
intents.messages = True
intents.voice_states = True
intents.guilds = True
intents.members = True

client = discord.Client(intents=intents)

audio_recorder = AudioRecorder(None, None)

@client.event
async def on_ready():
    print(f"✅ Бот запущен как {client.user}")

@client.event
async def on_message(message):
    if message.author.bot:
        return

    if message.content.lower() == "!join":
        print('!!!!!!!!')
        await audio_recorder.join_and_listen(message)

client.run(BOT_TOKEN)
