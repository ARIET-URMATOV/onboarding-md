"""Bootstrap the first staff admin.

Ensures the user with ADMIN_EMAIL exists and has is_staff=true + staff_role.
Idempotent and safe to re-run: existing staff flags are only upgraded,
never downgraded.

Usage:
    cd backend && ADMIN_EMAIL="boss@mdigital.kg" [ADMIN_ROLE=admin] [ADMIN_NAME="Boss"] \
        DATABASE_URL="postgresql+asyncpg://md:md@localhost:5432/mdigital" \
        .venv/bin/python scripts/seed_admin.py

Notes:
- If the user does not exist yet, a row is pre-created (empty password hash —
  password login will fail; first OIDC login links by email automatically).
- Valid ADMIN_ROLE values: hr, sysadmin, admin (default: admin).
- Further staff/roles are managed from the admin UI (/admin → users tab).
"""
import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

VALID_ROLES = ("hr", "sysadmin", "admin")


async def main() -> None:
    from app.database import SessionLocal
    from app.models import User

    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    if not email or "@" not in email:
        print("ERROR: set a valid ADMIN_EMAIL env var (e.g. ADMIN_EMAIL=boss@mdigital.kg)")
        raise SystemExit(1)

    role = os.environ.get("ADMIN_ROLE", "admin").strip().lower() or "admin"
    if role not in VALID_ROLES:
        print(f"ERROR: ADMIN_ROLE must be one of {list(VALID_ROLES)}, got {role!r}")
        raise SystemExit(1)

    name = os.environ.get("ADMIN_NAME", "").strip() or email.split("@")[0]

    from sqlalchemy import select

    async with SessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if user is None:
            user = User(email=email, password_hash="", name=name)
            db.add(user)
            await db.flush()
            print(f"created user row id={user.id} email={email} (first OIDC login will link it)")
        else:
            print(f"found user id={user.id} email={email} (is_staff={user.is_staff}, staff_role={user.staff_role})")

        changed = []
        if not user.is_staff:
            user.is_staff = True
            changed.append("is_staff=true")
        if user.staff_role != role:
            user.staff_role = role
            changed.append(f"staff_role={role}")

        await db.commit()
        if changed:
            print(f"updated: {', '.join(changed)}")
        else:
            print("already a staff admin with this role — nothing to do")


if __name__ == "__main__":
    asyncio.run(main())
