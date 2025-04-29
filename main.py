import numpy as np
from fastapi import FastAPI
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

class AudioRequest(BaseModel):
    speaker: str
    audio: list[float]

@app.post("/recognize")
async def recognize(req: AudioRequest):
    speaker = req.speaker
    audio_np = np.array(req.audio, dtype=np.float32)

    result = model.transcribe(audio_np, language="ru")
    text = result.get("text", "").strip()
    if not text:
        return StreamingResponse(iter([]), media_type="audio/wav")

    if "динамичная музыка" not in text.lower():
        await bot_state.append_context(f"{speaker}: {text}")
        response_text = await bot_state.get_response_text()
        if not response_text:
            return StreamingResponse(iter([]), media_type="audio/wav")

        return StreamingResponse(
            create_voice_answer_stream(response_text),
            media_type="audio/wav"
        )
    else:
        return StreamingResponse(iter([]), media_type="audio/wav")
