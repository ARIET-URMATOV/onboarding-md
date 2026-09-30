from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/public")

class IntroContentOut(BaseModel):
    title: str
    mission: str
    values: list[str]
    instruction: str

@router.get("/intro", response_model=IntroContentOut)
async def get_intro_content():
    # In a fully realized V2, this could fetch from `app_settings` or `stages` table (FR-102)
    # For now, we return the hardcoded base per requirements to enable frontend
    return IntroContentOut(
        title="Добро пожаловать в MDIGITAL",
        mission="Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения, такие как MBusiness и MPulse. Твоя роль здесь очень важна.",
        values=["Скорость", "Инновации", "Ответственность", "Команда"],
        instruction="Заполни заявку, чтобы получить доступ к корпоративной сети и начать онбординг. Решение HR занимает до 2 рабочих дней. Как только мы будем готовы, ты получишь логин AD и пароль на указанную личную почту."
    )
