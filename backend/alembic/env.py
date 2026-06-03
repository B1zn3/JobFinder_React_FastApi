import os
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
import asyncio
from sqlalchemy import pool
from alembic import context

# Импорт моделей (убедитесь, что путь правильный)
from src.models.model import Base
from dotenv import load_dotenv  
# Получаем объект конфигурации Alembic
config = context.config
load_dotenv()
# Загружаем конфигурацию логирования, если указан файл
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Читаем URL базы данных из переменной окружения
# Если переменная не задана, можно использовать значение по умолчанию
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Устанавливаем URL в конфигурацию Alembic
    config.set_main_option("sqlalchemy.url", database_url)
else:
    # Если переменная не найдена, можно оставить значение из alembic.ini,
    # либо вызвать ошибку, чтобы явно указать на проблему
    raise ValueError("DATABASE_URL environment variable is not set")

# Метаданные для автогенерации миграций
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Запуск миграций в офлайн-режиме (без подключения к БД)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    async def run_async_migrations():
        connectable = create_async_engine(
            config.get_main_option("sqlalchemy.url"),
            poolclass=pool.NullPool,
        )
        async with connectable.connect() as connection:
            await connection.run_sync(
                lambda sync_conn: context.configure(
                    connection=sync_conn,
                    target_metadata=target_metadata
                )
            )
            async with connection.begin():
                await connection.run_sync(lambda sync_conn: context.run_migrations())
        await connectable.dispose()

    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()