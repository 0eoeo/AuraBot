import asyncio
import os
import shutil
import discord.sinks
import generate_answer


class AudioRecorder(discord.Client):
    def __init__(self,  bot, recognizer, tts, **options):
        super().__init__(**options)
        self.bot = bot
        self.recognizer = recognizer
        self.tts = tts
        self.player = None
        self.voice_client = None
        self.gigachat = generate_answer.BotState()

    async def join(self, message):
        """Присоединение к голосовому каналу."""
        if not message.author.voice:
            await message.channel.send("⚠️ Ты не в голосовом канале!")
            return

        channel = message.author.voice.channel
        vc = await channel.connect()
        await message.channel.send(f"🔊 Подключился к {channel.name}")

        await self.listen_and_respond(vc)

    async def leave(self, ctx):
        """Выход из голосового канала."""
        if self.voice_client is not None:
            await self.voice_client.disconnect()
            self.voice_client = None
            await ctx.send("👋 Отошел от голосового канала.")
        else:
            await ctx.send("❌ Я не подключен к голосовому каналу.")

    async def listen_and_respond(self, vc):
        while True:
            sink = discord.sinks.WaveSink()  # WAV-формат записи

            vc.start_recording(
                sink,
                finished_callback=self.on_recording_finished,
                ctx=None
            )

            print("🎙️ Началась запись...")
            await asyncio.sleep(5)  # Записываем 5 секунд
            await vc.stop_recording()
            await asyncio.sleep(1)  # Небольшая пауза между циклами

    async def on_recording_finished(self, sink: discord.sinks.Sink, *args):
        if not sink.audio_data:
            print("⚠️ Нет записанных данных.")
            return

        # Берем первого записанного участника
        user_id, audio = next(iter(sink.audio_data.items()))
        file_path = f"temp_recording_{user_id}.wav"

        audio.file.seek(0)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        print(f"📁 Аудио сохранено: {file_path}")

        # Открываем файл и читаем как байты
        with open(file_path, "rb") as f:
            audio_bytes = f.read()

        # Отправляем на распознавание
        received_text = await self.recognizer.recognize(audio_bytes)

        if received_text:
            print(f"📝 Распознано: {received_text}")
            self.gigachat.append_context(received_text)
            answer = self.gigachat.get_response_text()
            print(f"📝 Ответ: {answer}")
            # Генерация ответа
            voice_path = await self.tts.create_voice_answer(answer)
            if voice_path:
                if self.player.is_playing():
                    self.player.stop()

                source = discord.FFmpegPCMAudio(voice_path)
                self.player.play(source)
                while self.player.is_playing():
                    await asyncio.sleep(1)

        # Удаляем временный файл
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"❌ Ошибка удаления файла: {e}")
