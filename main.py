import base64
import numpy as np
import torch
import whisper
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from scipy.signal import resample

from python.voice_generator.context_manager import ChatContextManager
from python.voice_generator.voice_generator import VoiceGenerator
from python.voice_generator.config import SPEAKER_WAV, ALLOWED_PHRASES, BLOCKED_PHRASES

app = FastAPI()

# Инициализация компонентов
voice_generator = VoiceGenerator(speaker_wav=SPEAKER_WAV)
device = "cuda" if torch.cuda.is_available() else "cpu"
chat_context = ChatContextManager()

# Переменная для хранения модели
whisper_model = None

# --- Модели запросов ---
class TextRequest(BaseModel):
    speaker: str
    text: str

class VoiceRequest(BaseModel):
    text: str

class AudioRequest(BaseModel):
    audio: list[float]

def decode_speaker_name(encoded_name: str) -> str:
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"

# Загрузка модели только при первом вызове метода /recognize
def load_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("tiny", device=device)
        print("💻 Модель Whisper загружена.")
    return whisper_model

@app.post("/reply")
async def reply(text_req: TextRequest):
    speaker = text_req.speaker.strip() or "Бро"
    text = text_req.text.strip().lower()

    print(f"💬 Сообщение от {speaker}: {text}")
    await chat_context.append(f"{speaker}: {text}")
    response_text = await chat_context.get_response()

    return {"text": response_text or ""}

@app.post("/voice")
async def voice(voice_req: VoiceRequest):
    text = voice_req.text.strip()
    if not text:
        return StreamingResponse(iter([b""]), media_type="audio/wav")

    encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
    return StreamingResponse(
        voice_generator.stream_voice(text),
        media_type="audio/wav",
        headers={
            "X-Content-Type-Options": "nosniff",
            "X-Generated-Text": encoded
        }
    )

@app.post("/recognize")
async def recognize(request: Request, audio_data: AudioRequest):
    # Загружаем модель, если она ещё не была загружена
    whisper_model = load_whisper_model()

    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    float_array = np.array(audio_data.audio, dtype=np.float32)
    target_len = int(len(float_array) * 16000 / 48000)
    audio_16k = resample(float_array, target_len)

    result = whisper_model.transcribe(audio_16k, language="ru")
    text = result.get("text", "").strip().lower()
    print(f"🎤 Распознанный текст от {speaker}: {text}")

    if any(phrase in text for phrase in BLOCKED_PHRASES):
        print("❌ Заблокировано по ключевому слову.")
        return StreamingResponse(iter([b""]), media_type="audio/wav")

    if any(phrase in text for phrase in ALLOWED_PHRASES):
        await chat_context.append(f"{speaker}: {text}")
        response_text = await chat_context.get_response()

        if response_text:
            return StreamingResponse(
                voice_generator.stream_voice(response_text),
                media_type="audio/wav",
                headers={"X-Content-Type-Options": "nosniff"}
            )

    return StreamingResponse(iter([b""]), media_type="audio/wav")
