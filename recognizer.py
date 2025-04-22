from flask import Flask, request, send_file, jsonify
import tempfile
import whisper
from pydub import AudioSegment
import os
import base64
import threading

from generate_answer import BotState
from voice import create_voice_answer

app = Flask(__name__)
model = whisper.load_model("tiny")

bot = BotState(credentials="ODQyZDA4ZWItYmZiOC00MWU1LWIzZTMtZj"
                           "IzNjc5N2RkZjc0OjY4YWZlNzMxLTg4Yzkt"
                           "NDgxNy05Yjk4LTY2ODNkYjMzMjAyMg==")

blocked_phrases = [
    "динамичная музыка",
    "редактор субтитров",
    "сильный шум",
    "без звука",
    "музыкальная заставка",
    "ах ах ах"
]

response_timer = None
response_lock = threading.Lock()
generated_audio_path = None
ready_to_send = False


def decode_speaker_name(encoded_name):
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"


def cleanup(paths):
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Удалён файл: {path}")
        except Exception as e:
            print(f"⚠️ Не удалось удалить {path}: {e}")


def reset_response_timer():
    global response_timer, generated_audio_path, ready_to_send
    current_version = bot.context_version

    def generate():
        nonlocal current_version
        if current_version != bot.context_version:
            print(f"⏩ Контекст изменился (было {current_version}, стало {bot.context_version}) — пропускаем ответ")
            return

        print("🧠 Пауза соблюдена, генерирую голосовой ответ")
        response_text = bot.get_response_text()
        if response_text:
            generated_audio_path = create_voice_answer(response_text)
            if generated_audio_path:
                print(f"✅ Ответ сгенерирован: {generated_audio_path}")
                ready_to_send = True  # 🔔 Устанавливаем флаг
            else:
                print("⚠️ Ошибка при создании голосового ответа")
        else:
            print("⚠️ Пустой ответ от GigaChat")

    with response_lock:
        if response_timer:
            response_timer.cancel()
        response_timer = threading.Timer(1.0, generate)
        response_timer.start()

@app.route('/recognize', methods=['POST'])
def recognize():
    global response_timer, generated_audio_path, ready_to_send

    speaker_b64 = request.headers.get("X-Speaker-Name")
    speaker = decode_speaker_name(speaker_b64) if speaker_b64 else "Бро"

    print(f"📥 Получен запрос на распознавание от {speaker}")
    audio_data = request.data
    if not audio_data:
        return jsonify(error="No audio data provided"), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pcm") as tmp_pcm:
        pcm_path = tmp_pcm.name
        tmp_pcm.write(audio_data)

    wav_path = pcm_path + ".wav"

    try:
        pcm_audio = AudioSegment.from_file(
            pcm_path,
            format="raw",
            frame_rate=48000,
            channels=2,
            sample_width=2
        )
        pcm_audio.export(wav_path, format="wav")

        if len(pcm_audio) < 500:
            print("⚠️ Аудио слишком короткое. Пропускаем.")
            cleanup([pcm_path, wav_path])
            return '', 204

        result = model.transcribe(wav_path, language="ru")
        text = result.get('text', '').strip()
        print(f"📝 {speaker}: {text}")

        if not text:
            cleanup([pcm_path, wav_path])
            return '', 204

        text_lower = text.lower()
        if not any(phrase in text_lower for phrase in blocked_phrases):
            bot.append_context(f"{speaker}: {text}")
            reset_response_timer()
        else:
            print("⛔ Обнаружена стоп-фраза — пропуск контекста")

        cleanup([pcm_path, wav_path])

        # if ready_to_send and generated_audio_path:
        try:
            print(f"📤 Отправляю аудиофайл: {generated_audio_path}")
            output_path = generated_audio_path
            generated_audio_path = None
            ready_to_send = False  # Сброс флага
            return send_file('output.wav', mimetype="audio/wav", as_attachment=True)
        except:
            return '', 204
    except Exception as e:
        print("❌ Ошибка при обработке аудио:", e)
        cleanup([pcm_path, wav_path])
        return jsonify(error=str(e)), 500
    finally:
        cleanup(['output.wav'])


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
