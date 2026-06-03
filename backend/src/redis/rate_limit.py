from datetime import datetime
from src.redis.client import redis_client

class RateLimitService:
    async def check_and_increment(self, key: str, limit: int, window: int) -> bool:
        now = datetime.utcnow().timestamp()
        pipeline = redis_client.client.pipeline()
        pipeline.zadd(key, {now: now})
        pipeline.zremrangebyscore(key, 0, now - window)
        pipeline.zcard(key)
        pipeline.expire(key, window)
        results = await pipeline.execute()
        return results[2] <= limit

rate_limiter = RateLimitService()