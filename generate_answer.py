from langchain.schema import HumanMessage, SystemMessage
from langchain_community.chat_models.gigachat import GigaChat
from pprint import pprint

class BotState:
    def __init__(self, credentials: str, max_history: int = 10):
        self.chat = GigaChat(credentials=credentials, verify_ssl_certs=False)
        self.messages = [
            SystemMessage(
                content="Тебя зовут Няру, тебе 23 года и ты парень. "
                        "У тебя весёлый и дружелюбный характер. "
                        "Ты любишь общаться с людьми."
                        "Ты находишься в голосовом чате с группой людей. Отвечай всем дружелюбно и поддерживай разговор."
                        "Отвечай на реплики участников с юмором и интересом, называй их по имени, если это уместно."
                        "Отвечай кратко."
            )
        ]
        self.max_history = max_history
        self.context_version = 0

    def append_context(self, message: str):
        print(f"👤 Пользователь {message}")
        self.context_version += 1
        if self.messages[-1].type == 'human':
            self.messages[-1].content += f" {message}"
        else:
            self.messages.append(HumanMessage(content=message))

        if len(self.messages) > self.max_history:
            self.messages = [self.messages[0]] + self.messages[-self.max_history:]

    def get_response_text(self):
        try:
            response = self.chat.invoke(self.messages)
            print(f"🤖 Бот: {response.content}")
            self.messages.append(response)
            return response.content
        except Exception as e:
            pprint(self.messages)
            print(f"❌ Ошибка GigaChat: {e}")
            return None