import whisper
import numpy as np
from scipy.signal import resample

class WhisperService:
    def __init__(self, device: str = "cpu"):
        self.model = whisper.load_model("tiny", device=device)

    def transcribe(self, audio_array: np.ndarray) -> str:
        target_len = int(len(audio_array) * 16000 / 48000)
        audio_16k = resample(audio_array, target_len)

        result = self.model .transcribe(audio_16k, language="ru")
        text = result.get("text", "").strip().lower()
        return text
