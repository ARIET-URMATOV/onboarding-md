import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stages_data import compute_xp, normalize_tasks


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@mdigital.kg"


# ---------- unit: XP-модель ----------

def test_compute_xp_empty():
    assert compute_xp(normalize_tasks(None)) == 0


def test_compute_xp_single_task():
    tasks = normalize_tasks({"1": ["1-dogovor"]})
    assert compute_xp(tasks) == 1


def test_compute_xp_step2_zero_xp():
    # Step 2 доступы — 0 баллов
    tasks = normalize_tasks({"1": ["1-mbusiness", "1-wifi"]})
    assert compute_xp(tasks) == 0


def test_compute_xp_full_stage_includes_bonus():
    from app.stages_data import get_stages_sync

    all_ids = list(get_stages_sync()[1]["tasks"].keys())
    tasks = normalize_tasks({"1": all_ids})
    # 20 задач + 150 бонус
    assert compute_xp(tasks) == 170


def test_compute_xp_max_all_stages():
    from app.stages_data import get_stages_sync

    full = {str(sid): list(stage["tasks"].keys()) for sid, stage in get_stages_sync().items()}
    # 620 задач + 750 бонусов = 1370 (максимум, Lv.14)
    assert compute_xp(normalize_tasks(full)) == 1370


def test_normalize_tasks_ignores_unknown():
    tasks = normalize_tasks({"1": ["1-dogovor", "hax"], "9": ["x"], "2": "not-a-list"})
    # unknown task "hax" is now dropped (tightened normalize_tasks), unknown stage "9" ignored
    assert tasks["1"] == ["1-dogovor"]
    assert "9" not in tasks
    assert tasks["2"] == []


def test_normalize_tasks_drops_unknown_task_ids():
    tasks = normalize_tasks({"2": ["2-studio", "evil"], "3": ["3-watch"]})
    assert tasks["2"] == ["2-studio"]
    assert tasks["3"] == ["3-watch"]


def test_compute_level():
    from app.stages_data import compute_level

    assert compute_level(0) == 1
    assert compute_level(40) == 1
    assert compute_level(100) == 2
    assert compute_level(1370) == 14


def test_register_short_password_rejected(client):
    bad = client.post("/api/register", json={"email": _unique_email(), "password": "short"})
    assert bad.status_code == 422


# ---------- API: health ----------

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


# ---------- API: auth flow ----------

def test_me_unauthorized(client):
    res = client.get("/api/me")
    assert res.status_code == 401


def test_register_login_me_flow(client):
    email = _unique_email()
    s = client

    reg = s.post("/api/register", json={"email": email, "password": "secret123", "name": "Tester"})
    assert reg.status_code == 200
    assert reg.json()["user"]["email"] == email
    assert reg.json()["user"]["name"] == "Tester"
    assert reg.json()["progress"]["xp"] == 0

    me = s.get("/api/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == email

    # дубликат
    dup = s.post("/api/register", json={"email": email, "password": "secret123"})
    assert dup.status_code == 409

    # неверный пароль
    bad = s.post("/api/login", json={"email": email, "password": "wrong"})
    assert bad.status_code == 401

    # логин
    login = s.post("/api/login", json={"email": email, "password": "secret123"})
    assert login.status_code == 200


def test_progress_toggle_and_stage(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})

    # свободный toggle Stage 1 запрещён (замок TZ: только request/код/таймер)
    locked = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "1-dogovor"})
    assert locked.status_code == 403
    locked2 = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "1-wifi"})
    assert locked2.status_code == 403
    locked3 = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "1-mpulse-code"})
    assert locked3.status_code == 403

    # массовое закрытие Этапа 1 запрещено не-staff
    mass = client.post("/api/progress/stage", json={"stage_id": 1, "action": "complete"})
    assert mass.status_code == 403

    # свободный toggle работает для этапов без верификации (Stage 2)
    t = client.post("/api/progress/task", json={"stage_id": 2, "task_id": "2-studio"})
    assert t.status_code == 200
    assert t.json()["xp"] == 40

    # неизвестная задача
    bad = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "hax"})
    assert bad.status_code == 400

    # legacy задача отклоняется
    legacy = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "1-docs"})
    assert legacy.status_code == 400

    st = client.post("/api/progress/stage", json={"stage_id": 2, "action": "complete"})
    assert st.status_code == 200

    un = client.post("/api/progress/stage", json={"stage_id": 1, "action": "uncomplete"})
    assert un.json()["xp"] == 0


