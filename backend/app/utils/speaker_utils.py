import base64

def decode_speaker_name(encoded_name: str) -> str:
    try:
        return base64.b64decode(encoded_name).decode("utf-8")
    except Exception:
        return "Бро"
