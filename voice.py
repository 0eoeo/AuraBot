import os
import torch
import uuid
import asyncio
import concurrent.futures
from typing import AsyncGenerator

from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs

torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
tts.to(device)

executor = concurrent.futures.ThreadPoolExecutor()
speaker_wav = "няру.wav"

def _generate_voice_sync(text: str, output_path: str):
    tts.tts_to_file(
        text=text,
        speaker_wav=speaker_wav,
        language="ru",
        file_path=output_path
    )

async def create_voice_answer_stream(text: str) -> AsyncGenerator[bytes, None]:
    output_filename = f"{uuid.uuid4().hex}.wav"
    output_path = os.path.join(os.getcwd(), output_filename)

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(executor, _generate_voice_sync, text, output_path)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            print("⚠️ Ошибка: файл не создан или пустой!")
            return

        print(f"🔊 Аудиофайл успешно сохранён в: {output_path}")

        async def file_streamer(path: str) -> AsyncGenerator[bytes, None]:
            with open(path, "rb") as f:
                while chunk := f.read(1024):
                    yield chunk
            os.remove(path)  # Удаляем файл после отправки

        async for chunk in file_streamer(output_path):
            yield chunk

    except Exception as e:
        print(f"❌ Ошибка при генерации речи: {e}")
        return
