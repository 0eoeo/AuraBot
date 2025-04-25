import os
import base64
import tempfile
import asyncio
from typing import Optional

from fastapi import FastAPI, Request, BackgroundTasks, Header
from fastapi.responses import FileResponse, JSONResponse
from pydub import AudioSegment
from dotenv import load_dotenv

import whisper
import torch

from generate_answer import BotState
from voice import create_voice_answer

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

app = FastAPI()

blocked_phrases = [
    "динамичная музыка", "редактор субтитров", "сильный шум",
    "без звука", "музыкальная заставка", "ах ах ах"
]


def decode_speaker_name(encoded_name: Optional[str]) -> str:
    if not encoded_name:
        return "Бро"
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"


def cleanup(paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Удалён файл: {path}")
        except Exception as e:
            print(f"⚠️ Не удалось удалить {path}: {e}")


async def generate_voice_answer(bot: BotState, context_version: int):
    await asyncio.sleep(1.0)
    if bot.context_version != context_version:
        print("⏩ Контекст изменился — генерация отменена")
        return

    print("🧠 Генерирую голосовой ответ")
    text = bot.get_response_text()
    if not text:
        print("⚠️ Пустой ответ от GigaChat")
        return

    output_path = "output.wav"
    path = create_voice_answer(text, device=device)

    if path and os.path.exists(path):
        print(f"✅ Ответ сгенерирован: {output_path}")
    else:
        print("⚠️ Не удалось создать аудио")


@app.post("/recognize")
async def recognize_audio(
    request: Request,
    background_tasks: BackgroundTasks,
    x_speaker_name: Optional[str] = Header(None)
):
    speaker = decode_speaker_name(x_speaker_name)
    print(f"📥 Запрос от: {speaker}")

    body = await request.body()
    if not body:
        return JSONResponse(content={"error": "Нет аудиоданных"}, status_code=400)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pcm") as tmp_pcm:
        tmp_pcm.write(body)
        pcm_path = tmp_pcm.name

    wav_path = pcm_path + ".wav"

    try:
        pcm_audio = AudioSegment.from_file(
            pcm_path, format="raw", frame_rate=48000, channels=2, sample_width=2
        )
        pcm_audio.export(wav_path, format="wav")
    except Exception as e:
        print("❌ Ошибка при обработке PCM:", e)
        cleanup([pcm_path])
        return JSONResponse(content={"error": "Ошибка при обработке PCM"}, status_code=500)

    if len(pcm_audio) < 500:
        print("⚠️ Аудио слишком короткое")
        cleanup([pcm_path, wav_path])
        return JSONResponse(content={"error": "Аудио слишком короткое"}, status_code=204)

    result = model.transcribe(wav_path, language="ru")
    text = result.get("text", "").strip()
    print(f"📝 {speaker}: {text}")

    cleanup([pcm_path, wav_path])

    if not text:
        return JSONResponse(content={"error": "Пустая транскрипция"}, status_code=204)

    if any(phrase in text.lower() for phrase in blocked_phrases):
        print("⛔ Стоп-фраза. Пропускаем.")
        return JSONResponse(content={"message": "Стоп-фраза"}, status_code=204)

    bot = BotState(credentials=BOT_TOKEN)
    bot.append_context(f"{speaker}: {text}")
    background_tasks.add_task(generate_voice_answer, bot, bot.context_version)

    # Пытаемся отправить предыдущий результат, если есть
    if os.path.exists("output.wav"):
        print("📤 Отправка output.wav")
        response = FileResponse("output.wav", media_type="audio/wav", filename="response.wav")
        background_tasks.add_task(cleanup, ["output.wav"])
        return response

    return JSONResponse(content={"message": "Ожидаем ответ"}, status_code=204)
