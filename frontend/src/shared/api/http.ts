import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { env } from '../config/env'
import { authSession, refreshAccessToken } from '../auth/session'

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh']

const isPublicAuthUrl = (url?: string) => {
  if (!url) return false
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path))
}

const notifyAuthChanged = () => {
  window.dispatchEvent(new Event('auth-changed'))
}

export const publicHttp = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

export const http = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

let isRefreshing = false
let pendingQueue: Array<(token: string | null) => void> = []

const flushPendingQueue = (token: string | null) => {
  pendingQueue.forEach((resolver) => resolver(token))
  pendingQueue = []
}

http.interceptors.request.use((config) => {
  if (isPublicAuthUrl(config.url)) {
    return config
  }

  const token = authSession.getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const status = error.response?.status

    if (!originalRequest) {
      return Promise.reject(error)
    }

    if (status !== 401) {
      return Promise.reject(error)
    }

    if (isPublicAuthUrl(originalRequest.url)) {
      return Promise.reject(error)
    }

    if (originalRequest._retry) {
      return Promise.reject(error)
    }

    const currentAccessToken = authSession.getAccessToken()

    if (!currentAccessToken) {
      authSession.clear()
      notifyAuthChanged()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) {
            reject(error)
            return
          }

          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(http(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const newToken = await refreshAccessToken()

      isRefreshing = false
      flushPendingQueue(newToken)

      if (!newToken) {
        authSession.clear()
        notifyAuthChanged()
        return Promise.reject(error)
      }

      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return http(originalRequest)
    } catch (refreshError) {
      isRefreshing = false
      flushPendingQueue(null)

      authSession.clear()
      notifyAuthChanged()

      return Promise.reject(refreshError)
    }
  },
)