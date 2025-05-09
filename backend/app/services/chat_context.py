import re

from langchain.schema import HumanMessage, SystemMessage
from langchain_community.chat_models.gigachat import GigaChat
from ..config import GIGACHAT_TOKEN, OBSCENE_PATTERNS, OBSCENE_REPLACEMENTS


class ChatContextManager:
    def __init__(self):
        self.chat = GigaChat(credentials=GIGACHAT_TOKEN, verify_ssl_certs=False)
        self.messages = [
            SystemMessage(
                content=(
                    "Тебя зовут Инлинь, тебе 25 лет. Ты девушка из Wuthering Waves. "
                    "Ты очень уверенная и яркая женщина. "
                    "Ты находишься в голосовом чате с группой людей. "
                    "Отвечай с юмором и кратко, называй участников по имени."
                    "Не называй свое авторство в репликах, "
                    "например 'Инлинь: Привет' быть не должно, должно быть просто Привет."
                )
            )
        ]
        self.max_history = 10

    @staticmethod
    def find_obscene_words(text: str):
        matched_words = set()
        for pattern in OBSCENE_PATTERNS:
            for match in pattern.finditer(text):
                matched_words.add(match.group().lower())
        return matched_words

    async def get_response(self, user_text: str):
        try:
            print(f"👤 Пользователь (до фильтра): {user_text}")

            # Заменяем мат на аналоги
            for pattern, replacement in OBSCENE_REPLACEMENTS.items():
                user_text = pattern.sub(replacement, user_text)

            # Удаляем остаточные грубости (если остались)
            obscene_words = self.find_obscene_words(user_text)
            for word in obscene_words:
                user_text = re.sub(rf'\b{re.escape(word)}\b', '', user_text, flags=re.IGNORECASE)

            # Чистим пробелы
            user_text = re.sub(r'\s+', ' ', user_text).strip()

            print(f"👤 Пользователь (после фильтра): {user_text}")
            if self.messages[-1].type == 'human':
                self.messages[-1].content += f" {user_text}"
            else:
                self.messages.append(HumanMessage(content=user_text))

            if len(self.messages) > self.max_history:
                self.messages = [self.messages[0]] + self.messages[-self.max_history:]

            response = self.chat.invoke(self.messages)
            print(f"🤖 Бот: {response.content}")
            self.messages.append(response)
            return response.content
        except Exception as e:
            print(f"❌ Ошибка GigaChat: {e}")
            return None