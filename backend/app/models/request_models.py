from pydantic import BaseModel
from typing import List

class TextRequest(BaseModel):
    speaker: str
    text: str

class VoiceRequest(BaseModel):
    text: str

class AudioRequest(BaseModel):
    audio: List[float]
