"""OIDC service for MDigital Portal integration.

Handles: discovery, PKCE/state/nonce generation, token exchange,
JWKS validation, user upsert, refresh token rotation.

Flow:
  1. /api/auth/oidc/start  → generate state/nonce/verifier, store in oidc_states, return authorize URL
  2. /api/auth/oidc/callback → validate state, exchange code for tokens, verify ID token, upsert user, set session
"""

import base64
import hashlib
import secrets
import time
from dataclasses import dataclass, field
from functools import lru_cache
from logging import getLogger

import httpx
import jwt
from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = getLogger(__name__)

# ---------------------------------------------------------------------------
# Discovery / JWKS cache
# ---------------------------------------------------------------------------

_discovery_cache: dict = {}
_discovery_ts: float = 0.0
DiscoveryExpired = 3600  # 1 hour


async def _discovery() -> dict:
    global _discovery_cache, _discovery_ts
    now = time.time()
    if _discovery_cache and now - _discovery_ts < DiscoveryExpired:
        return _discovery_cache
    url = f"{settings.oidc_issuer.rstrip('/')}/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10) as cl:
        resp = await cl.get(url)
        resp.raise_for_status()
        _discovery_cache = resp.json()
        _discovery_ts = now
        return _discovery_cache


_jwks_cache: dict = {}
_jwks_ts: float = 0.0


async def _jwks() -> dict:
    global _jwks_cache, _jwks_ts
    now = time.time()
    if _jwks_cache and now - _jwks_ts < DiscoveryExpired:
        return _jwks_cache
    disc = await _discovery()
    jwks_uri = disc["jwks_uri"]
    async with httpx.AsyncClient(timeout=10) as cl:
        resp = await cl.get(jwks_uri)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_ts = now
        return _jwks_cache


async def _get_signing_key(kid: str):
    """Return an jwt.Algorithm-compatible key for the given kid."""
    keys = (await _jwks()).get("keys", [])
    for k in keys:
        if k["kid"] == kid:
            from jwt.algorithms import RSAAlgorithm, ECAlgorithm

            if k["kty"] == "RSA":
                return RSAAlgorithm.from_jwk(k)
            elif k["kty"] == "EC":
                return ECAlgorithm.from_jwk(k)
    raise ValueError(f"Unknown kid: {kid}")


# ---------------------------------------------------------------------------
# PKCE / state / nonce
# ---------------------------------------------------------------------------

@dataclass
class OIDCState:
    state: str
    nonce: str
    code_verifier: str
    code_challenge: str

    @staticmethod
    def generate() -> "OIDCState":
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(32)
        challenge = (
            base64.urlsafe_b64encode(
                hashlib.sha256(verifier.encode()).digest()
            )
            .rstrip(b"=")
            .decode()
        )
        return OIDCState(
            state=state,
            nonce=nonce,
            code_verifier=verifier,
            code_challenge=challenge,
        )


# ---------------------------------------------------------------------------
# Token exchange
# ---------------------------------------------------------------------------

@dataclass
class OIDCTokens:
    access_token: str
    id_token: str
    refresh_token: str | None = None
    expires_in: int | None = None
    token_type: str = "Bearer"


async def exchange_code(code: str, code_verifier: str) -> OIDCTokens:
    """Exchange authorization code for tokens via token endpoint."""
    disc = await _discovery()
    token_url = disc["token_endpoint"]
    import base64 as b64
    credentials = b64.b64encode(
        f"{settings.oidc_client_id}:{settings.oidc_client_secret}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=15) as cl:
        resp = await cl.post(
            token_url,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.oidc_redirect_uri,
                "code_verifier": code_verifier,
            },
        )
        resp.raise_for_status()
        d = resp.json()
    return OIDCTokens(
        access_token=d.get("access_token", ""),
        id_token=d.get("id_token", ""),
        refresh_token=d.get("refresh_token"),
        expires_in=d.get("expires_in"),
        token_type=d.get("token_type", "Bearer"),
    )


# ---------------------------------------------------------------------------
# ID token validation
# ---------------------------------------------------------------------------

@dataclass
class OIDCClaims:
    sub: str
    email: str
    name: str
    preferred_username: str = ""
    employee_uuid: str | None = None
    role: str | None = None
    department: str | None = None
    position: str | None = None
    office: str | None = None
    ad_login: str | None = None


async def validate_id_token(id_token: str, expected_nonce: str) -> OIDCClaims:
    """Validate ID token: signature (JWKS), iss, aud, exp, nonce."""
    # Decode header to get kid
    header = jwt.get_unverified_header(id_token)
    kid = header.get("kid", "")
    signing_key = await _get_signing_key(kid)

    disc = await _discovery()
    claims = jwt.decode(
        id_token,
        signing_key,
        algorithms=["RS256", "ES256"],
        audience=settings.oidc_client_id,
        issuer=disc["issuer"],
    )

    # Nonce check
    if claims.get("nonce") != expected_nonce:
        raise ValueError("Nonce mismatch — possible replay attack")

    role_val = claims.get("role") or claims.get("user_role") or claims.get("roles")
    if isinstance(role_val, list):
        role_val = role_val[0] if role_val else None

    return OIDCClaims(
        sub=str(claims.get("sub", "")),
        email=str(claims.get("email", "")).lower().strip(),
        name=str(claims.get("name", "") or claims.get("preferred_username", "")).strip(),
        preferred_username=str(claims.get("preferred_username", "")).strip(),
        employee_uuid=claims.get("employee_uuid"),
        role=str(role_val) if role_val else None,
        department=str(claims.get("department") or claims.get("dept") or claims.get("division") or "") or None,
        position=str(claims.get("position") or claims.get("title") or claims.get("job_title") or "") or None,
        office=str(claims.get("office") or claims.get("location") or "") or None,
        ad_login=str(claims.get("ad_login") or claims.get("sAMAccountName") or claims.get("username") or "") or None,
    )


