import os
import torch
import numpy as np
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
import whisper
from dotenv import load_dotenv
import base64
import concurrent.futures
from voice import create_voice_answer
from generate_answer import BotState
from scipy.signal import resample

# Загрузка переменных окружения
load_dotenv()

# Инициализация FastAPI
app = FastAPI()

# Инициализация модели Whisper
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)
result = whisper.transcribe('няру.wav')
print('Результат прогрева: ', result["text"])

# Пул потоков для тяжёлых задач
executor = concurrent.futures.ThreadPoolExecutor()

# Контекст GigaChat
giga_chat_context = BotState()

# Заблокированные фразы
blocked_phrases = {"динамичная музыка", "редактор субтитров", "сильный шум",
                   "без звука", "музыкальная заставка", "ах ах ах", "аплодисменты",
                   "ух ух ух", "ха ха ха", "смех", "спокойная музыка"}


def decode_speaker_name(encoded_name: str) -> str:
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"


# Очистка временных файлов
def cleanup(paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Удалён файл: {path}")
        except Exception as e:
            print(f"⚠️ Не удалось удалить {path}: {e}")


# Нормализация аудио
def normalize_audio(audio_np: np.ndarray):
    max_val = np.max(np.abs(audio_np))
    if max_val > 0:
        audio_np = audio_np / max_val  # Нормализация в диапазоне от -1 до 1
    return audio_np


# Ресемплинг аудио
def resample_audio(audio_np: np.ndarray, target_rate: int, current_rate: int):
    num_samples = round(len(audio_np) * float(target_rate) / current_rate)
    resampled_audio = resample(audio_np, num_samples)
    return resampled_audio


# Асинхронное распознавание речи
async def transcribe_audio(model, audio_np: np.ndarray):
    # Преобразуем в формат, который воспринимает Whisper
    audio_np = normalize_audio(audio_np)  # Нормализуем
    audio_np = audio_np.astype(np.float32)

    # Если аудио с частотой не 16000 Гц, нужно выполнить ресемплинг
    current_rate = 48000  # Предположим, что изначальная частота дискретизации 48000 Гц
    target_rate = 16000  # Целевая частота для Whisper
    if current_rate != target_rate:
        audio_np = resample_audio(audio_np, target_rate, current_rate)

    # Преобразуем в нужный формат
    audio_tensor = torch.from_numpy(audio_np).to(device)

    # Используем Whisper для транскрибирования
    result = model.transcribe(audio_tensor)
    return result


# Генерация голосового ответа
async def generate_voice_answer(text: str):
    output_path = await create_voice_answer(text)
    if output_path:
        return output_path
    return None


# Основной рут для распознавания речи
@app.post("/recognize")
async def recognize(request: Request, background_tasks: BackgroundTasks):
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    print(f"📥 Получен запрос на распознавание от {speaker}")

    audio_data = await request.body()
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data provided")

    # Проверка на длину данных (например, 0.5 сек)
    min_pcm_bytes = int(48000 * 2 * 2 * 0.5)  # 48000 samples/sec * 2 bytes/sample * 2 channels * 0.5 sec
    if len(audio_data) < min_pcm_bytes:
        print("⚠️ Аудио слишком короткое. Пропускаем.")
        return '', 204

    # Преобразование raw PCM в numpy
    try:
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0  # Преобразуем в [-1, 1]
        audio_np = audio_np.reshape(-1, 2).mean(axis=1)  # Преобразуем стерео в моно
        audio_np = normalize_audio(audio_np)
    except Exception as e:
        print(f"❌ Ошибка обработки аудио: {e}")
        raise HTTPException(status_code=400, detail="Некорректный аудиоформат")

    # Асинхронное распознавание
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

    # Добавляем текст в контекст
    giga_chat_context.append_context(full_text)

    # Получаем ответ от GigaChat только если в тексте есть ключевые слова или вопрос
    if "зани" in full_text.lower() or "?" in full_text:
        response_text = giga_chat_context.get_response_text()
        if not response_text:
            cleanup([audio_data])
            raise HTTPException(status_code=500, detail="Ошибка при получении ответа от бота")

        # Генерация голосового ответа
        output_path = await generate_voice_answer(response_text)

        if output_path:
            background_tasks.add_task(cleanup, [audio_data, output_path])

            # Чтение файла по частям для потоковой передачи
            def iterfile():
                with open(output_path, mode="rb") as f:
                    while chunk := f.read(1024):  # Чтение файла кусками по 1024 байта
                        yield chunk

            return StreamingResponse(iterfile(), media_type="audio/wav",
                                     headers={"Content-Disposition": "attachment; filename=response.wav"})

    # Если слово "зани" или вопрос не найден, ничего не отвечаем
    print("🔎 Обращение 'Зани' или вопрос не найдено. Ответ не требуется.")
    return '', 204
