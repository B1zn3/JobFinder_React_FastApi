from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy import update

from src.core.config import settings
from src.chat.presence_ws_manager import presence_ws_manager
from src.db.database import async_session
from src.models.model import User


presence_router = APIRouter(prefix="/presence", tags=["Presence"])


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def set_user_online_status(user_id: int, is_online: bool) -> None:
    async with async_session() as db:
        values = {"is_online": is_online}

        if not is_online:
            values["last_seen_at"] = utc_now_naive()

        await db.execute(update(User).where(User.id == user_id).values(**values))
        await db.commit()


async def get_user_id_from_ws_token(websocket: WebSocket) -> int | None:
    token = websocket.query_params.get("token")

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if token_type != "access":
            return None

        return int(user_id)

    except (JWTError, TypeError, ValueError):
        return None


@presence_router.websocket("/ws")
async def presence_ws(websocket: WebSocket):
    user_id = await get_user_id_from_ws_token(websocket)

    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await presence_ws_manager.connect(user_id, websocket)
    await set_user_online_status(user_id=user_id, is_online=True)

    await websocket.send_json(
        {
            "type": "presence_state",
            "user_id": user_id,
            "online_user_ids": presence_ws_manager.online_user_ids(),
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )

    await presence_ws_manager.broadcast_presence(
        {
            "type": "presence_online",
            "user_id": user_id,
            "online_user_ids": presence_ws_manager.online_user_ids(),
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "user_id": user_id,
                        "at": datetime.now(timezone.utc).isoformat(),
                    }
                )

    except WebSocketDisconnect:
        pass

    except Exception:
        pass

    finally:
        presence_ws_manager.disconnect(user_id, websocket)

        if not presence_ws_manager.is_user_online(user_id):
            await set_user_online_status(user_id=user_id, is_online=False)

            await presence_ws_manager.broadcast_presence(
                {
                    "type": "presence_offline",
                    "user_id": user_id,
                    "online_user_ids": presence_ws_manager.online_user_ids(),
                    "at": datetime.now(timezone.utc).isoformat(),
                }
            )
