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
    department: str | None = Field(default=None, max_length=120)
    position: str | None = Field(default=None, max_length=120)
    office: str | None = Field(default=None, max_length=120)


class TelegramUsernameIn(BaseModel):
    telegram_username: str = Field(min_length=2, max_length=33)


class TelegramGroupIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    chat_id: str = Field(min_length=2, max_length=64)


class AutoAddOut(BaseModel):
    added: list[str] = []
    failed: list[dict] = []
    skipped: list[str] = []
    username: str = ""
    invite_links: list[dict] = []
    verified: bool = False
    greeted: list[str] = []


class AutoAddIn(BaseModel):
    greeting: str | None = None


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TaskIn(BaseModel):
    stage_id: int = Field(ge=1, le=4)
    task_id: str = Field(min_length=1, max_length=40)


class StageActionIn(BaseModel):
    stage_id: int = Field(ge=1, le=4)
    action: str = Field(pattern="^(complete|uncomplete)$")


class VoiceIn(BaseModel):
    enabled: bool


class ProgressOut(BaseModel):
    done_tasks: dict
    xp: int
    level: int
    completed_at: str | None = None


class Department(BaseModel):
    id: str
    display_name: str
    name: str
    slug: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str | None
    avatar: str | None
    intro_seen: bool
    voice_enabled: bool
    created_at: str | None = None
    is_staff: bool = False
    is_lead: bool = False
    telegram_username: str = ""
    department: Department | str | None = None
    position: str | None = None
    office: str | None = None
    ad_login: str | None = None


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


class StaffRoleIn(BaseModel):
    staff_role: str | None = None


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

INSTRUCTION_KEYS = ("instruction.accountant",)
INTRO_KEYS = ("intro.title", "intro.mission", "intro.values", "intro.instruction", "intro.goals", "intro.gallery")
STAGE5_KEYS = ("stage5.frontend", "stage5.backend", "stage5.design")
# Шаблоны писем кандидату (5.1): плейсхолдеры {{number}}, {{name}}, {{comment}}, {{login}}.
# Рендерит Batch-A email worker; админка редактирует тексты здесь.
LETTER_KEYS = (
    "letter.application_received",
    "letter.approved",
    "letter.rejected",
    "letter.needs_info",
    "letter.account_created",
)

class SettingIn(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    value: str = Field(default="", max_length=5000)
    mode: str = Field(default="merge", max_length=16)

class SettingsOut(BaseModel):
    contacts: dict[str, str] = {}
    links: dict[str, str] = {}
    instructions: dict[str, str] = {}
    intro: dict[str, str] = {}
    stage5: dict[str, str] = {}
    letters: dict[str, str] = {}


class AdminUserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str | None = None
    is_staff: bool = False
    staff_role: str | None = None
    is_lead: bool = False
    department: str | None = None
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


LUCIDE_ICONS = (
    "Link", "ClipboardCheck", "KeyRound", "Send", "Smartphone", "Apple",
    "BookOpen", "Globe", "Lock", "Wifi", "FileText", "Users",
    "Hash", "MessageSquare", "ExternalLink", "Download",
)

VALID_CATEGORIES = ("access", "mpulse", "knowledge", "dept")
VALID_SERVICE_TASK_IDS = ("1-jira", "1-figma", "1-gitlab", "5-take", "5-confirm")
VALID_ROLES_LIST = ("frontend", "backend", "design")


class ServiceOut(BaseModel):
    key: str
    title: str
    subtitle: str = ""
    url: str = ""
    icon_key: str = "Link"
    category: str = "access"
    task_id: str | None = None
    roles: list[str] = []
    sort_order: int = 0
    is_visible: bool = True
    open_new_tab: bool = True
    extra: dict = {}
    details: str = ""


class ServiceIn(BaseModel):
    key: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9\-]{0,62}$")
    title: str = Field(min_length=1, max_length=120)
    subtitle: str = Field(default="", max_length=240)
    url: str = Field(default="", max_length=500)
    icon_key: str = Field(default="Link", max_length=40)
    category: str = Field(default="access", max_length=20)
    task_id: str | None = None
    roles: list[str] = []
    sort_order: int = 0
    is_visible: bool = True
    open_new_tab: bool = True
    extra: dict = {}
    details: str = Field(default="", max_length=5000)


class ServicePatchIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    subtitle: str | None = Field(default=None, max_length=240)
    url: str | None = Field(default=None, max_length=500)
    icon_key: str | None = Field(default=None, max_length=40)
    category: str | None = Field(default=None, max_length=20)
    task_id: str | None = None
    roles: list[str] | None = None
    sort_order: int | None = None
    is_visible: bool | None = None
    open_new_tab: bool | None = None
    extra: dict | None = None
    details: str | None = Field(default=None, max_length=5000)


class SlaStatusOut(BaseModel):
    deadline: str
    days_left: int
    total_days: int = 7
    status: str  # active | due_today | overdue | done | done_late
    started_at: str


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    meta: dict = {}
    created_at: str | None = None
    read: bool = False


class MeOut(BaseModel):
    user: UserOut
    progress: ProgressOut
    sla: SlaStatusOut | None = None
    unread_count: int = 0


class OidcCallbackIn(BaseModel):
    code: str
    state: str


class InfoReadIn(BaseModel):
    """Сотрудник подтвердил прочтение инфо-модалки (scroll-checker → auto-complete)."""
    stage_id: int = Field(ge=1, le=4)
    task_id: str = Field(min_length=1, max_length=40)


class OkOut(BaseModel):
    ok: bool = True


class StageTaskIn(BaseModel):
    """Создание задачи этапа (FR-407): тексты, XP, тип проверки, департамент."""

    id: str = Field(min_length=1, max_length=40)
    stage_id: int = Field(ge=1, le=4)
    title: str = Field(min_length=1, max_length=300)
    xp: int = Field(ge=0, le=500)
    sort_order: int = Field(default=0, ge=0)
    verification_type: str = Field(default="info_read", max_length=40)
    responsible_role: str = Field(default="", max_length=40)
    department: str | None = Field(default=None, max_length=40)


class StageTaskPatchIn(BaseModel):
    stage_id: int | None = Field(default=None, ge=1, le=4)
    title: str | None = Field(default=None, min_length=1, max_length=300)
    xp: int | None = Field(default=None, ge=0, le=500)
    sort_order: int | None = Field(default=None, ge=0)
    verification_type: str | None = Field(default=None, max_length=40)
    responsible_role: str | None = Field(default=None, max_length=40)
    department: str | None = Field(default=None, max_length=40)


class StageTaskOut(BaseModel):
    id: str
    stage_id: int
    title: str
    xp: int
    sort_order: int
    verification_type: str
    responsible_role: str
    department: str | None = None
