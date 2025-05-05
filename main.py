import base64
import numpy as np
import torch
import whisper
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from python.voice_generator.context_manager import ChatContextManager
from python.voice_generator.voice_generator import VoiceGenerator
from python.voice_generator.config import SPEAKER_WAV, ALLOWED_PHRASES, BLOCKED_PHRASES

app = FastAPI()

# Инициализация компонентов
voice_generator = VoiceGenerator(speaker_wav=SPEAKER_WAV)
device = "cuda" if torch.cuda.is_available() else "cpu"
whisper_model = whisper.load_model("tiny", device=device)
chat_context = ChatContextManager()

# --- Модели запросов ---
class TextRequest(BaseModel):
    speaker: str
    text: str

class VoiceRequest(BaseModel):
    text: str

class AudioRequest(BaseModel):
    audio: list[float]

# --- Вспомогательная функция ---
def decode_speaker_name(encoded_name: str) -> str:
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"

# --- Ручка для получения ТЕКСТОВОГО ответа ---
@app.post("/reply")
async def reply(text_req: TextRequest):
    speaker = text_req.speaker.strip() or "Бро"
    text = text_req.text.strip().lower()

    print(f"💬 Сообщение от {speaker}: {text}")
    await chat_context.append(f"{speaker}: {text}")
    response_text = await chat_context.get_response()

    return {"text": response_text or ""}

# --- Ручка для получения ГОЛОСОВОГО ответа ---
@app.post("/voice")
async def voice(voice_req: VoiceRequest):
    text = voice_req.text.strip()
    if not text:
        return StreamingResponse(iter([b""]), media_type="audio/wav")

    return StreamingResponse(
        voice_generator.stream_voice(text),
        media_type="audio/wav",
        headers={"X-Content-Type-Options": "nosniff"}
    )

# --- Ручка для распознавания речи через Whisper ---
@app.post("/recognize")
async def recognize(request: Request, audio_data: AudioRequest):
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    audio_np = np.array(audio_data.audio, dtype=np.float32)
    result = whisper_model.transcribe(audio_np, language="ru")
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
