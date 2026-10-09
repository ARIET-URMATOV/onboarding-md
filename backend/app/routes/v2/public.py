import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AppSetting

router = APIRouter(prefix="/public")

class IntroGoal(BaseModel):
    title: str
    text: str

class IntroGalleryItem(BaseModel):
    image: str = ""
    label: str = ""
    caption: str = ""
    alt: str = ""

class IntroContentOut(BaseModel):
    title: str
    mission: str
    values: list[str]
    instruction: str
    goals: list[IntroGoal] = []
    gallery: list[IntroGalleryItem] = []

DEFAULT_GOALS = [
    {"title": "Доступный финтех", "text": "Делаем банковские сервисы понятными — MBusiness для бизнеса, MPulse для каждого сотрудника и клиента."},
    {"title": "Скорость без хаоса", "text": "Быстрые решения, короткие циклы, ответственность за результат с первого дня."},
    {"title": "Команда рядом", "text": "Наставник, тимлид и HR ведут тебя через каждый этап — ты никогда не останешься один на один с вопросом."},
]

DEFAULT_GALLERY = [
    {"image": "", "label": "Конференция 1", "caption": "Наши выступления и митапы — фото скоро здесь.", "alt": "Фото конференции 1"},
    {"image": "", "label": "Конференция 2", "caption": "Хакатоны, демо-дни и жизнь команды — фото скоро здесь.", "alt": "Фото конференции 2"},
    {"image": "", "label": "Конференция 3", "caption": "Партнёрские события и отраслевые форумы — фото скоро здесь.", "alt": "Фото конференции 3"},
    {"image": "", "label": "Активность 4", "caption": "Внутренние события и традиции команды — фото скоро здесь.", "alt": "Фото активности 4"},
    {"image": "", "label": "Активность 5", "caption": "Спорт, выезды и неформальное общение — фото скоро здесь.", "alt": "Фото активности 5"},
]

def _parse_json_list(raw: str | None, default: list) -> list:
    if not raw:
        return default
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else default
    except Exception:
        return default

@router.get("/intro", response_model=IntroContentOut)
async def get_intro_content(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AppSetting).where(AppSetting.key.in_([
        "intro.title", "intro.mission", "intro.values", "intro.instruction",
        "intro.goals", "intro.gallery"
    ])))).scalars().all()

    stored = {r.key: r.value for r in rows}

    values_raw = stored.get("intro.values", '["Скорость", "Инновации", "Ответственность", "Команда"]')
    try:
        values = json.loads(values_raw)
    except Exception:
        values = ["Скорость", "Инновации", "Ответственность", "Команда"]

    return IntroContentOut(
        title=stored.get("intro.title", "Добро пожаловать в MDIGITAL"),
        mission=stored.get("intro.mission", "Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения, такие как MBusiness и MPulse. Твоя роль здесь очень важна."),
        values=values,
        instruction=stored.get("intro.instruction", "Заполни заявку, чтобы получить доступ к корпоративной сети и начать онбординг. Решение HR занимает до 2 рабочих дней. Как только мы будем готовы, ты получишь логин AD и пароль на указанную личную почту."),
        goals=_parse_json_list(stored.get("intro.goals"), DEFAULT_GOALS),
        gallery=_parse_json_list(stored.get("intro.gallery"), DEFAULT_GALLERY),
    )
