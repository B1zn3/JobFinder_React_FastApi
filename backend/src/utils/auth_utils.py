from datetime import datetime, timedelta
import uuid
from jose import jwt, JWTError
from src.core.config import settings
from src.core.constants import TokenType
from src.core.exceptions import InvalidTokenError, ExpiredTokenError, MissingClaimError

class JWTToken:

    @classmethod
    def _create_token(cls, data: dict, token_type: TokenType, session_id: str, expires_delta: timedelta) -> str:
        to_encode = data.copy()
        now = datetime.utcnow()
        expire = now + expires_delta
        to_encode.update({
            "exp": expire,
            "iat": now,
            "nbf": now,
            "type": token_type.value,
            "jti": str(uuid.uuid4()),
            "sid": session_id
        })
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @classmethod
    def create_access_token(cls, data: dict, session_id: str, expires_delta: timedelta | None = None) -> str:
        delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return cls._create_token(data, TokenType.ACCESS, session_id, delta)

    @classmethod
    def create_refresh_token(cls, data: dict, session_id: str, expires_delta: timedelta | None = None) -> str:
        delta = expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        return cls._create_token(data, TokenType.REFRESH, session_id, delta)

    @classmethod
    def decode_token(cls, token: str, expected_type: TokenType | None = None) -> dict:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
        except JWTError as e:
            if "expired" in str(e).lower():
                raise ExpiredTokenError("Срок действия токена истёк") from e
            raise InvalidTokenError(f"Ошибка декодирования токена: {e}") from e

        if expected_type:
            token_type = payload.get("type")
            if token_type != expected_type.value:
                raise InvalidTokenError(f"Неверный тип токена. Ожидался {expected_type.value}")

        required = ["sub", "jti", "exp", "iat", "sid"]
        missing = [claim for claim in required if claim not in payload]
        if missing:
            raise MissingClaimError(f"Отсутствуют claims: {missing}")

        return payload

    @classmethod
    def get_jti(cls, token: str) -> str:
        payload = cls.decode_token(token)
        return payload["jti"]

    @classmethod
    def get_sid(cls, token: str) -> str:
        payload = cls.decode_token(token)
        return payload["sid"]
    
    @classmethod
    def get_exp(cls, token: str) -> datetime:
        """Извлекает время истечения токена (exp) как datetime."""
        payload = cls.decode_token(token)
        exp = payload.get("exp")
        if not exp:
            raise InvalidTokenError("Отсутствует exp в токене")
        return datetime.fromtimestamp(exp)