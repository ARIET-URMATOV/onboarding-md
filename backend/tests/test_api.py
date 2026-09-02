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
    tasks = normalize_tasks({"1": ["1-docs"]})
    assert compute_xp(tasks) == 40


def test_compute_xp_full_stage_includes_bonus():
    tasks = normalize_tasks({"1": ["1-docs", "1-lead", "1-mplus", "1-jira", "1-confluence"]})
    # 190 задач + 150 бонус
    assert compute_xp(tasks) == 340


def test_compute_xp_max_all_stages():
    full = {
        "1": ["1-docs", "1-lead", "1-mplus", "1-jira", "1-confluence"],
        "2": ["2-studio", "2-profiles", "2-lead", "2-chat"],
        "3": ["3-watch"],
        "4": ["4-workspace", "4-repo", "4-figma", "4-mail", "4-messenger", "4-style"],
        "5": ["5-take", "5-confirm"],
    }
    # 790 задач + 750 бонусов = 1540 (максимум, Lv.16)
    assert compute_xp(normalize_tasks(full)) == 1540


def test_normalize_tasks_ignores_unknown():
    tasks = normalize_tasks({"1": ["1-docs", "hax"], "9": ["x"], "2": "not-a-list"})
    # unknown task "hax" is now dropped (tightened normalize_tasks), unknown stage "9" ignored
    assert tasks["1"] == ["1-docs"]
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
    assert compute_level(1540) == 16


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

    t = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "1-docs"})
    assert t.status_code == 200
    assert t.json()["xp"] == 40

    # неизвестная задача
    bad = client.post("/api/progress/task", json={"stage_id": 1, "task_id": "hax"})
    assert bad.status_code == 400

    st = client.post("/api/progress/stage", json={"stage_id": 1, "action": "complete"})
    assert st.status_code == 200
    assert st.json()["xp"] == 340  # 190 + 150 бонус
    assert set(st.json()["done_tasks"]["1"]) == {"1-docs", "1-lead", "1-mplus", "1-jira", "1-confluence"}

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

    # reset
    r = client.post("/api/demo/reset")
    assert r.status_code == 200
    me2 = client.get("/api/me")
    assert me2.json()["progress"]["xp"] == 0
    assert me2.json()["user"]["role"] is None
    assert me2.json()["user"]["intro_seen"] is False
    assert me2.json()["user"]["avatar"] is None
    assert me2.json()["user"]["name"] == "Demo User"


def test_logout(client):
    email = _unique_email()
    client.post("/api/register", json={"email": email, "password": "secret123"})
    assert client.get("/api/me").status_code == 200

    client.post("/api/logout")
    assert client.get("/api/me").status_code == 401