def test_profile_and_password(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})

    p = client.patch("/api/profile", json={"name": "NewName"})
    assert p.status_code == 200
    assert p.json()["name"] == "NewName"

    tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    av = client.patch("/api/profile", json={"avatar": tiny})
    assert av.json()["avatar"].startswith("data:image/png")

    bad_av = client.patch("/api/profile", json={"avatar": "http://evil.com/x.png"})
    assert bad_av.status_code == 400

    pw = client.post(
        "/api/profile/password",
        json={"current_password": "secret123", "new_password": "newpass123"},
    )
    assert pw.status_code == 200

    wrong = client.post(
        "/api/profile/password",
        json={"current_password": "wrong", "new_password": "x12345678"},
    )
    assert wrong.status_code == 401


def test_role_intro_voice(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})

    r = client.post("/api/role", json={"role": "frontend"})
    assert r.status_code == 200
    assert r.json()["role"] == "frontend"

    bad = client.post("/api/role", json={"role": "hacker"})
    assert bad.status_code == 422

    i = client.post("/api/intro-seen")
    assert i.status_code == 200
    assert client.get("/api/me").json()["user"]["intro_seen"] is True

    v = client.post("/api/voice", json={"enabled": False})
    assert v.status_code == 200
    assert client.get("/api/me").json()["user"]["voice_enabled"] is False


# ---------- API: demo ----------


def _seed_demo_side_data() -> None:
    import asyncio

    from sqlalchemy import select

    from app.config import settings
    from app.database import SessionLocal
    from app.models import PendingRequest, User, VerificationLog, WifiMac

    async def _go() -> None:
        async with SessionLocal() as db:
            demo = (await db.execute(select(User).where(User.email == settings.demo_email))).scalar_one()
            db.add(PendingRequest(user_id=demo.id, task_id="1-dogovor", note="x", status="pending"))
            db.add(WifiMac(user_id=demo.id, mac="AA:BB:CC:DD:EE:FF"))
            db.add(VerificationLog(user_id=demo.id, task_id="1-wifi", method="technical_password"))
            await db.commit()

    asyncio.run(_go())


def _assert_demo_side_data_wiped() -> None:
    import asyncio

    from sqlalchemy import select

    from app.config import settings
    from app.database import SessionLocal
    from app.models import PendingRequest, User, VerificationLog, WifiMac

    async def _go() -> None:
        async with SessionLocal() as db:
            demo = (await db.execute(select(User).where(User.email == settings.demo_email))).scalar_one()
            assert (
                await db.execute(select(PendingRequest).where(PendingRequest.user_id == demo.id))
            ).scalars().all() == []
            assert (await db.execute(select(WifiMac).where(WifiMac.user_id == demo.id))).scalars().all() == []
            assert (
                await db.execute(select(VerificationLog).where(VerificationLog.user_id == demo.id))
            ).scalars().all() == []

    asyncio.run(_go())


def test_demo_login_and_reset(client):
    d1 = client.post("/api/demo/login")
    assert d1.status_code == 200
    assert d1.json()["user"]["email"] == "demo@mdigital.kg"

    # идемпотентно
    d2 = client.post("/api/demo/login")
    assert d2.status_code == 200

    # выбрать роль — иначе 403
    client.post("/api/role", json={"role": "frontend"})
    # накрутить прогресс
    client.post("/api/progress/task", json={"stage_id": 3, "task_id": "3-watch"})
    me = client.get("/api/me")
    assert me.json()["progress"]["xp"] == 200

    # reset (full wipe: progress + pending + wifi_macs + verification_log)
    _seed_demo_side_data()

    r = client.post("/api/demo/reset")
    assert r.status_code == 200
    me2 = client.get("/api/me")
    assert me2.json()["progress"]["xp"] == 0
    assert me2.json()["user"]["role"] is None
    assert me2.json()["user"]["intro_seen"] is False
    assert me2.json()["user"]["avatar"] is None
    assert me2.json()["user"]["name"] == "Demo User"

    _assert_demo_side_data_wiped()


