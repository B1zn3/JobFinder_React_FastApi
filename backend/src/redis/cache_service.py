from typing import Optional, Any
import json
from src.redis.client import redis_client

class CacheService:
    async def get(self, key: str) -> Optional[Any]:
        data = await redis_client.client.get(key)
        if data:
            return json.loads(data)
        return None

    async def set(self, key: str, value: Any, ttl: int = 3600):
        await redis_client.client.setex(key, ttl, json.dumps(value, default=str))

    async def delete(self, key: str):
        await redis_client.client.delete(key)

    async def delete_pattern(self, pattern: str):
        keys = await redis_client.client.keys(pattern)
        if keys:
            await redis_client.client.delete(*keys)

cache_service = CacheService()