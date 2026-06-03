import { useEffect, useState } from 'react'
import { AUTH_CHANGED_EVENT, authSession } from '../auth/session'

const getWsBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

  return apiUrl
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
    .replace(/\/api\/v1\/?$/, '')
}

const getAccessToken = () => {
  return (
    authSession.getAccessToken?.() ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    ''
  )
}

type PresencePayload = {
  type?: string
  user_id?: number
  online_user_ids?: number[]
  at?: string
}

let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let pingTimer: number | null = null

let currentToken = ''
let shouldReconnect = true
let onlineUserIds = new Set<number>()

const listeners = new Set<(ids: Set<number>) => void>()

const emitOnlineUsers = () => {
  const next = new Set(onlineUserIds)

  listeners.forEach((listener) => {
    listener(next)
  })
}

const clearReconnect = () => {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

const clearPing = () => {
  if (pingTimer !== null) {
    window.clearInterval(pingTimer)
    pingTimer = null
  }
}

const closeSocket = () => {
  clearReconnect()
  clearPing()

  if (socket) {
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close()
    }
  }

  socket = null
}

const disconnectPresenceSocket = () => {
  shouldReconnect = false
  currentToken = ''
  onlineUserIds = new Set()
  emitOnlineUsers()
  closeSocket()
}

const parsePresencePayload = (value: unknown): PresencePayload | null => {
  if (!value || typeof value !== 'object') return null

  const payload = value as PresencePayload

  if (payload.type !== 'presence_online' && payload.type !== 'presence_offline') {
    return null
  }

  return payload
}

const connectPresenceSocket = (token: string) => {
  if (!token) return

  if (
    socket &&
    currentToken === token &&
    (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    )
  ) {
    return
  }

  closeSocket()

  currentToken = token
  shouldReconnect = true

  const wsBaseUrl = getWsBaseUrl()

  socket = new WebSocket(
    `${wsBaseUrl}/api/v1/presence/ws?token=${encodeURIComponent(token)}`,
  )

  socket.onopen = () => {
    clearPing()

    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25_000)
  }

  socket.onmessage = (event) => {
    try {
      const payload = parsePresencePayload(JSON.parse(event.data))

      if (!payload) return

      const ids = Array.isArray(payload.online_user_ids)
        ? payload.online_user_ids.filter((id): id is number => typeof id === 'number')
        : []

      onlineUserIds = new Set(ids)
      emitOnlineUsers()
    } catch {
      // ignore invalid presence payload
    }
  }

  socket.onerror = () => {
    socket?.close()
  }

  socket.onclose = () => {
    clearPing()

    if (!shouldReconnect || !currentToken) return

    clearReconnect()

    reconnectTimer = window.setTimeout(() => {
      connectPresenceSocket(currentToken)
    }, 2500)
  }
}

const refreshPresenceSocket = () => {
  const token = getAccessToken()

  if (!token) {
    disconnectPresenceSocket()
    return
  }

  connectPresenceSocket(token)
}

export const usePresenceSocket = () => {
  useEffect(() => {
    shouldReconnect = true
    refreshPresenceSocket()

    const onAuthChanged = () => {
      refreshPresenceSocket()
    }

    const onStorage = () => {
      refreshPresenceSocket()
    }

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
}

export const useOnlineUserIds = () => {
  const [ids, setIds] = useState<Set<number>>(() => new Set(onlineUserIds))

  useEffect(() => {
    listeners.add(setIds)

    return () => {
      listeners.delete(setIds)
    }
  }, [])

  return ids
}