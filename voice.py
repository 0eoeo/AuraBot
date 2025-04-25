import os

import torch
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.models.xtts import XttsArgs

# Разрешаем загрузку нестандартных классов
torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

# Загружаем модель (на CPU)
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)


def create_voice_answer(text,device="cuda"):
    speaker_wav = "няру.wav"
    output_path = "output.wav"

    try:
        tts.to(device)
        tts.tts_to_file(
            text=text,
            speaker_wav=speaker_wav,
            language="ru",
            file_path=output_path
        )

        # Проверяем, создан ли файл и не пустой ли он
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"🔊 Аудиофайл сохранён в: {output_path}")
            return output_path
        else:
            print("⚠️ Файл не создан или пустой!")
            return None

    except Exception as e:
        print(f"❌ Ошибка генерации речи: {e}")
        return None
# create_voice_answer('любая хуйня')