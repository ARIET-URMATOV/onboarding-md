"""external services: CRUD services table + seed from env/config

Revision ID: 019
Revises: 018
Create Date: 2026-09-11

Each service is a configurable record: title, url, icon, category (access/mpulse/knowledge),
roles filter (frontend/backend/design, []=all), is_visible, optional task_id for self-link.
Confluence pages: 5 knowledge records with extra.pageId.
Hard delete supported (key PK, DELETE endpoint).
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default seed — mirrors pre-migration env/config values
SEED = [
    {"key": "jira", "title": "Jira", "subtitle": "Войдите со своим корпоративным логином и паролем",
     "url": "https://mdigital.kg", "icon_key": "ClipboardCheck", "category": "access",
     "task_id": "1-jira", "roles": [], "sort_order": 1},
    {"key": "gitlab", "title": "GitLab", "subtitle": "Войдите со своим корпоративным логином (или примите инвайт на почту)",
     "url": "https://gitlab.mdigital.kg", "icon_key": "KeyRound", "category": "access",
     "task_id": "1-gitlab", "roles": [], "sort_order": 2},
    {"key": "figma", "title": "Figma", "subtitle": "Приглашение отправляется на вашу почту — проверьте inbox и примите.",
     "url": "https://figma.com", "icon_key": "Send", "category": "access",
     "task_id": "1-figma", "roles": ["design", "frontend"], "sort_order": 3},
    {"key": "mpulse-android", "title": "MPulse — Google Play", "subtitle": "Скачать MPulse",
     "url": "https://play.google.com/store/apps/details?id=kg.pulse.app",
     "icon_key": "Smartphone", "category": "mpulse", "task_id": None, "roles": [],
     "sort_order": 4},
    {"key": "mpulse-ios", "title": "MPulse — App Store", "subtitle": "Скачать MPulse",
     "url": "https://apps.apple.com/us/app/mpulse-kg/id6740697046",
     "icon_key": "Apple", "category": "mpulse", "task_id": None, "roles": [],
     "sort_order": 5},
    {"key": "confluence-51479172", "title": "Корпоративная культура", "subtitle": "confluence.mdigital.kg",
     "url": "https://confluence.mdigital.kg/pages/viewpage.action?pageId=51479172",
     "icon_key": "BookOpen", "category": "knowledge", "task_id": None, "roles": [],
     "sort_order": 10, "extra": '{"pageId": "51479172"}'},
    {"key": "confluence-15370476", "title": "Система грейдов в компании", "subtitle": "confluence.mdigital.kg",
     "url": "https://confluence.mdigital.kg/pages/viewpage.action?pageId=15370476",
     "icon_key": "BookOpen", "category": "knowledge", "task_id": None, "roles": [],
     "sort_order": 11, "extra": '{"pageId": "15370476"}'},
    {"key": "confluence-86868582", "title": "О компании и структура", "subtitle": "confluence.mdigital.kg",
     "url": "https://confluence.mdigital.kg/pages/viewpage.action?pageId=86868582",
     "icon_key": "BookOpen", "category": "knowledge", "task_id": None, "roles": [],
     "sort_order": 12, "extra": '{"pageId": "86868582"}'},
    {"key": "confluence-86868604", "title": "Команды и роли", "subtitle": "confluence.mdigital.kg",
     "url": "https://confluence.mdigital.kg/pages/viewpage.action?pageId=86868604",
     "icon_key": "BookOpen", "category": "knowledge", "task_id": None, "roles": [],
     "sort_order": 13, "extra": '{"pageId": "86868604"}'},
    {"key": "confluence-51478978", "title": "Общие принципы разработки", "subtitle": "confluence.mdigital.kg",
     "url": "https://confluence.mdigital.kg/pages/viewpage.action?pageId=51478978",
     "icon_key": "BookOpen", "category": "knowledge", "task_id": None, "roles": [],
     "sort_order": 14, "extra": '{"pageId": "51478978"}'},
]


def upgrade() -> None:
    op.create_table(
        "external_services",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=False, server_default=""),
        sa.Column("url", sa.Text(), nullable=False, server_default=""),
        sa.Column("icon_key", sa.Text(), nullable=False, server_default="Link"),
        sa.Column("category", sa.String(), nullable=False, server_default="access"),
        sa.Column("task_id", sa.Text(), nullable=True),
        sa.Column("roles", sa.JSON().with_variant(sa.JSON(), "sqlite"), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("open_new_tab", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("extra", sa.JSON().with_variant(sa.JSON(), "sqlite"), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_external_services_category", "external_services", ["category"])
    # Seed default services
    import json
    conn = op.get_bind()
    for s in SEED:
        extra_raw = s.get("extra", "{}")
        if isinstance(extra_raw, str):
            try:
                extra_obj = json.loads(extra_raw)
            except Exception:
                extra_obj = {}
        else:
            extra_obj = extra_raw
        roles_list = s.get("roles", [])
        conn.execute(
            sa.text(
                "INSERT INTO external_services "
                "(key, title, subtitle, url, icon_key, category, task_id, roles, "
                "sort_order, is_visible, open_new_tab, extra) "
                "VALUES (:key, :title, :subtitle, :url, :icon_key, :category, :task_id, "
                "CAST(:roles AS jsonb), :sort_order, :is_visible, :open_new_tab, CAST(:extra AS jsonb)) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"key": s["key"], "title": s["title"], "subtitle": s.get("subtitle", ""),
             "url": s.get("url", ""), "icon_key": s.get("icon_key", "Link"),
             "category": s["category"], "task_id": s.get("task_id"),
             "roles": json.dumps(roles_list), "sort_order": s.get("sort_order", 0),
             "is_visible": True, "open_new_tab": True, "extra": json.dumps(extra_obj)},
        )


def downgrade() -> None:
    op.drop_table("external_services")
