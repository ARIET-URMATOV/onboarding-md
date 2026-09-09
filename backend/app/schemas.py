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


class MpulseCodeIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)


class VerifyTargetIn(BaseModel):
    """Staff подтверждает задачу сотрудника (Step 1 docs / Step 2 access)."""
    user_id: int
    task_id: str = Field(min_length=1, max_length=40)


class WifiMacIn(BaseModel):
    mac: str = Field(min_length=17, max_length=17)


class WifiVerifyIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class ConfluenceConfirmIn(BaseModel):
    """opened_at — ISO timestamp когда сотрудник открыл Confluence (фронт присылает)."""
    opened_at: str | None = None


class StaffSetIn(BaseModel):
    is_staff: bool


class AdminUserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str | None = None
    is_staff: bool = False
    created_at: str | None = None
    done_stage1: list[str] = []


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


class MeOut(BaseModel):
    user: UserOut
    progress: ProgressOut


class OkOut(BaseModel):
    ok: bool = True
