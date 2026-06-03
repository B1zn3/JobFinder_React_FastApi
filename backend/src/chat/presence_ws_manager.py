from collections import defaultdict

from fastapi import WebSocket


class PresenceWebSocketManager:
    def __init__(self):
        self.user_connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        if user_id not in self.user_connections:
            return

        self.user_connections[user_id].discard(websocket)

        if not self.user_connections[user_id]:
            del self.user_connections[user_id]

    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.user_connections and bool(self.user_connections[user_id])

    def online_user_ids(self) -> list[int]:
        return list(self.user_connections.keys())

    async def broadcast_presence(self, payload: dict) -> None:
        dead_connections: list[tuple[int, WebSocket]] = []

        for user_id, sockets in list(self.user_connections.items()):
            for websocket in list(sockets):
                try:
                    await websocket.send_json(payload)
                except Exception:
                    dead_connections.append((user_id, websocket))

        for user_id, websocket in dead_connections:
            self.disconnect(user_id, websocket)


presence_ws_manager = PresenceWebSocketManager()
