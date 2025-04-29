import os
import uuid
import asyncio
import aiofiles
from contextlib import asynccontextmanager

# Предыдущие импорты и инициализация tts остаются без изменений

CHUNK_SIZE = 4096  # или 8192, подбирается под нужную задержку

async def create_voice_answer_stream(text: str):
    output_filename = f"{uuid.uuid4().hex}.wav"
    output_path = os.path.join(os.getcwd(), output_filename)

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(executor, _generate_voice_sync, text, output_path)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            print("⚠️ Ошибка: файл не создан или пустой!")
            return

        async with aiofiles.open(output_path, "rb") as f:
            while True:
                chunk = await f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    except Exception as e:
        print(f"❌ Ошибка при генерации речи: {e}")
    finally:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as cleanup_error:
            print(f"⚠️ Ошибка при удалении файла: {cleanup_error}")
