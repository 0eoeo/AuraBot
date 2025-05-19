import re
from pprint import pprint

import requests
import shutil
from langchain.schema import HumanMessage, SystemMessage
from langchain_community.chat_models.gigachat import GigaChat
from gigachat import GigaChat as gc
from backend.app.config import GIGACHAT_TOKEN, OBSCENE_PATTERNS, OBSCENE_REPLACEMENTS


class ChatContextManager:
    def __init__(self):
        self.chat = GigaChat(credentials=GIGACHAT_TOKEN, verify_ssl_certs=False)
        self.giga = gc(
            credentials=GIGACHAT_TOKEN, verify_ssl_certs=False
        ).get_token()
        self.token = self.giga.access_token
        self.messages = [
            SystemMessage(
                content=(
                    "Тебя зовут Инлинь, тебе 25 лет. Ты девушка из Wuthering Waves. "
                    "Ты очень уверенная и яркая женщина. "
                    "Ты находишься в голосовом чате с группой людей. "
                    "Отвечай с юмором и кратко, называй участников по имени. "
                    "Не называй свое авторство в репликах."
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

    def generate_image(self, prompt: str) -> str:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.token}',
        }

        json_data = {
            'model': 'GigaChat-Pro-preview',
            'messages': [{'role': 'user', 'content': prompt}],
            'function_call': 'auto',
        }

        response = requests.post(
            'https://gigachat-preview.devices.sberbank.ru/api/v1/chat/completions',
            headers=headers,
            json=json_data,
            verify=False
        )

        if response.status_code == 200:
            data = response.json()
            content = data['choices'][0]['message']['content']
            match = re.search(r'<img src="([^"]+)"', content)
            if not match:
                raise ValueError("Не удалось найти ссылку на изображение в ответе GigaChat")

            file_id = match.group(1)
            img_url = f"https://gigachat.devices.sberbank.ru/api/v1/files/{file_id}/content"

            img_response = requests.get(img_url, headers={
                'Accept': 'application/jpg',
                'Authorization': f'Bearer {self.token}'
            }, stream=True, verify=False)

            file_path = f"{file_id}.jpg"
            with open(file_path, 'wb') as out_file:
                shutil.copyfileobj(img_response.raw, out_file)

            return file_path

        raise RuntimeError("GigaChat image generation failed")

    async def get_response(self, user_text: str):
        try:
            print(f"👤 Пользователь (до фильтра): {user_text}")

            for pattern, replacement in OBSCENE_REPLACEMENTS.items():
                user_text = pattern.sub(replacement, user_text)

            obscene_words = self.find_obscene_words(user_text)
            for word in obscene_words:
                user_text = re.sub(rf'\b{re.escape(word)}\b', '', user_text, flags=re.IGNORECASE)

            user_text = re.sub(r'\s+', ' ', user_text).strip()

            print(f"👤 Пользователь (после фильтра): {user_text}")

            if "нарисуй" in user_text.lower():
                image_path = self.generate_image(user_text)
                print(f"🖼 Сгенерирована картинка: {image_path}")
                return {"type": "image", "content": image_path}

            if self.messages[-1].type == 'human':
                self.messages[-1].content += f" {user_text}"
            else:
                self.messages.append(HumanMessage(content=user_text))

            if len(self.messages) > self.max_history:
                self.messages = [self.messages[0]] + self.messages[-self.max_history:]

            response = self.chat.invoke(self.messages)
            print(f"🤖 Бот: {response.content}")
            self.messages.append(response)

            return {"type": "text", "content": response.content}
        except Exception as e:
            print(f"❌ Ошибка GigaChat: {e}")
            return None