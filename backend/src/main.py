from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from src.api.v1.router import api_router
from src.redis.client import redis_client
from src.core.config import settings
from src.redis.auth import session_manager
from src.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_client.connect()
    await session_manager.initialize()
    # await seed_all()
    logger.info("Application started")
    yield
    await redis_client.close()
    logger.info("Application stopped")


app = FastAPI(lifespan=lifespan, title="JobFinder")


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    origin = request.headers.get("origin", "-")
    logger.info(f"HTTP {request.method} {request.url.path} origin={origin}")

    if request.method == "OPTIONS":
        response = await call_next(request)
        logger.info(f"HTTP {request.method} {request.url.path} -> {response.status_code}")
        return response

    try:
        response = await call_next(request)
        logger.info(f"HTTP {request.method} {request.url.path} -> {response.status_code}")
        return response
    except Exception as error:
        logger.exception(f"HTTP {request.method} {request.url.path} failed: {error}")
        raise


cors_origins = list(settings.cors_origins or [])

for origin in [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]:
    if origin not in cors_origins:
        cors_origins.append(origin)

logger.info(f"CORS origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router)