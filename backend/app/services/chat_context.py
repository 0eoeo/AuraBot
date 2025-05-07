import asyncio
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

            message = f"[{self.me.name}]: {user_text} Ответь на русском!"
            msg = await self.client.chat.send_message(CHARACTER_ID, chat.chat_id, message)

            candidate = msg.get_primary_candidate()
            try:
                text = str(candidate.text).split(": ", 1)[1]
            except:
                text = str(candidate.text)
            print(text)
            return msg.turn_id, candidate.candidate_id, text

        except SessionClosedError:
            print("Session closed")

    async def close(self):
        if self.client:
            print("Closing client session...")
            await self.client.close_session()
        else:
            print("Client session is already closed.")