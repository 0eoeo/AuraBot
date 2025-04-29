import numpy as np
import torch
import whisper
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import AsyncGenerator
from generate_answer import BotState
from voice import create_voice_answer_stream

app = FastAPI()
bot_state = BotState()
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

class AudioRequest(BaseModel):
    speaker: str
    audio: list[float]  # float32 PCM

@app.post("/recognize")
async def recognize(req: AudioRequest):
    speaker = req.speaker
    audio_np = np.array(req.audio, dtype=np.float32)

    # Распознавание речи
    result = model.transcribe(audio_np)
    text = result.get("text", "").strip()
    if not text:
        return StreamingResponse(iter([]), media_type="audio/wav")

    await bot_state.append_context(f"{speaker}: {text}")
    response = await bot_state.get_response_text()
    if not response:
        return StreamingResponse(iter([]), media_type="audio/wav")

    # Озвучка и потоковая передача
    async def audio_stream() -> AsyncGenerator[bytes, None]:
        async for chunk in create_voice_answer_stream(response):
            yield chunk

    return StreamingResponse(audio_stream(), media_type="audio/wav")