# ---------------------------------------------------------------------------
# UserInfo fetch (Portal claims_supported=["sub"] only → email/name from here)
# ---------------------------------------------------------------------------

async def fetch_userinfo(access_token: str) -> dict:
    """Fetch user profile from the userinfo endpoint using the access token."""
    disc = await _discovery()
    userinfo_url = disc.get("userinfo_endpoint")
    if not userinfo_url:
        return {}
    async with httpx.AsyncClient(timeout=10) as cl:
        resp = await cl.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# State storage (DB)
# ---------------------------------------------------------------------------

async def save_state(db: AsyncSession, oidc_state: OIDCState) -> None:
    await db.execute(
        sa_text(
            "INSERT INTO oidc_states (state, nonce, code_verifier) "
            "VALUES (:state, :nonce, :verifier)"
        ),
        {"state": oidc_state.state, "nonce": oidc_state.nonce, "verifier": oidc_state.code_verifier},
    )
    await db.commit()


async def consume_state(db: AsyncSession, state: str) -> dict | None:
    """Return {state, nonce, code_verifier} and mark used. None if missing or already used."""
    result = await db.execute(
        sa_text(
            "UPDATE oidc_states SET used = true "
            "WHERE state = :state AND used = false "
            "RETURNING nonce, code_verifier"
        ),
        {"state": state},
    )
    row = result.fetchone()
    if row is None:
        return None
    await db.commit()
    return {"state": state, "nonce": row.nonce, "code_verifier": row.code_verifier}


# ---------------------------------------------------------------------------
# User upsert
# ---------------------------------------------------------------------------

def map_portal_role(portal_role: str | None) -> str | None:
    """Маппинг строковой роли портала в frontend|backend|design."""
    if not portal_role: return None
    r = portal_role.lower().strip()
    if "front" in r: return "frontend"
    if "back" in r: return "backend"
    if "design" in r or "ui" in r: return "design"
    return None

async def upsert_user(db: AsyncSession, claims: OIDCClaims, refresh_token: str | None = None):
    """Find or create user by oidc_sub, then by email. Return (user, is_new)."""
    from app.models import User, Progress

    user = None
    is_new = False

    # 1. Find by oidc_sub
    if claims.sub:
        result = await db.execute(select(User).where(User.oidc_sub == claims.sub))
        user = result.scalar_one_or_none()

    # 2. Find by email
    if user is None and claims.email:
        result = await db.execute(select(User).where(User.email == claims.email))
        user = result.scalar_one_or_none()

    # 3. Create or Update
    if user is None:
        user = User(
            email=claims.email or f"{claims.sub}@mdigital.kg",
            password_hash="oidc-managed",
            name=claims.name or claims.preferred_username or claims.email.split("@")[0],
            oidc_sub=claims.sub or None,
            employee_uuid=claims.employee_uuid,
            oidc_refresh_token=refresh_token,
            department=claims.department,
            position=claims.position,
            office=claims.office,
            ad_login=claims.ad_login,
        )
        # Apply role if mapped
        mapped_role = map_portal_role(claims.role)
        if mapped_role: user.role = mapped_role
        
        db.add(user)
        await db.flush()
        db.add(Progress(user_id=user.id))
        is_new = True
    else:
        # Update OIDC fields (overwrite)
        user.oidc_sub = claims.sub or user.oidc_sub
        user.employee_uuid = claims.employee_uuid or user.employee_uuid
        user.name = claims.name or user.name
        user.oidc_refresh_token = refresh_token or user.oidc_refresh_token
        user.department = claims.department or user.department
        user.position = claims.position or user.position
        user.office = claims.office or user.office
        user.ad_login = claims.ad_login or user.ad_login
        
        # Apply role if mapped
        mapped_role = map_portal_role(claims.role)
        if mapped_role: user.role = mapped_role

    await db.commit()
    await db.refresh(user)
    return user, is_new


# ---------------------------------------------------------------------------
# Refresh token (server-side only, for future use)
# ---------------------------------------------------------------------------

async def refresh_access_token(refresh_token: str) -> OIDCTokens | None:
    """Refresh tokens using stored refresh token. Returns None on failure."""
    try:
        disc = await _discovery()
        token_url = disc["token_endpoint"]
        import base64 as b64
        credentials = b64.b64encode(
            f"{settings.oidc_client_id}:{settings.oidc_client_secret}".encode()
        ).decode()
        async with httpx.AsyncClient(timeout=15) as cl:
            resp = await cl.post(
                token_url,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            resp.raise_for_status()
            d = resp.json()
        return OIDCTokens(
            access_token=d.get("access_token", ""),
            id_token=d.get("id_token", ""),
            refresh_token=d.get("refresh_token"),
            expires_in=d.get("expires_in"),
        )
    except Exception as e:
        logger.warning(f"OIDC refresh failed: {e}")
        return None
