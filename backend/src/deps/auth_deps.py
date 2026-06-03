from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from src.deps.db_deps import get_db
from src.cruds.auth_crud import authcrud
from src.redis.auth import blacklist_manager, session_manager
from src.utils.auth_utils import JWTToken
from src.core.exceptions import InvalidTokenError, ExpiredTokenError, TokenRevokedError
from src.core.constants import TokenType
from src.utils.logger import logger

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = JWTToken.decode_token(token, expected_type=TokenType.ACCESS)
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        jti = payload.get("jti")

        if not user_id or not session_id or not jti:
            raise InvalidTokenError("Недостаточно данных в токене")

        if await blacklist_manager.is_access_jti_blacklisted(jti):
            raise TokenRevokedError("Токен отозван")

        session = await session_manager.get_session(str(user_id), session_id)
        if not session:
            raise TokenRevokedError("Сессия не найдена")
        if session.get("access_jti") != jti:
            logger.warning(f"🔐 JTI MISMATCH: session jti={session.get('access_jti')}, token jti={jti}")
            raise TokenRevokedError("Токен не соответствует текущей сессии")

    except (InvalidTokenError, ExpiredTokenError, TokenRevokedError) as e:
        logger.warning(f"Authentication failed: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected auth error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Ошибка аутентификации")

    user = await authcrud.get_with_role(db, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Пользователь не найден или неактивен")
    return user

def require_role(required_role: str):
    def role_dependency(current_user = Depends(get_current_user)):
        if not current_user.role or current_user.role.name != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Доступ запрещён. Требуется роль: {required_role}"
            )
        return current_user
    return role_dependency