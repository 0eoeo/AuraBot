import os
import torch
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydub import AudioSegment
import tempfile
import whisper
from dotenv import load_dotenv
from TTS.api import TTS
import base64

from voice import create_voice_answer

# Загрузка переменных окружения из .env
load_dotenv()

# Инициализация FastAPI
app = FastAPI()

# Инициализация модели Whisper для распознавания речи
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

# Загружаем модель для генерации речи
torch.serialization.add_safe_globals(["XttsConfig", "XttsAudioConfig", "BaseDatasetConfig", "XttsArgs"])
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")

# Инициализация переменных
blocked_phrases = [
    "динамичная музыка", "редактор субтитров", "сильный шум",
    "без звука", "музыкальная заставка", "ах ах ах"
]

# Функция для декодирования имени говорящего
def decode_speaker_name(encoded_name):
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"

# Функция для очистки временных файлов
def cleanup(paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Удалён файл: {path}")
        except Exception as e:
            print(f"⚠️ Не удалось удалить {path}: {e}")

@app.post("/recognize")
async def recognize(request: Request, background_tasks: BackgroundTasks):
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    print(f"📥 Получен запрос на распознавание от {speaker}")
    audio_data = await request.body()  # асинхронно получаем тело запроса
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data provided")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pcm") as tmp_pcm:
        pcm_path = tmp_pcm.name
        tmp_pcm.write(audio_data)

    wav_path = pcm_path + ".wav"

    pcm_audio = AudioSegment.from_file(
        pcm_path,
        format="raw",
        frame_rate=48000,
        channels=2,
        sample_width=2
    )
    pcm_audio.export(wav_path, format="wav")

    if len(pcm_audio) < 500:
        print("⚠️ Аудио слишком короткое. Пропускаем.")
        cleanup([pcm_path, wav_path])
        return '', 204

    if not os.path.exists(wav_path):
        print("❌ WAV-файл не найден после экспорта")
        cleanup([pcm_path])
        raise HTTPException(status_code=500, detail="WAV-файл не найден")

    # Распознавание текста
    result = model.transcribe(wav_path, language="ru")
    text = result.get('text', '').strip()
    print(f"📝 {speaker}: {text}")

    if not text:
        cleanup([pcm_path, wav_path])
