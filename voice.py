import os
import torch
import uuid
import asyncio
import concurrent.futures

from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs

# Разрешаем загрузку нестандартных классов
torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

# Инициализация модели при старте (на CPU или GPU)
device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
tts.to(device)

# Создаём executor для фона
executor = concurrent.futures.ThreadPoolExecutor()

# Путь к эталонному голосу
speaker_wav = "няру.wav"

# Синхронная функция генерации
def _generate_voice_sync(text: str, output_path: str):
    tts.tts_to_file(
        text=text,
        speaker_wav=speaker_wav,
        language="ru",
        file_path=output_path
    )

# Асинхронная обёртка
async def create_voice_answer(text: str) -> str:
    output_filename = f"{uuid.uuid4().hex}.wav"
    output_path = os.path.join(os.getcwd(), output_filename)

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(executor, _generate_voice_sync, text, output_path)

        if os.path.exists(output_path) and os.pathsize(output_path) > 0:
            print(f"🔊 Аудиофайл успешно сохранён в: {output_path}")
            return output_path
        else:
            print("⚠️ Ошибка: файл не создан или пустой!")
            return None
    except Exception as e:
        print(f"❌ Ошибка при генерации речи: {e}")
        return None
