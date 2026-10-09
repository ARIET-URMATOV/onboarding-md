"""Админка проектов: PM/тимлид/staff (FR-509, FR-501)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, ProjectDoc, ProjectMember, User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/admin/projects")


def _can_edit(user: User) -> bool:
    return bool(user.is_staff or user.is_lead)


class ProjectIn(BaseModel):
    name: str
    client: str = ""
    category: str = "product"
    description: str = ""
    stack: str = ""
    stage: str = ""
    jira_key: str = ""
    jira_component: str = ""
    confluence_space: str = ""
    links: dict = {}
    is_active: bool = True


class MemberIn(BaseModel):
    user_id: int
    role: str = "dev"
    responsibility: str = ""
    contact_tg: str = ""
    is_mentor: bool = False


class DocIn(BaseModel):
    title: str
    confluence_url: str = ""
    is_required: bool = True
    sort_order: int = 0


@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/staff")
    from sqlalchemy import func
    from sqlalchemy import select as _select
    rows = (await db.execute(
        _select(Project).order_by(Project.is_active.desc(), Project.name)
    )).scalars().all()
    out = []
    for p in rows:
        n_members = (await db.execute(
            _select(func.count(ProjectMember.id)).where(
                ProjectMember.project_id == p.id, ProjectMember.ended_at.is_(None))
        )).scalar() or 0
        n_docs = (await db.execute(
            _select(func.count(ProjectDoc.id)).where(ProjectDoc.project_id == p.id)
        )).scalar() or 0
        out.append({"id": p.id, "name": p.name, "client": p.client,
                    "category": p.category, "is_active": p.is_active,
                    "members": n_members, "docs": n_docs})
    return out


@router.get("/{project_id}/members")
async def list_members(project_id: int, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/staff")
    from sqlalchemy import select as _select
    rows = (await db.execute(
        _select(ProjectMember).where(ProjectMember.project_id == project_id,
                                     ProjectMember.ended_at.is_(None))
    )).scalars().all()
    users = {}
    if rows:
        from app.models import User as _U
        for u in (await db.execute(
            _select(_U).where(_U.id.in_([m.user_id for m in rows]))
        )).scalars().all():
            users[u.id] = {"email": u.email, "name": u.name}
    return [{"user_id": m.user_id, "email": users.get(m.user_id, {}).get("email", ""),
             "name": users.get(m.user_id, {}).get("name", ""),
             "role": m.role, "responsibility": m.responsibility,
             "contact_tg": m.contact_tg, "is_mentor": m.is_mentor} for m in rows]


@router.post("")
async def create_project(payload: ProjectIn, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/staff")
    p = Project(**payload.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"id": p.id}


@router.patch("/{project_id}")
async def patch_project(project_id: int, payload: dict, db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/staff")
    p = await db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    for k, v in (payload or {}).items():
        if hasattr(p, k):
            setattr(p, k, v)
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/members")
async def add_member(project_id: int, payload: MemberIn, db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/HR")
    p = await db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    db.add(ProjectMember(project_id=project_id, user_id=payload.user_id, role=payload.role,
                         responsibility=payload.responsibility, contact_tg=payload.contact_tg,
                         is_mentor=payload.is_mentor))
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/docs")
async def add_doc(project_id: int, payload: DocIn, db: AsyncSession = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if not _can_edit(user):
        raise HTTPException(status_code=403, detail="Только PM/тимлид/staff")
    p = await db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    d = ProjectDoc(project_id=project_id, **payload.model_dump())
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return {"id": d.id}
