from langchain.schema import HumanMessage, SystemMessage
from langchain_community.chat_models.gigachat import GigaChat
from .config import GIGACHAT_TOKEN

class ChatContextManager:
    def __init__(self):
        self.chat = GigaChat(credentials=GIGACHAT_TOKEN, verify_ssl_certs=False)
        self.messages = [
            SystemMessage(
                content=(
                    "Тебя зовут Герта, тебе 18 лет. Ты девушка-кукла из Honkai Star Rail. "
                    "У тебя весёлый и дружелюбный характер. "
                    "Ты находишься в голосовом чате с группой людей. "
                    "Отвечай с юмором и кратко, называй участников по имени."
                )
            )
        ]
        self.max_history = 10
        self.context_version = 0

    async def append(self, user_text: str):
        self.context_version += 1
        print(f"👤 Пользователь: {user_text}")
        if self.messages[-1].type == 'human':
            self.messages[-1].content += f" {user_text}"
        else:
            self.messages.append(HumanMessage(content=user_text))

        if len(self.messages) > self.max_history:
            self.messages = [self.messages[0]] + self.messages[-self.max_history:]

    async def get_response(self):
        try:
            response = self.chat.invoke(self.messages)
            print(f"🤖 Бот: {response.content}")
            self.messages.append(response)
            return response.content
        except Exception as e:
            print(f"❌ Ошибка GigaChat: {e}")
            return None
