"""V2 hardening без внешних сервисов: переходы, 30 дней, проекты, коды в БД."""
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.database import SessionLocal
from app.models import CandidateApplication, EmailVerificationCode, Project, ProjectMember, User
from app.routes.auth import create_token
from app.routes.v2.applications import TRANSITIONS


def test_transitions_graph():
    assert TRANSITIONS["new"] == ["in_review", "rejected"]
    assert "approved" in TRANSITIONS["in_review"]
    assert TRANSITIONS["approved"] == ["account_created"]
    assert TRANSITIONS["account_created"] == ["activated"]


def _client_for(user_id: int) -> TestClient:
    c = TestClient(app)
    c.cookies.set("md_token", create_token(user_id))
    return c


def _run(coro):
    return asyncio.run(coro)


def test_decision_graph_and_reject_reason():
    async def setup():
        async with SessionLocal() as db:
            hr = User(email="hr-t@test.kg", password_hash="x", name="HR", is_staff=True, staff_role="hr")
            db.add(hr)
            await db.commit()
            await db.refresh(hr)
            hr_id = hr.id
            candidate = CandidateApplication(number="ONB-2026-0001", name="A", email="a@t.kg",
                                             status="approved", consent_given=True)
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
            return hr_id, candidate.id
    hr_id, cid = _run(setup())
    c = _client_for(hr_id)
    origin = {"Origin": "http://localhost:5173"}
    # approved -> approved запрещён
    r = c.post(f"/api/admin/applications/{cid}/decision",
               json={"decision": "approve", "comment": "x"}, headers=origin)
    assert r.status_code == 400
    # reject без причины запрещён
    r = c.post(f"/api/admin/applications/{cid}/decision",
               json={"decision": "reject", "comment": ""}, headers=origin)
    assert r.status_code == 400

    async def mk_sa():
        async with SessionLocal() as db:
            sa = User(email="sa-t@test.kg", password_hash="x", name="SA",
                      is_staff=True, staff_role="sysadmin")
            db.add(sa)
            await db.commit()
            await db.refresh(sa)
            return sa.id
    sa_id = _run(mk_sa())
    c2 = _client_for(sa_id)
    r = c2.post(f"/api/admin/applications/{cid}/decision",
                json={"decision": "approve", "comment": "ok"}, headers=origin)
    assert r.status_code == 403


def test_projects_nda_and_member_flow():
    async def setup():
        async with SessionLocal() as db:
            u1 = User(email="dev1-t@test.kg", password_hash="x", name="Dev1")
            u2 = User(email="dev2-t@test.kg", password_hash="x", name="Dev2")
            hr = User(email="hrp-t@test.kg", password_hash="x", name="HR", is_staff=True, staff_role="hr")
            db.add_all([u1, u2, hr])
            await db.commit()
            for u in (u1, u2, hr):
                await db.refresh(u)
            p = Project(name="Pilot", client="NDA-client", category="product")
            db.add(p)
            await db.commit()
            await db.refresh(p)
            db.add(ProjectMember(project_id=p.id, user_id=u1.id, role="dev"))
            await db.commit()
            return u1.id, u2.id, hr.id, p.id
    ids = _run(setup())
    c1, c2, ch = _client_for(ids[0]), _client_for(ids[1]), _client_for(ids[2])
    assert c1.get("/api/projects/my").status_code == 200
    assert len(c1.get("/api/projects/my").json()) == 1
    # чужой не видит карточку
    assert c2.get(f"/api/projects/{ids[3]}").status_code == 403
    # staff видит
    assert ch.get(f"/api/projects/{ids[3]}").status_code == 200


def test_email_codes_in_db_not_memory():
    async def setup():
        async with SessionLocal() as db:
            db.add(EmailVerificationCode(email="c@t.kg", code="123456", payload={},
                                         expires_at=datetime.now(timezone.utc) + timedelta(minutes=15)))
            await db.commit()
            row = (await db.execute(select(EmailVerificationCode).where(
                EmailVerificationCode.email == "c@t.kg"))).scalars().first()
            assert row is not None and row.code == "123456"
    _run(setup())
    from app.routes.v2 import applications as apps_mod
    assert not hasattr(apps_mod, "_verification_codes")
