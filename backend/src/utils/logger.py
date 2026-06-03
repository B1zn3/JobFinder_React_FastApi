import logging
import sys
from loguru import logger as loguru_logger

class InterceptHandler(logging.Handler):
    def emit(self, record):
        try:
            level = loguru_logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        loguru_logger.opt(depth=6, exception=record.exc_info).log(level, record.getMessage())

def setup_logging():
    logging.getLogger().handlers = [InterceptHandler()]
    for logger_name in ("uvicorn", "uvicorn.error", "fastapi"):
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]

    loguru_logger.remove()
    loguru_logger.add(
        sys.stdout,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}",
        level="INFO"
    )
    loguru_logger.add(
        "logs/auth.log",
        rotation="10 MB",
        retention="30 days",
        format="{time} | {level} | {message}",
        level="DEBUG"
    )
    return loguru_logger

logger = setup_logging()