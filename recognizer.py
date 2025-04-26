import os
import torch
import numpy as np
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse
import whisper
from dotenv import load_dotenv
import base64
import asyncio
import concurrent.futures

from voice import create_voice_answer
from generate_answer import BotState

# Загрузка переменных окружения
load_dotenv()

# Инициализация FastAPI
app = FastAPI()

# Инициализация модели Whisper
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

# Пул потоков для тяжёлых задач
executor = concurrent.futures.ThreadPoolExecutor()

# Заблокированные фразы
blocked_phrases = {
    "динамичная музыка", "редактор субтитров", "сильный шум",
    "без звука", "музыкальная заставка", "ах ах ах",
    "аплодисменты", "ух ух ух", "ха ха ха", "смех"
}

# Контекст GigaChat
giga_chat_context = BotState()


def decode_speaker_name(encoded_name: str) -> str:
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


async def transcribe_audio(model, audio_np: np.ndarray):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, lambda: model.transcribe(audio_np, language="ru"))


@app.post("/recognize")
async def recognize(request: Request, background_tasks: BackgroundTasks):
    # Декодирование имени спикера
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    print(f"📥 Получен запрос на распознавание от {speaker}")

    # Чтение тела запроса
    audio_data = await request.body()
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data provided")

    # Проверка минимальной длины аудиофайла (примерно 0.5 секунды)
    min_pcm_bytes = int(48000 * 2 * 2 * 0.5)
    if len(audio_data) < min_pcm_bytes:
        print("⚠️ Аудио слишком короткое. Пропускаем.")
        return '', 204

    # Конвертация raw PCM -> numpy
    try:
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        audio_np = audio_np.reshape(-1, 2).mean(axis=1)  # Стерео в моно
    except Exception as e:
        print(f"❌ Ошибка обработки аудио: {e}")
        raise HTTPException(status_code=400, detail="Некорректный аудиоформат")

    # Распознавание речи
    try:
        result = await transcribe_audio(model, audio_np)
    except Exception as e:
        print(f"❌ Ошибка распознавания: {e}")
        raise HTTPException(status_code=500, detail="Ошибка распознавания речи")

    recognized_text = result.get('text', '').strip()
    if not recognized_text:
        print("⚠️ Результат распознавания пустой.")
        return '', 204

    full_text = f"[{speaker}]: {recognized_text}"
    print(f"📝 {full_text}")

    # Проверка на блок-фразы
    lower_text = full_text.lower()
    if any(phrase in lower_text for phrase in blocked_phrases):
        print("🚫 Найдена блок-фраза. Контекст и ответ не будут обновлены.")
        return '', 204

    # Обновление контекста
    giga_chat_context.append_context(full_text)

    # Генерация текста-ответа
    response_text = giga_chat_context.get_response_text()
    if not response_text:
        raise HTTPException(status_code=500, detail="Ошибка при получении ответа от бота")

    # Генерация голосового ответа
    output_path = await create_voice_answer(response_text)
    if not output_path:
        raise HTTPException(status_code=500, detail="Ошибка при создании аудиофайла ответа")

    # Планируем фоновую очистку файлов
    background_tasks.add_task(cleanup, [output_path])

    return FileResponse(output_path, media_type="audio/wav", filename="response.wav")
