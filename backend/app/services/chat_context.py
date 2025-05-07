import asyncio
import re

from PyCharacterAI import get_client
from PyCharacterAI.exceptions import SessionClosedError
from ..config import CHARACTER_AI_TOKEN, CHARACTER_ID

class ChatContextManager:
    def __init__(self):
        self.client = None
        self.chat = None
        self.me = None

    async def get_response(self, user_text: str):
        try:
            self.client = await get_client(token=CHARACTER_AI_TOKEN)
            self.me = await self.client.account.fetch_me()
            chat, greeting_message = await self.client.chat.create_chat(CHARACTER_ID)
            message = f"[{self.me.name}]: {user_text} Отвечай только на русском языке!"
            msg = await self.client.chat.send_message(CHARACTER_ID, chat.chat_id, message)
            response_text = msg.get_primary_candidate().text or ''
            # Удаляем всё в квадратных скобках, включая скобки
            cleaned_text = re.sub(r"\[.*?\]", "", response_text).strip()
            # Убираем начальные двоеточия, если остались
            cleaned_text = re.sub(r"^:+\s*", "", cleaned_text)
            # Удаляем повторяющиеся пробелы
            cleaned_text = re.sub(r"\s{2,}", " ", cleaned_text)
            return cleaned_text

        except SessionClosedError:
            print("Session closed")

    async def close(self):
        if self.client:
            print("Closing client session...")
            await self.client.close_session()
        else:
            print("Client session is already closed.")