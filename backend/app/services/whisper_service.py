import azure.cognitiveservices.speech as speechsdk
import numpy as np
import wave
import io

class CustomAudioStream(speechsdk.audio.PullAudioInputStreamCallback):
    def __init__(self, wav_stream: io.BytesIO):
        super().__init__()
        self.wav_stream = wav_stream

    def read(self, buffer: memoryview) -> int:
        data = self.wav_stream.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)

    def close(self):
        self.wav_stream.close()

class AzureSpeechService:
    def __init__(self, subscription_key: str, region: str):
        self.speech_config = speechsdk.SpeechConfig(subscription=subscription_key, region=region)
        self.speech_config.speech_recognition_language = "ru-RU"

    def _numpy_to_wav_bytes(self, audio_array: np.ndarray, sample_rate: int = 16000) -> bytes:
        # Приведение к int16
        audio_array = np.int16(audio_array * 32767)
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_array.tobytes())
            return wav_io.getvalue()

    def transcribe(self, audio_array: np.ndarray, original_sample_rate: int = 48000) -> str:
        # Ресемплирование с 48 кГц до 16 кГц
        target_len = int(len(audio_array) * 16000 / original_sample_rate)
        audio_16k = np.interp(np.linspace(0, len(audio_array), target_len), np.arange(len(audio_array)), audio_array)

        wav_bytes = self._numpy_to_wav_bytes(audio_16k)

        # Создание PullAudioInputStream из байтов
        stream_format = speechsdk.audio.AudioStreamFormat(samples_per_second=16000, bits_per_sample=16, channels=1)
        push_stream = speechsdk.audio.PushAudioInputStream(stream_format=stream_format)
        push_stream.write(wav_bytes)
        push_stream.close()

        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
        recognizer = speechsdk.SpeechRecognizer(speech_config=self.speech_config, audio_config=audio_config)

        result = recognizer.recognize_once()
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return result.text
        else:
            print(f"Azure Error: {result.reason}")
            return ""
