#!/bin/sh
set -e

# Выполняем миграции
alembic upgrade head

# Загрузка демо-данных (только если таблица users пуста)
if [ -f /app/demo_backup.sql ]; then
    # Проверяем, есть ли хоть одна запись в таблице users
    TABLE_EXISTS=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT EXISTS (SELECT 1 FROM users LIMIT 1)" 2>/dev/null | tr -d ' ')
    
    if [ "$TABLE_EXISTS" = "f" ]; then
        echo "Loading demo data from /app/demo_backup.sql ..."
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /app/demo_backup.sql
        echo "Demo data loaded."
    else
        echo "Demo data already exists, skipping."
    fi
fi

# Запускаем приложение
exec uvicorn src.main:app --host 0.0.0.0 --port 8000