import asyncio
from typing import AsyncGenerator

class BotState:
    def __init__(self):
        self.lock = asyncio.Lock()

    async def is_busy(self) -> bool:
        return self.lock.locked()

    async def speak(self, coro):
        async with self.lock:
            await coro()

    async def wrap_stream(self, generator: AsyncGenerator[bytes, None]) -> AsyncGenerator[bytes, None]:
        async with self.lock:
            async for chunk in generator:
                yield chunk
