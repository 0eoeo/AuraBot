import os
import re

from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

GIGACHAT_TOKEN = os.getenv("GIGACHAT_TOKEN")
SPEAKER = "ru-RU-SvetlanaNeural"
BLOCKED_PHRASES = [
    "динамичная музыка", "смех", "включи музыку", "сыграй песню",
    "ах ах ах", "ух ух ух", "спокойная музыка", "редактор субтитров"
]
ALLOWED_PHRASES = ["бот", "вува", "сиськи", "госпожа"]

OBSCENE_PATTERNS = [re.compile(r'\b((?:(?:(?:у|[нз]а|(?:хитро|не)?вз?[ыьъ]|с[ьъ]|'
                               r'(?:и|ра)[зс]ъ?|(?:о[тб]|п[оа]д)[ьъ]?|(?:\S(?=[а-яё]))+?'
                               r'[оаеи-])-?)?(?:[её](?:б(?!о[рй]|рач)|п[уа](?:ц|тс))|и[п'
                               r'б][ае][тцд][ьъ]).*?|(?:(?:н[иеа]|(?:ра|и)[зс]|[зд]?[ао]'
                               r'(?:т|дн[оа])?|с(?:м[еи])?|а[пб]ч|в[ъы]?|пр[еи])-?)?ху(?'
                               r':[яйиеёю]|л+и(?!ган)).*?|бл(?:[эя]|еа?)(?:[дт][ьъ]?)?|'
                               r'\S*?(?:п(?:[иеё]зд|ид[аое]?р|ед(?:р(?!о)|[аое]р|ик)|оху'
                               r'ю)|бля(?:[дбц]|тс)|[ое]ху[яйиеё]|хуйн).*?|(?:о[тб]?|про'
                               r'|на|вы)?м(?:анд(?:[ауеыи](?:л(?:и[сзщ])?[ауеиы])?|ой|[а'
                               r'о]в.*?|юк(?:ов|[ауи])?|е[нт]ь|ища)|уд(?:[яаиое].+?|е?н('
                               r'?:[ьюия]|ей))|[ао]л[ао]ф[ьъ](?:[яиюе]|[еёо]й))|елд[ауые'
                               r'].*?|ля[тд]ь|(?:[нз]а|по)х))\b', re.IGNORECASE)]

OBSCENE_REPLACEMENTS = {
    re.compile(r"\bбляд\w*\b", flags=re.IGNORECASE): "солнце",
    re.compile(r"\bсу(ч|к)\w*\b", flags=re.IGNORECASE): "милашка",
    re.compile(r"\bх(у|у[йеёи])\w*\b", flags=re.IGNORECASE): "мрак",
    re.compile(r"\bпизд\w*\b", flags=re.IGNORECASE): "кошмар",
    re.compile(r"\bёб\w*\b", flags=re.IGNORECASE): "ой",
    re.compile(r"\bеб\w*\b", flags=re.IGNORECASE): "ой",
    re.compile(r"\bоху\w*\b", flags=re.IGNORECASE): "ого",
}

CHARACTER_AI_TOKEN = os.getenv("CHARACTER_AI_TOKEN")
CHARACTER_ID = os.getenv("CHARACTER_ID")
TTS_KEY = os.getenv("TTS_KEY")
REGION = os.getenv("REGION")