def test_demo_reset_requires_auth():
    with TestClient(app) as anon:
        r = anon.post("/api/demo/reset")
        assert r.status_code == 401


def test_demo_reset_forbidden_for_non_demo(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    r = client.post("/api/demo/reset")
    assert r.status_code == 403
    assert "Только демо" in r.json()["detail"]
    client.post("/api/logout")


def test_logout(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    assert client.get("/api/me").status_code == 200

    client.post("/api/logout")
    assert client.get("/api/me").status_code == 401


# ---------- Stage 1: verify flows ----------

def _grant_staff(email: str) -> int:
    import asyncio

    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import User

    async def _go() -> int:
        async with SessionLocal() as db:
            u = (await db.execute(select(User).where(User.email == email))).scalar_one()
            u.is_staff = True
            db.add(u)
            await db.commit()
            return u.id

    return asyncio.run(_go())


def test_wifi_flow(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})

    bad = client.post("/api/wifi-mac", json={"mac": "not-a-mac"})
    assert bad.status_code == 400

    ok = client.post("/api/wifi-mac", json={"mac": "AA:BB:CC:DD:EE:FF"})
    assert ok.status_code == 200
    st = client.get("/api/wifi-status")
    assert st.json()["mac_sent"] is True
    assert st.json()["verified"] is False
    # отправка MAC ≠ верификация: задача не отмечена
    assert "1-wifi" not in client.get("/api/me").json()["progress"]["done_tasks"]["1"]

    wrong = client.post("/api/wifi-verify", json={"password": "nope"})
    assert wrong.status_code == 400

    from app.config import settings

    good = client.post("/api/wifi-verify", json={"password": settings.wifi_password})
    assert good.status_code == 200
    assert "1-wifi" in good.json()["done_tasks"]["1"]
    st2 = client.get("/api/wifi-status")
    assert st2.json()["verified"] is True


def test_mpulse_and_confluence_flow(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})

    bad = client.post("/api/verify-mpulse-code", json={"code": "WRONG"})
    assert bad.status_code == 400

    from app.config import settings

    good = client.post("/api/verify-mpulse-code", json={"code": settings.mpulse_verification_code})
    assert good.status_code == 200
    for tid in ["1-mpulse", "1-mpulse-schedule", "1-mpulse-checkin", "1-mpulse-code", "1-mpulse-news"]:
        assert tid in good.json()["done_tasks"]["1"]

    from datetime import datetime, timedelta, timezone

    links = ["51479172", "15370476", "86868582", "86868604", "51478978"]
    now = datetime.now(timezone.utc).isoformat()
    # не все ссылки -> 400
    few = client.post("/api/confirm-confluence", json={"opened_at": now, "links_clicked": links[:2]})
    assert few.status_code == 400
    # все ссылки, но рано -> 400
    early = client.post("/api/confirm-confluence", json={"opened_at": now, "links_clicked": links})
    assert early.status_code == 400

    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    done = client.post("/api/confirm-confluence", json={"opened_at": past, "links_clicked": links})
    assert done.status_code == 200
    assert "1-confluence-read" in done.json()["done_tasks"]["1"]

    # идемпотентность: повтор не дублирует
    again = client.post("/api/confirm-confluence", json={"opened_at": past})
    assert again.status_code == 200


