"""Этап 6 — онбординг в проект (FR-501–511). Без внешних интеграций."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import (
    PendingRequest,
    Project,
    ProjectDoc,
    ProjectDocRead,
    ProjectMember,
    User,
    VerificationLog,
)
from app.routes.auth import get_current_user

router = APIRouter(prefix="/projects")


def utcnow():
    return datetime.now(timezone.utc)


def _is_staff(u: User) -> bool:
    return bool(u.is_staff)


async def _can_see_project(db: AsyncSession, user: User, project_id: int) -> Project:
    p = await db.get(Project, project_id)
    if not p or not p.is_active:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if _is_staff(user):
        return p
    m = (await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
            ProjectMember.ended_at.is_(None),
        )
    )).scalars().first()
    if not m:
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")
    return p


class DocConfirmIn(BaseModel):
    opened_at: str


@router.get("/my")
async def my_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(ProjectMember, Project)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == user.id, ProjectMember.ended_at.is_(None))
    )).all()
    out = []
    for m, p in rows:
        docs = (await db.execute(
            select(ProjectDoc).where(ProjectDoc.project_id == p.id).order_by(ProjectDoc.sort_order)
        )).scalars().all()
        reads = (await db.execute(
            select(ProjectDocRead).where(
                ProjectDocRead.user_id == user.id,
                ProjectDocRead.doc_id.in_([d.id for d in docs] or [-1]),
            )
        )).scalars().all()
        read_ids = {r.doc_id for r in reads}
        req_docs = [d for d in docs if d.is_required]
        done = sum(1 for d in req_docs if d.id in read_ids)
        out.append({
            "id": p.id, "name": p.name, "client": p.client, "category": p.category,
            "role": m.role, "is_mentor": m.is_mentor,
            "docs_total": len(req_docs), "docs_done": done,
        })
    return out


@router.get("/{project_id}")
async def project_card(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = await _can_see_project(db, user, project_id)
    docs = (await db.execute(
        select(ProjectDoc).where(ProjectDoc.project_id == p.id).order_by(ProjectDoc.sort_order)
    )).scalars().all()
    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == p.id, ProjectMember.ended_at.is_(None))
    )).scalars().all()
    reads = (await db.execute(
        select(ProjectDocRead).where(
            ProjectDocRead.user_id == user.id,
            ProjectDocRead.doc_id.in_([d.id for d in docs] or [-1]),
        )
    )).scalars().all()
    read_ids = {r.doc_id for r in reads}
    # состав команды без user_id чужих (NDA-минимум: только нужное для связи)
    return {
        "id": p.id, "name": p.name, "client": p.client, "category": p.category,
        "description": p.description, "stack": p.stack, "stage": p.stage,
        "jira_key": p.jira_key, "jira_component": p.jira_component,
        "confluence_space": p.confluence_space, "links": p.links or {},
        "docs": [{"id": d.id, "title": d.title, "url": d.confluence_url,
                  "required": d.is_required, "read": d.id in read_ids} for d in docs],
        "team": [{"role": m.role, "responsibility": m.responsibility,
                  "contact_tg": m.contact_tg, "is_mentor": m.is_mentor} for m in members],
    }


@router.post("/{project_id}/docs/{doc_id}/confirm")
async def confirm_doc(
    project_id: int, doc_id: int,
    payload: DocConfirmIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _can_see_project(db, user, project_id)
    d = await db.get(ProjectDoc, doc_id)
    if not d or d.project_id != project_id:
        raise HTTPException(status_code=404, detail="Документ не найден")
    try:
        opened = datetime.fromisoformat(payload.opened_at.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Неверный opened_at")
    elapsed = (utcnow() - opened).total_seconds()
    if elapsed < settings.confluence_min_seconds:
        raise HTTPException(status_code=400, detail=f"Читайте ещё {int(settings.confluence_min_seconds - elapsed)} сек")
    ex = (await db.execute(
        select(ProjectDocRead).where(ProjectDocRead.doc_id == doc_id, ProjectDocRead.user_id == user.id)
    )).scalars().first()
    if ex:
        return {"ok": True, "already": True}
    db.add(ProjectDocRead(doc_id=doc_id, user_id=user.id, opened_at=opened, confirmed_at=utcnow()))
    db.add(VerificationLog(user_id=user.id, task_id=f"p{project_id}-doc-{doc_id}",
                           method="project_doc", details="{}"))
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/request-access")
async def request_project_access(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Запрос доступов проекта в 1 клик через pending_requests (FR-506)."""
    await _can_see_project(db, user, project_id)
    task_id = f"p{project_id}-access"
    ex = (await db.execute(
        select(PendingRequest).where(
            PendingRequest.user_id == user.id, PendingRequest.task_id == task_id,
            PendingRequest.status == "pending")
    )).scalars().first()
    if not ex:
        db.add(PendingRequest(user_id=user.id, task_id=task_id, status="pending",
                              note=f"Доступы проекта {project_id}"))
        await db.commit()
    return {"ok": True}
