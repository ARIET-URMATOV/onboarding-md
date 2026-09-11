from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RoleIn(BaseModel):
    role: str = Field(pattern="^(frontend|backend|design)$")


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar: str | None = None
    telegram_username: str | None = Field(default=None, min_length=2, max_length=33)


class TelegramUsernameIn(BaseModel):
    telegram_username: str = Field(min_length=2, max_length=33)


class TelegramGroupIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    chat_id: str = Field(min_length=2, max_length=64)


class AutoAddOut(BaseModel):
    added: list[str] = []
    failed: list[dict] = []
    username: str = ""
    invite_links: list[dict] = []


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TaskIn(BaseModel):
    stage_id: int = Field(ge=1, le=5)
    task_id: str = Field(min_length=1, max_length=40)


class StageActionIn(BaseModel):
    stage_id: int = Field(ge=1, le=5)
    action: str = Field(pattern="^(complete|uncomplete)$")


class VoiceIn(BaseModel):
    enabled: bool


class ProgressOut(BaseModel):
    done_tasks: dict
    xp: int
    level: int
    completed_at: str | None = None


class UserOut(BaseModel):
    email: str
    name: str
    role: str | None
    avatar: str | None
    intro_seen: bool
    voice_enabled: bool
    created_at: str | None = None
    is_staff: bool = False
    telegram_username: str = ""


class MpulseCodeIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)


class VerifyTargetIn(BaseModel):
    """Staff подтверждает задачу сотрудника (Step 1 docs / Step 2 access)."""
    user_id: int
    task_id: str = Field(min_length=1, max_length=40)


class RequestIn(BaseModel):
    """Сотрудник запрашивает верификацию задачи (вместо свободного toggle)."""
    task_id: str = Field(min_length=1, max_length=40)
    note: str = Field(default="", max_length=300)


class BatchRequestIn(BaseModel):
    """Одна кнопка «Отправить пакет»: все задачи шага разом (атомарно).

    user_id — только для staff verify-batch (чей пакет подтверждаем).
    """
    task_ids: list[str] = Field(min_length=1, max_length=10)
    note: str = Field(default="", max_length=300)
    user_id: int | None = None


class RejectIn(BaseModel):
    reason: str = Field(min_length=10, max_length=500)


class PendingRequestOut(BaseModel):
    id: int
    user_id: int
    email: str = ""
    name: str = ""
    task_id: str
    note: str = ""
    created_at: str | None = None


class WifiMacIn(BaseModel):
    mac: str = Field(min_length=17, max_length=17)


class WifiVerifyIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class ConfluenceConfirmIn(BaseModel):
    """opened_at — ISO первого клика; links_clicked — pageId 5 страниц (list или {pageId: iso})."""
    opened_at: str | None = None
    links_clicked: list[str] | dict[str, str] = Field(default_factory=list)


class StaffSetIn(BaseModel):
    is_staff: bool


class LeadSetIn(BaseModel):
    lead_email: str = Field(default="", max_length=120)


class WifiPasswordIn(BaseModel):
    """Сетевик вводит пароль вручную (пусто = сгенерировать сервером)."""
    user_id: int
    password: str = Field(default="", max_length=128)


# Контакты ответственных (админ-панель → Настройки; пусто = уведомления только HR)
CONTACT_KEYS = (
    "contacts.hr_email",
    "contacts.sysadmin_email",
    "contacts.lead_email",
    "contacts.accountant_email",
    "contacts.teamlead_email",
)


class SettingIn(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    value: str = Field(default="", max_length=500)
    # groups_json: "merge" (по chat_id, по умолчанию — не затирает чужие)
    # или "replace" (полная замена, для удаления групп)
    mode: str = Field(default="merge", max_length=16)


class SettingsOut(BaseModel):
    contacts: dict[str, str] = {}
    links: dict[str, str] = {}


class AdminUserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str | None = None
    is_staff: bool = False
    created_at: str | None = None
    done_stage1: list[str] = []
    lead_email: str = ""


class AuditOut(BaseModel):
    id: int
    user_id: int
    task_id: str
    verified_by: int | None = None
    method: str
    details: str = "{}"
    created_at: str | None = None


class MpulseRotateIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    batch_name: str = Field(default="", max_length=80)


class MpulseCodeOut(BaseModel):
    id: int
    code: str  # только для staff (сотрудникам не светить)
    batch_name: str
    is_active: bool
    valid_from: str | None = None
    valid_until: str | None = None
    created_at: str | None = None


class LinksOut(BaseModel):
    telegram_invite_link: str = ""
    figma_team_url: str = ""
    confluence_url: str = ""
    mpulse_android_url: str = ""
    mpulse_ios_url: str = ""
    jira_url: str = ""
    gitlab_url: str = ""
    instruction_accountant: str = ""


class MeOut(BaseModel):
    user: UserOut
    progress: ProgressOut


class OkOut(BaseModel):
    ok: bool = True
