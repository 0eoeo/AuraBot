import base64

import numpy as np
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from generate_answer import BotState
from voice import create_voice_answer_stream
import torch
import whisper

app = FastAPI()
bot_state = BotState()
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

# 🔒 Фразы, при наличии которых ответ НЕ должен генерироваться
BLOCKED_PHRASES = [
    "динамичная музыка",
    "смех",
    "включи музыку",
    "сыграй песню",
    "ах ах ах",
    "ух ух ух",
    "спокойная музыка",
    "редактор субтитров"
]

# ✅ Фразы, при наличии которых текст разрешено отправить на генерацию ответа
ALLOWED_PHRASES = [
    "герта",
    "?"
]

class AudioRequest(BaseModel):
    audio: list[float]

def decode_speaker_name(encoded_name: str) -> str:
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"

@app.post("/recognize")
async def recognize(request: Request, audio_data: AudioRequest):
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    audio_np = np.array(audio_data.audio, dtype=np.float32)

    result = model.transcribe(audio_np, language="ru")
    text = result.get("text", "").strip().lower()
    print(f"🎤 Распознанный текст от {speaker}: {text}")

    # Блокируем по ключевым фразам
    if any(phrase in text for phrase in BLOCKED_PHRASES):
        print("🚫 Заблокировано по ключевому слову.")
        return StreamingResponse(iter([]), media_type="audio/wav")

    # Обрабатываем только если есть подходящая фраза
    if any(phrase in text for phrase in ALLOWED_PHRASES):
        await bot_state.append_context(f"{speaker}: {text}")
        response_text = await bot_state.get_response_text()

        if response_text:
            return StreamingResponse(
                create_voice_answer_stream(response_text),
                media_type="audio/wav"
            )

    # По умолчанию — ничего не делать
    return StreamingResponse(iter([]), media_type="audio/wav")
