from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.core.config import settings


DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(
    url=DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

async_session = sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)