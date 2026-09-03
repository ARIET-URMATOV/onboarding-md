from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

STAGE_IDS = ["1", "2", "3", "4", "5"]

# JSONB на PostgreSQL, JSON на SQLite (тесты)
FlexibleJSON = JSONB().with_variant(JSON(), "sqlite")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def empty_tasks() -> dict:
    return {sid: [] for sid in STAGE_IDS}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)
    intro_seen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    progress: Mapped["Progress"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Progress(Base):
    __tablename__ = "progress"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    done_tasks: Mapped[dict] = mapped_column(FlexibleJSON, nullable=False, default=empty_tasks)
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="progress")


class Stage(Base):
    __tablename__ = "stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    short_label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_name: Mapped[str] = mapped_column(Text, nullable=False)
    reward_desc: Mapped[str] = mapped_column(Text, nullable=False)
    icon_key: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    tasks: Mapped[list["StageTask"]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", order_by="StageTask.sort_order"
    )


class StageTask(Base):
    __tablename__ = "stage_tasks"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # e.g. "1-docs"
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    xp: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    stage: Mapped[Stage] = relationship(back_populates="tasks")
