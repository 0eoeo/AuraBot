import os
import uuid
import torch
from typing import AsyncGenerator
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs

torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

class VoiceGenerator:
    def __init__(self, speaker_wav: str, language: str = "ru", model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"):
        self.speaker_wav = speaker_wav
        self.language = language
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS(model_name=model_name)
        self.tts.to(self.device)

    def generate_to_file(self, text: str, output_path: str):
        self.tts.tts_to_file(
            text=text,
            speaker_wav=self.speaker_wav,
            language=self.language,
            file_path=output_path
        )

    async def stream_voice(self, text: str) -> AsyncGenerator[bytes, None]:
        output_filename = f"{uuid.uuid4().hex}.wav"
        output_path = os.path.join(os.getcwd(), output_filename)

        try:
            self.generate_to_file(text, output_path)

            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                print(f"❌ Проблема с файлом: {output_path}")
                return

            with open(output_path, "rb") as f:
                while chunk := f.read(1024):
                    if isinstance(chunk, bytes):
                        yield chunk
                    else:
                        print(f"⚠️ Неверный тип данных: {type(chunk)}")

        except Exception as e:
            print(f"❌ Ошибка TTS: {e}")
        finally:
            if os.path.exists(output_path):
                os.remove(output_path)
