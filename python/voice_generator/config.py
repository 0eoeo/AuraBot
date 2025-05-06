import os
from dotenv import load_dotenv

load_dotenv()

GIGACHAT_TOKEN = os.getenv("GIGACHAT_TOKEN")
SPEAKER_WAV = "voice_banks/камелия.wav"
BLOCKED_PHRASES = [
    "динамичная музыка", "смех", "включи музыку", "сыграй песню",
    "ах ах ах", "ух ух ух", "спокойная музыка", "редактор субтитров"
]
ALLOWED_PHRASES = ["герт","хонкай","honkai"]