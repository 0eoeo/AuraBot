import aiohttp
from config import RECOGNIZER_URL

class RecognizerClient:
    async def recognize(self, audio_data: bytes) -> str:
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(RECOGNIZER_URL, data=audio_data) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("text", "")
                    else:
                        print(f"Ошибка распознавания: {resp.status}")
                        return ""
            except Exception as e:
                print(f"❌ Ошибка отправки запроса: {e}")
                return ""
