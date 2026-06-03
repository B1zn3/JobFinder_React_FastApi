from src.redis.client import redis_client

class LockService:
    async def acquire_lock(self, lock_key: str, timeout: int = 10) -> bool:
        result = await redis_client.client.set(lock_key, "locked", nx=True, ex=timeout)
        return result is not None

    async def release_lock(self, lock_key: str):
        await redis_client.client.delete(lock_key)

lock_service = LockService()