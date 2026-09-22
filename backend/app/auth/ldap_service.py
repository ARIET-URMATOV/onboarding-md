import logging
from dataclasses import dataclass

import ldap3
from ldap3 import ALL, SUBTREE, Server, Connection, SIMPLE
from ldap3.core.exceptions import LDAPBindError, LDAPException

from app.config import settings
from app.models import User, Progress

logger = logging.getLogger(__name__)


@dataclass
class LDAPUserAttrs:
    """Атрибуты пользователя из Active Directory."""
    sAMAccountName: str | None = None
    givenName: str | None = None
    sn: str | None = None
    mail: str | None = None
    displayName: str | None = None
    telephoneNumber: str | None = None
    department: str | None = None
    title: str | None = None
    office: str | None = None
    whenCreated: str | None = None


class LDAPAuthError(Exception):
    """Ошибка LDAP аутентификации."""
    pass


class LDAPService:
    """Сервис для аутентификации через Active Directory."""

    def __init__(self):
        self._server: Server | None = None

    @property
    def server(self) -> Server:
        if self._server is None:
            self._server = Server(
                settings.ldap_server_uri,
                get_info=ALL,
                connect_timeout=10,
            )
        return self._server

    def _get_user_dn(self, email: str) -> tuple[str, LDAPUserAttrs] | None:
        """Найти DN пользователя по email/sAMAccountName."""
        search_filter = (
            f"(&(|(mail={ldap3.utils.dn.escape_dn_chars(email)})"
            f"(sAMAccountName={ldap3.utils.dn.escape_dn_chars(email)}))"
            f"(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
        )

        try:
            with Connection(
                self.server,
                user=settings.ldap_bind_dn,
                password=settings.ldap_bind_password,
                authentication=SIMPLE,
                auto_bind=True,
                receive_timeout=10,
            ) as conn:
                conn.search(
                    search_base=settings.ldap_user_search_base,
                    search_filter=search_filter,
                    search_scope=SUBTREE,
                    attributes=[
                        "sAMAccountName", "givenName", "sn", "mail",
                        "displayName", "telephoneNumber", "department",
                        "title", "office", "whenCreated"
                    ],
                )

                if not conn.entries:
                    return None

                entry = conn.entries[0]
                attrs = LDAPUserAttrs(
                    sAMAccountName=str(entry.sAMAccountName) if entry.sAMAccountName else None,
                    givenName=str(entry.givenName) if entry.givenName else None,
                    sn=str(entry.sn) if entry.sn else None,
                    mail=str(entry.mail) if entry.mail else None,
                    displayName=str(entry.displayName) if entry.displayName else None,
                    telephoneNumber=str(entry.telephoneNumber) if entry.telephoneNumber else None,
                    department=str(entry.department) if entry.department else None,
                    title=str(entry.title) if entry.title else None,
                    office=str(entry.office) if entry.office else None,
                    whenCreated=str(entry.whenCreated) if entry.whenCreated else None,
                )

                return str(entry.distinguishedName), attrs

        except LDAPException as e:
            logger.warning(f"[LDAP] Search failed for {email}: {e}")
            return None

    def authenticate(self, email: str, password: str) -> User:
        """
        Аутентифицировать пользователя через AD.

        Args:
            email: Email или sAMAccountName пользователя
            password: Пароль пользователя

        Returns:
            User: Созданный или обновлённый пользователь

        Raises:
            LDAPAuthError: При ошибке аутентификации
        """
        if not settings.ldap_configured:
            raise LDAPAuthError("LDAP не настроен на сервере")

        if not email or not password:
            raise LDAPAuthError("Email и пароль обязательны")

        # 1. Найти DN пользователя
        result = self._get_user_dn(email)
        if result is None:
            raise LDAPAuthError("Пользователь не найден в AD")

        user_dn, ldap_attrs = result

        # 2. Попытка_bind с паролем пользователя
        try:
            with Connection(
                self.server,
                user=user_dn,
                password=password,
                authentication=SIMPLE,
                auto_bind=True,
                receive_timeout=10,
            ):
                pass  # Успешный bind
        except LDAPBindError:
            raise LDAPAuthError("Неверный email или пароль")

        # 3. Синхронизировать пользователя с локальной БД
        user = self._sync_user(email, ldap_attrs)
        return user

    def _sync_user(self, email: str, attrs: LDAPUserAttrs) -> User:
        """Синхронизировать данные пользователя из AD с локальной БД."""
        import secrets
        from passlib.context import CryptContext
        from sqlalchemy import select
        from sqlalchemy.orm import Session

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        email_lower = email.lower().strip()

        # Используем синхронную сессию для работы в sync контексте
        from app.database import SessionLocal
        with SessionLocal() as db:
            # Ищем пользователя по email
            result = db.execute(select(User).where(User.email == email_lower))
            user = result.scalar_one_or_none()

            if user is None:
                # Создаём нового пользователя
                user = User(
                    email=email_lower,
                    password_hash=pwd.hash(secrets.token_urlsafe(24)),
                    name=self._build_name(attrs),
                )
                db.add(user)
                db.flush()
                # Создаём прогресс
                db.add(Progress(user_id=user.id))
                db.commit()
                db.refresh(user)
                logger.info(f"[LDAP] Created new user: {email_lower}")
            else:
                # Обновляем существующего
                user.name = self._build_name(attrs)
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"[LDAP] Updated user: {email_lower}")

            return user

    def _build_name(self, attrs: LDAPUserAttrs) -> str:
        """Собрать имя из AD атрибутов."""
        first_name = attrs.givenName or ""
        last_name = attrs.sn or ""

        if first_name or last_name:
            return f"{first_name} {last_name}".strip()

        if attrs.displayName:
            return attrs.displayName

        if attrs.mail:
            return attrs.mail.split("@")[0]

        return "User"


# Глобальный инстанс
ldap_service = LDAPService()