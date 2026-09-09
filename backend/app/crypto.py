"""Полевое шифрование секретов (Wi-Fi пароли) — Fernet/AES128-CBC+HMAC.

Ключ: WIFI_ENCRYPTION_KEY (urlsafe base64 32 байта, `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
В dev без ключа — эфемерный ключ на процесс + warning (секреты не переживут рестарт).
"""
import os

from cryptography.fernet import Fernet, InvalidToken

_key: Fernet | None = None


def get_fernet() -> Fernet:
    global _key
    if _key is None:
        raw = os.environ.get("WIFI_ENCRYPTION_KEY", "").strip()
        if raw:
            _key = Fernet(raw.encode())
        else:
            _key = Fernet(Fernet.generate_key())
            print("WARNING: WIFI_ENCRYPTION_KEY not set — ephemeral key, secrets won't survive restart")
    return _key


def encrypt_secret(plain: str) -> str:
    return get_fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("cannot decrypt (wrong WIFI_ENCRYPTION_KEY?)")