def test_staff_verify_and_admin(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    uid = _grant_staff(email)

    # staff подтверждает документ сотрудника
    v = client.post("/api/verify-docs", json={"user_id": uid, "task_id": "1-dogovor"})
    assert v.status_code == 200
    assert "1-dogovor" in v.json()["done_tasks"]["1"]

    # чужая роль задачи отклоняется
    bad = client.post("/api/verify-docs", json={"user_id": uid, "task_id": "1-wifi"})
    assert bad.status_code == 400

    # admin read-side
    pend = client.get("/api/admin/pending-verifications")
    assert pend.status_code == 200
    audit = client.get("/api/admin/audit", params={"user_id": uid})
    assert audit.status_code == 200
    assert any(r["task_id"] == "1-dogovor" for r in audit.json())

    # ротация MPulse-кода: старый env-код всё ещё валиден (fallback), новый — тоже
    rot = client.post("/api/admin/mpulse-code", json={"code": "BATCH-99", "batch_name": "test"})
    assert rot.status_code == 200
    assert rot.json()["is_active"] is True
    new_ok = client.post("/api/verify-mpulse-code", json={"code": "BATCH-99"})
    assert new_ok.status_code == 200

    # персональный Wi-Fi пароль: генерация staff → env-пароль больше не подходит
    gen = client.post("/api/admin/wifi-password", json={"user_id": uid, "task_id": "1-wifi"})
    assert gen.status_code == 200
    personal = gen.json()["password"]
    assert personal
    from app.config import settings as _s

    assert client.post("/api/wifi-verify", json={"password": _s.wifi_password}).status_code == 400
    mine = client.post("/api/wifi-verify", json={"password": personal})
    assert mine.status_code == 200

    # снять staff с себя нельзя
    selfdem = client.patch(f"/api/admin/users/{uid}/staff", json={"is_staff": False})
    assert selfdem.status_code == 400

    # Figma без токена — 501 с подсказкой
    fig = client.post("/api/integrations/figma-invite")
    assert fig.status_code == 501

    # ссылки интеграций
    links = client.get("/api/integrations/links")
    assert links.status_code == 200
    assert "confluence_url" in links.json()


def test_docs_batch_flow(client):
    """Одна кнопка: request-batch (5) -> pending -> verify-batch -> XP 5."""
    docs = ["1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"]
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    uid = _grant_staff(email)

    b = client.post("/api/progress/request-batch", json={"task_ids": docs})
    assert b.status_code == 200
    assert b.json()["xp"] == 0  # XP только после HR
    mine = client.get("/api/progress/pending")
    assert sorted(mine.json()["pending"]) == sorted(docs)

    # техническая задача в батче отклоняется
    bad = client.post("/api/progress/request-batch", json={"task_ids": ["1-mpulse-code"]})
    assert bad.status_code == 400

    # HR подтверждает пакет одной кнопкой
    v = client.post("/api/verify-docs-batch", json={"task_ids": docs, "user_id": uid})
    assert v.status_code == 200
    assert v.json()["xp"] == 5
    for tid in docs:
        assert tid in v.json()["done_tasks"]["1"]
    assert client.get("/api/progress/pending").json()["pending"] == []

    # audit содержит 5 строк manual_hr
    audit = client.get("/api/admin/audit", params={"user_id": uid})
    assert audit.status_code == 200
    assert sum(1 for r in audit.json() if r["method"] == "manual_hr") >= 5


def test_reject_requires_reason_and_resubmit(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    uid = _grant_staff(email)

    client.post("/api/progress/request-batch", json={"task_ids": ["1-dogovor"]})
    pend = client.get("/api/admin/pending-verifications")
    row = next(r for r in pend.json() if r["task_id"] == "1-dogovor" and r["user_id"] == uid)

    # короткая причина отклоняется (422)
    short = client.post(f"/api/admin/pending/{row['id']}/reject", json={"reason": "нет"})
    assert short.status_code == 422

    ok = client.post(
        f"/api/admin/pending/{row['id']}/reject",
        json={"reason": "Не хватает справки о несудимости, донесите HR"},
    )
    assert ok.status_code == 200
    mine = client.get("/api/progress/pending")
    assert mine.json()["pending"] == []
    assert mine.json()["rejected"][0]["task_id"] == "1-dogovor"
    assert "справки" in mine.json()["rejected"][0]["note"]

    # повторная отправка после доделки снова создаёт pending (без 500 на unique)
    again = client.post("/api/progress/request", json={"task_id": "1-dogovor"})
    assert again.status_code == 200
    assert "1-dogovor" in client.get("/api/progress/pending").json()["pending"]


def test_reject_resubmit_batch_no_500(client):
    """request-batch -> reject всего пакета -> request-batch снова: 200, один pending на задачу."""
    docs = ["1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"]
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    _grant_staff(email)

    b1 = client.post("/api/progress/request-batch", json={"task_ids": docs})
    assert b1.status_code == 200
    pend = client.get("/api/admin/pending-verifications")
    rows = [r for r in pend.json() if r["task_id"] in docs]
    assert len(rows) == 5
    for r in rows:
        rej = client.post(f"/api/admin/pending/{r['id']}/reject", json={"reason": "Донесите справку о несудимости HR"})
        assert rej.status_code == 200
    mine = client.get("/api/progress/pending")
    assert mine.json()["pending"] == []
    assert len(mine.json()["rejected"]) == 5

    # повторная отправка пакета — 200, ровно по одному pending (без дублей и 500)
    b2 = client.post("/api/progress/request-batch", json={"task_ids": docs})
    assert b2.status_code == 200
    mine2 = client.get("/api/progress/pending")
    assert sorted(mine2.json()["pending"]) == sorted(docs)
    assert mine2.json()["rejected"] == []


def test_verify_docs_forbidden_for_employee(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    r = client.post("/api/verify-docs", json={"user_id": 1, "task_id": "1-dogovor"})
    assert r.status_code == 403
    adm = client.get("/api/admin/users")
    assert adm.status_code == 403


def test_request_queue_flow(client):
    """Замок: request -> pending -> staff verify -> done + XP. Без свободного toggle."""
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    client.post("/api/role", json={"role": "frontend"})
    uid = _grant_staff(email)

    # запрос (не toggle): XP не начисляется, задача не в done
    q = client.post("/api/progress/request", json={"task_id": "1-dogovor"})
    assert q.status_code == 200
    assert "1-dogovor" not in q.json()["done_tasks"]["1"]
    assert q.json()["xp"] == 0

    # повтор идемпотентен
    q2 = client.post("/api/progress/request", json={"task_id": "1-dogovor"})
    assert q2.status_code == 200

    # мои pending видны
    mine = client.get("/api/progress/pending")
    assert "1-dogovor" in mine.json()["pending"]

    # очередь HR видит запрос
    pend = client.get("/api/admin/pending-verifications")
    assert pend.status_code == 200
    row = next(r for r in pend.json() if r["task_id"] == "1-dogovor" and r["user_id"] == uid)
    assert row["email"] == email

    # техническая задача через request отклоняется
    tech = client.post("/api/progress/request", json={"task_id": "1-mpulse-code"})
    assert tech.status_code == 400

    # staff подтверждает -> done + XP + запрос закрыт
    v = client.post("/api/verify-docs", json={"user_id": uid, "task_id": "1-dogovor"})
    assert v.status_code == 200
    assert "1-dogovor" in v.json()["done_tasks"]["1"]
    assert v.json()["xp"] == 1
    pend2 = client.get("/api/admin/pending-verifications")
    assert all(not (r["task_id"] == "1-dogovor" and r["user_id"] == uid) for r in pend2.json())

    # отклонение
    client.post("/api/progress/request", json={"task_id": "1-nda"})
    pend3 = client.get("/api/admin/pending-verifications")
    row2 = next(r for r in pend3.json() if r["task_id"] == "1-nda" and r["user_id"] == uid)
    rej = client.delete(f"/api/admin/pending/{row2['id']}")
    assert rej.status_code == 200
    mine2 = client.get("/api/progress/pending")
    assert "1-nda" not in mine2.json()["pending"]

    # сброс Stage 1
    client.post("/api/progress/request", json={"task_id": "1-nda"})
    reset = client.post(f"/api/admin/users/{uid}/reset-stage1")
    assert reset.status_code == 200
    me = client.get("/api/me")
    assert me.json()["progress"]["done_tasks"]["1"] == []
    assert me.json()["progress"]["xp"] == 0
