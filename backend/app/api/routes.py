from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from speech_recognition.recognizers.whisper_api.groq import recognize

from ..models.request_models import *
from ..services.chat_context import ChatContextManager
from ..services.tts_generator import VoiceGenerator
from ..services.whisper_service import AzureSpeechService
from ..utils.speaker_utils import decode_speaker_name
from ..config import *

import numpy as np
import base64

router = APIRouter()

# Инициализация компонентов
voice_generator = VoiceGenerator()
chat_context = ChatContextManager()
recognize_service = AzureSpeechService(subscription_key=TTS_KEY, region=REGION)


@router.post("/reply")
async def reply(text_req: TextRequest):
    speaker = text_req.speaker.strip() or "Бро"
    text = text_req.text.strip().lower()
    response_text = await chat_context.get_response(f'[{speaker}]: {text}')
    return {"text": response_text or ""}


@router.post("/voice")
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


@router.post("/recognize")
async def recognize(request: Request, audio_data: AudioRequest):
    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"
    float_array = np.array(audio_data.audio, dtype=np.float32)
    result = recognize_service.transcribe(float_array)
    text = result.strip().lower()

    print(f"🎤 Распознанный текст от {speaker}: {text}")

    if any(phrase in text for phrase in BLOCKED_PHRASES):
        print("❌ Заблокировано по ключевому слову.")
        return StreamingResponse(iter([b""]), media_type="audio/wav")

    if any(phrase in text for phrase in ALLOWED_PHRASES):
        response_text = await chat_context.get_response(f'[{speaker}]: {text}')

        if response_text:
            return StreamingResponse(
                voice_generator.stream_voice(response_text),
                media_type="audio/wav",
                headers={"X-Content-Type-Options": "nosniff"}
            )

        return StreamingResponse(iter([b""]), media_type="audio/wav")