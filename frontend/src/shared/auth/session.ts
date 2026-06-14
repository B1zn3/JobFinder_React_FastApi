import { AxiosError } from 'axios'
import { publicHttp } from '../api/http'

type RoleValue = 'applicant' | 'company' | 'admin'

type TokenResponse = {
  access_token: string
  refresh_token?: string
  token_type: string
}

const ACCESS_TOKEN_KEY = 'access_token'
const ROLE_KEY = 'role'
const LOGGED_OUT_KEY = 'jobfinder_logged_out'

const AUTH_STORAGE_KEYS = [
  'access_token',
  'token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'role',
  'user',
  'currentUser',
]

export const AUTH_CHANGED_EVENT = 'auth-changed'

let logoutInProgress = false

const emitAuthChanged = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const authSession = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),

  setAccessToken: (token: string) => {
    logoutInProgress = false
    sessionStorage.removeItem(LOGGED_OUT_KEY)

    localStorage.removeItem('token')
    localStorage.removeItem('accessToken')
    localStorage.setItem(ACCESS_TOKEN_KEY, token)

    emitAuthChanged()
  },

  getRole: () => localStorage.getItem(ROLE_KEY),

  setRole: (role: RoleValue) => {
    localStorage.setItem(ROLE_KEY, role)
    emitAuthChanged()
  },

  isLoggedOut: () => {
    return logoutInProgress || sessionStorage.getItem(LOGGED_OUT_KEY) === '1'
  },

  clear: () => {
    AUTH_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key)
    })

    emitAuthChanged()
  },

  markLoggedOut: () => {
    logoutInProgress = true
    sessionStorage.setItem(LOGGED_OUT_KEY, '1')

    AUTH_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key)
    })

    emitAuthChanged()
  },
}

export const refreshAccessToken = async (): Promise<string | null> => {
  if (authSession.isLoggedOut()) {
    authSession.clear()
    return null
  }

  try {
    const { data } = await publicHttp.post<TokenResponse>('/auth/refresh', {})

    if (authSession.isLoggedOut()) {
      authSession.clear()
      return null
    }

    if (!data?.access_token) {
      authSession.clear()
      return null
    }

    authSession.setAccessToken(data.access_token)
    return data.access_token
  } catch (error) {
    const axiosErr = error as AxiosError

    if (
      axiosErr.response?.status === 400 ||
      axiosErr.response?.status === 401 ||
      axiosErr.response?.status === 429
    ) {
      authSession.clear()
      return null
    }

    authSession.clear()
    return null
  }
}

export const initializeSession = async (): Promise<boolean> => {
  if (authSession.isLoggedOut()) {
    authSession.clear()
    return false
  }

  if (authSession.getAccessToken()) {
    return true
  }

  const refreshed = await refreshAccessToken()
  return Boolean(refreshed)
}

export const logoutSession = async (): Promise<void> => {
  authSession.markLoggedOut()

  try {
    await publicHttp.post('/auth/logout', {})
  } catch {
    // Даже если backend logout упал, фронт всё равно должен выйти.
  } finally {
    authSession.markLoggedOut()
  }
}