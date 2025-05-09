import os
import uuid
import azure.cognitiveservices.speech as speechsdk
from typing import AsyncGenerator
from ..config import TTS_KEY, REGION, SPEAKER

class VoiceGenerator:
    def __init__(self):
        self.api_key = TTS_KEY
        self.region = REGION
        self.synthesizer = None

    def _initialize_synthesizer(self, filename: str):
        print("🚀 Инициализация Azure TTS...")
        speech_config = speechsdk.SpeechConfig(subscription=self.api_key, region=self.region)
        speech_config.speech_synthesis_voice_name = SPEAKER
        audio_config = speechsdk.audio.AudioOutputConfig(filename=filename)
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
        print("💻 Azure TTS инициализировано.")
        return synthesizer

    def _generate_voice(self, text: str, filename: str):
        synthesizer = self._initialize_synthesizer(filename)
        result = synthesizer.speak_text_async(text).get()
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            print("Голос сгенерирован успешно.")
        else:
            raise Exception(f"Ошибка синтеза речи: {result.error_details}")

    async def stream_voice(self, text: str) -> AsyncGenerator[bytes, None]:
        filename = f"{uuid.uuid4().hex}.wav"
        filepath = os.path.join(os.getcwd(), filename)

        yield b""

        try:
            # Генерируем речь через Azure
            self._generate_voice(text, filepath)

            # Чтение сгенерированного WAV файла по частям
            with open(filepath, "rb") as f:
                while chunk := f.read(1024):
                    yield chunk
        except Exception as e:
            print(f"❌ Ошибка генерации: {e}")
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
