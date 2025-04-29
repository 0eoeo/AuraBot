import io
import wave
import numpy as np
import torch
import whisper
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from generate_answer import BotState

app = FastAPI()
bot_state = BotState()
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("tiny", device=device)

class AudioRequest(BaseModel):
    speaker: str
    audio: list[float]  # PCM в формате float32

def create_voice_answer_stream(text: str):
    """
    Функция генерирует аудио (WAV) с синусоидальным сигналом в качестве примера.
    Замените эту часть на вызов вашей TTS-системы.
    """
    sample_rate = 16000
    duration = 1.0  # длительность аудио в секундах
    frequency = 440.0  # частота сигнала в Гц

    # Генерируем синусоидальный сигнал
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    audio_data = 0.5 * np.sin(2 * np.pi * frequency * t)

    # Преобразуем в 16-битный PCM
    audio_int16 = (audio_data * 32767).astype(np.int16)

    # Записываем аудио в формат WAV в буфер
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16 бит = 2 байта
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    buffer.seek(0)

    # Читаем аудио чанками по 8192 байта
    chunk_size = 8192
    while True:
        chunk = buffer.read(chunk_size)
        if not chunk:
            break
        yield chunk

@app.post("/recognize")
async def recognize(req: AudioRequest):
    speaker = req.speaker
    audio_np = np.array(req.audio, dtype=np.float32)

    result = model.transcribe(audio_np, language="ru")
    text = result.get("text", "").strip()
    if not text:
        return StreamingResponse(iter([]), media_type="audio/wav")

    await bot_state.append_context(f"{speaker}: {text}")
    response_text = await bot_state.get_response_text()
    if not response_text:
        return StreamingResponse(iter([]), media_type="audio/wav")

    return StreamingResponse(
        create_voice_answer_stream(response_text),
        media_type="audio/wav"
    )
