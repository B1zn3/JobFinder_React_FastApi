import redis.asyncio as redis
from typing import Optional
from src.core.config import settings
from src.utils.logger import logger

class BaseRedisClient:

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: Optional[redis.Redis] = None

    async def connect(self):
        if self._client is None:
            self._client = await redis.from_url(
                self.redis_url,
                decode_responses=True,
                max_connections=20,
                health_check_interval=30
            )
            logger.info("Redis connected")

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis closed")

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            raise RuntimeError("Redis client not connected. Call connect() first.")
        return self._client

    async def ping(self) -> bool:
        return await self.client.ping()

redis_client = BaseRedisClient(settings.REDIS_URL)