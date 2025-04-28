import os
import torch
import uuid
import asyncio
import concurrent.futures
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs
from config import SPEAKER_WAV

# Разрешаем загрузку нестандартных классов
torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

# Инициализация
device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
tts.to(device)

executor = concurrent.futures.ThreadPoolExecutor()

class TTSGenerator:
    def __init__(self):
        self.tts = tts
        self.speaker_wav = SPEAKER_WAV

    def _generate_voice_sync(self, text: str, output_path: str):
        self.tts.tts_to_file(
            text=text,
            speaker_wav=self.speaker_wav,
            language="ru",
            file_path=output_path
        )

    async def create_voice_answer(self, text: str) -> str:
        output_filename = f"{uuid.uuid4().hex}.wav"
        output_path = os.path.join(os.getcwd(), output_filename)

        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(executor, self._generate_voice_sync, text, output_path)

            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"🔊 Аудиофайл сохранён: {output_path}")
                return output_path
            else:
                print("⚠️ Ошибка создания аудиофайла.")
                return None
        except Exception as e:
            print(f"❌ Ошибка генерации речи: {e}")
            return None
