import re

from langchain_community.chat_models.gigachat import GigaChat
from langchain.schema import HumanMessage, SystemMessage
from ..config import GIGACHAT_TOKEN, OBSCENE_PATTERNS, OBSCENE_REPLACEMENTS


class ChatContextManager:
    def __init__(self):
        self.chat = GigaChat(credentials=GIGACHAT_TOKEN, verify_ssl_certs=False)
        self.messages = [
            SystemMessage(content=(
                "Тебя зовут Герта, тебе 18 лет. Ты девушка-кукла из Honkai Star Rail. "
                "У тебя весёлый и дружелюбный характер. "
                "Ты находишься в голосовом чате с группой людей. "
                "Отвечай с юмором и кратко, называй участников по имени."
                "Не указывай свое авторство в репликах."
            ))
        ]
        self.max_history = 10

    @staticmethod
    def find_obscene_words(text: str):
        matched_words = set()
        for pattern in OBSCENE_PATTERNS:
            for match in pattern.finditer(text):  # убрали `flags`
                matched_words.add(match.group().lower())
        return matched_words

    async def append(self, user_text: str):
        print(f"👤 Пользователь (до фильтра): {user_text}")

        for pattern, replacement in OBSCENE_REPLACEMENTS.items():
            user_text = re.sub(pattern, replacement, user_text, flags=re.IGNORECASE)

        user_text = re.sub(r'\s+', ' ', user_text).strip()  # Убираем лишние
        obscene_words = self.find_obscene_words(user_text)

        for word in obscene_words:
            user_text = re.sub(rf'\b{re.escape(word)}\b', '', user_text, flags=re.IGNORECASE)

        print(f"👤 Пользователь (после фильтра): {user_text}")

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
            return response.content.replace('Герта: ', ' ')
        except Exception as e:
            print(f"❌ Ошибка GigaChat: {e}")
            return None
