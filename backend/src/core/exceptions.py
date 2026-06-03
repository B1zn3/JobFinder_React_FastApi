from fastapi import Request, status
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class BaseAppException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code

class InvalidTokenError(BaseAppException):
    def __init__(self, message: str = "Невалидный токен"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class ExpiredTokenError(BaseAppException):
    def __init__(self, message: str = "Срок действия токена истёк"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class TokenRevokedError(BaseAppException):
    def __init__(self, message: str = "Токен отозван"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class MissingClaimError(BaseAppException):
    def __init__(self, message: str = "Отсутствуют необходимые claims"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class InvalidCredentialsError(BaseAppException):
    def __init__(self, message: str = "Неверный email или пароль"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class UserInactiveError(BaseAppException):
    def __init__(self, message: str = "Пользователь деактивирован"):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)

class RateLimitExceededError(BaseAppException):
    def __init__(self, message: str = "Слишком много запросов"):
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)

async def app_exception_handler(request: Request, exc: BaseAppException):
    logger.error(f"App exception: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message}
    )

class ApplicantNotFoundError(BaseAppException):
    def __init__(self, message="Профиль соискателя не найден"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class ResumeNotFoundError(BaseAppException):
    def __init__(self, message="Резюме не найдено"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class VacancyNotFoundError(BaseAppException):
    def __init__(self, message="Вакансия не найдена"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class ApplicationNotFoundError(BaseAppException):
    def __init__(self, message="Отклик не найден"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class EducationNotFoundError(BaseAppException):
    def __init__(self, message="Запись об образовании не найдена"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class AccessDeniedError(BaseAppException):
    def __init__(self, message="Доступ запрещён"):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)

class ResumeNotOwnedError(AccessDeniedError):
    def __init__(self):
        super().__init__("Резюме не принадлежит текущему пользователю")

class DuplicateApplicationError(BaseAppException):
    def __init__(self, message="Вы уже откликались на эту вакансию"):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)

class VacancyInactiveError(BaseAppException):
    def __init__(self, message="Вакансия неактивна"):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)

class InvalidDateRangeError(BaseAppException):
    def __init__(self, message="Дата окончания не может быть раньше даты начала"):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)
