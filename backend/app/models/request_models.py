from pydantic import BaseModel
from typing import List

class TextRequest(BaseModel):
    speaker: str
    text: str

class VoiceRequest(BaseModel):
    text: str

class AudioRequest(BaseModel):
    audio: List[float]

class Planet(BaseModel):
    name: str
    sign: str
    deg: float
    retro: bool

class HoroscopeRequest(BaseModel):
    planets: List[Planet]