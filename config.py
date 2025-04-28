import os

from dotenv import load_dotenv

load_dotenv()


BOT_TOKEN = os.getenv("BOT_TOKEN")
RECOGNIZER_URL = "http://localhost:8000/recognize"
SPEAKER_WAV = "зани.wav"
GIGACHAT_TOKEN = os.getenv("GIGACHAT_TOKEN")
