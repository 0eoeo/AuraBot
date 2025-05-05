import os
import re
import uuid
import torch
from typing import AsyncGenerator
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs

torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

class VoiceGenerator:
    def __init__(self, speaker_wav: str):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
        self.tts.to(self.device)
        self.speaker_wav = speaker_wav

    def _generate_segment(self, segment_text: str, path: str):
        self.tts.tts_to_file(
            text=segment_text,
            speaker_wav=self.speaker_wav,
            language="ru",
            file_path=path
        )

    async def stream_voice(self, text: str) -> AsyncGenerator[bytes, None]:
        filename = f"{uuid.uuid4().hex}.wav"
        filepath = os.path.join(os.getcwd(), filename)

        yield b""

        try:
            self.tts.tts_to_file(
                text=text,
                speaker_wav=self.speaker_wav,
                language="ru",
                file_path=filepath
            )
            with open(filepath, "rb") as f:
                while chunk := f.read(1024):
                    yield chunk
        except Exception as e:
            print(f"❌ Ошибка генерации: {e}")
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
