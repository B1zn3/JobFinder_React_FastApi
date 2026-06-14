import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authSession, initializeSession } from './session'

type UserRole = 'applicant' | 'company' | 'admin'

type RequireAuthProps = {
  allowedRoles?: UserRole[]
}

export const RequireAuth = ({ allowedRoles }: RequireAuthProps) => {
  const location = useLocation()

  const [checking, setChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authVersion, setAuthVersion] = useState(0)

  useEffect(() => {
    const handleAuthChanged = () => {
      setAuthVersion((prev) => prev + 1)
    }

    window.addEventListener('auth-changed', handleAuthChanged)

    return () => {
      window.removeEventListener('auth-changed', handleAuthChanged)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const run = async () => {
      setChecking(true)

      const hasTokenBeforeCheck = Boolean(authSession.getAccessToken())

      if (!hasTokenBeforeCheck) {
        if (!mounted) return

        setIsAuthorized(false)
        setChecking(false)
        return
      }

      const ok = await initializeSession()

      if (!mounted) return

      setIsAuthorized(ok && Boolean(authSession.getAccessToken()))
      setChecking(false)
    }

    void run()

    return () => {
      mounted = false
    }
  }, [authVersion, location.pathname])

  if (checking) {
    return <div style={{ padding: 24 }}>Проверяем сессию...</div>
  }

  if (!isAuthorized) {
    const isLogoutRedirect = sessionStorage.getItem('jobfinder_logout_redirect') === '1'

    if (isLogoutRedirect) {
      sessionStorage.removeItem('jobfinder_logout_redirect')
      return <Navigate to="/" replace />
    }

    const loginPath = allowedRoles?.includes('admin') ? '/admin/login' : '/login'

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  const currentRole = authSession.getRole() as UserRole | null

  if (!currentRole) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}