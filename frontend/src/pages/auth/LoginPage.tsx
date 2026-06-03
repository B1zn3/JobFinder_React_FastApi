import axios, { AxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { env } from '../../shared/config/env'
import { authSession } from '../../shared/auth/session'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'
import heroImage from '../../assets/регистрция.avif'
import './login.css'

type RoleUi = 'applicant' | 'company'
type ViewMode = 'login' | 'forgot-request' | 'forgot-confirm'

type FastApiValidationItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type FastApiErrorResponse = {
  detail?: FastApiValidationItem[] | string | { message?: string }
}

type LocationState = {
  from?: string
}

type LoginFieldErrors = {
  email: string[]
  password: string[]
}

type ResetRequestFieldErrors = {
  email: string[]
}

type ResetConfirmFieldErrors = {
  code: string[]
  newPassword: string[]
  confirmPassword: string[]
}

const authApi = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const CODE_RE = /^\d{6}$/
const SPECIAL_RE = /[^A-Za-zА-Яа-я0-9]/
const RESEND_COOLDOWN_SECONDS = 60

const emptyLoginFieldErrors = (): LoginFieldErrors => ({
  email: [],
  password: [],
})

const emptyResetRequestFieldErrors = (): ResetRequestFieldErrors => ({
  email: [],
})

const emptyResetConfirmFieldErrors = (): ResetConfirmFieldErrors => ({
  code: [],
  newPassword: [],
  confirmPassword: [],
})

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const validateEmail = (value: string) => {
  const errors: string[] = []
  const normalized = value.trim()

  if (!normalized) {
    errors.push('Укажите email.')
  } else if (!EMAIL_RE.test(normalized)) {
    errors.push('Укажите корректный email.')
  }

  return errors
}

const validatePasswordStrength = (value: string) => {
  const errors: string[] = []

  if (!value) {
    errors.push('Укажите пароль.')
    return errors
  }

  if (value.length < 8) {
    errors.push('Пароль должен содержать минимум 8 символов.')
  }

  if (!/[a-zа-я]/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну строчную букву.')
  }

  if (!/[A-ZА-Я]/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
  }

  if (!/\d/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну цифру.')
  }

  if (!SPECIAL_RE.test(value)) {
    errors.push('Пароль должен содержать хотя бы один специальный символ.')
  }

  return errors
}

const translateApiMessage = (msg?: string) => {
  if (!msg) return 'Произошла ошибка. Попробуйте ещё раз.'

  const lower = msg.toLowerCase()

  if (
    lower.includes('invalid credentials') ||
    lower.includes('incorrect credentials') ||
    lower.includes('неверные учетные данные') ||
    lower.includes('неверный логин или пароль') ||
    lower.includes('неверный email или пароль')
  ) {
    return 'Неверный email, пароль или выбранная роль.'
  }

  if (
    lower.includes('user inactive') ||
    lower.includes('inactive user') ||
    lower.includes('пользователь неактивен') ||
    lower.includes('аккаунт заблокирован')
  ) {
    return 'Аккаунт заблокирован или деактивирован.'
  }

  if (
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('слишком много')
  ) {
    return 'Слишком много попыток. Попробуйте чуть позже.'
  }

  if (
    lower.includes('input should be a valid email') ||
    lower.includes('value is not a valid email') ||
    lower.includes('valid email')
  ) {
    return 'Укажите корректный email.'
  }

  if (lower.includes('field required')) {
    return 'Заполните обязательные поля.'
  }

  if (
    lower.includes('код подтверждения истёк') ||
    lower.includes('код истек') ||
    lower.includes('code expired')
  ) {
    return 'Срок действия кода истёк. Запросите новый код.'
  }

  if (
    lower.includes('неверный код') ||
    lower.includes('invalid code')
  ) {
    return 'Неверный код подтверждения.'
  }

  if (lower.includes('новый пароль должен отличаться от текущего')) {
    return 'Новый пароль должен отличаться от текущего.'
  }

  if (
    lower.includes('регистрация не найдена') ||
    lower.includes('сессия не найдена') ||
    lower.includes('не найдена')
  ) {
    return 'Сессия подтверждения истекла. Начните заново.'
  }

  if (lower.includes('string should have at least')) {
    const num = msg.match(/(\d+)/)?.[1]
    return num ? `Поле должно содержать минимум ${num} символов.` : 'Слишком короткое значение.'
  }

  return msg
}

const extractApiMessages = (error: unknown, fallback: string) => {
  const axiosErr = error as AxiosError<FastApiErrorResponse>

  if (!axiosErr?.response) {
    return [fallback]
  }

  const data = axiosErr.response.data

  if (Array.isArray(data?.detail)) {
    return uniqueMessages(data.detail.map((item) => translateApiMessage(item.msg)))
  }

  if (typeof data?.detail === 'string') {
    return [translateApiMessage(data.detail)]
  }

  if (typeof data?.detail === 'object' && data?.detail?.message) {
    return [translateApiMessage(data.detail.message)]
  }

  switch (axiosErr.response.status) {
    case 400:
      return ['Некорректные данные. Проверьте форму и попробуйте снова.']
    case 401:
      return ['Неверный email, пароль или выбранная роль.']
    case 403:
      return ['Доступ запрещён.']
    case 404:
      return ['Данные не найдены или срок действия истёк.']
    case 409:
      return ['Конфликт данных. Попробуйте запросить новый код.']
    case 422:
      return ['Проверьте корректность введённых данных.']
    case 429:
      return ['Слишком много попыток. Попробуйте чуть позже.']
    default:
      return [fallback]
  }
}

const FieldErrors = ({ errors }: { errors: string[] }) => {
  if (!errors.length) return null

  return (
    <div className="form-field-errors" role="alert" aria-live="polite">
      {errors.map((error, index) => (
        <p key={`${error}-${index}`}>{error}</p>
      ))}
    </div>
  )
}

const MessageBox = ({
  type,
  messages,
}: {
  type: 'error' | 'success'
  messages: string[]
}) => {
  if (!messages.length) return null

  return (
    <div
      className={type === 'error' ? 'form-error-box' : 'form-success-box'}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {messages.map((message, index) => (
        <p key={`${message}-${index}`}>{message}</p>
      ))}
    </div>
  )
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const [view, setView] = useState<ViewMode>('login')
  const [role, setRole] = useState<RoleUi>('applicant')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loginFieldErrors, setLoginFieldErrors] = useState<LoginFieldErrors>(emptyLoginFieldErrors())
  const [loginErrors, setLoginErrors] = useState<string[]>([])
  const [loginSuccess, setLoginSuccess] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)

  const [resetRequestFieldErrors, setResetRequestFieldErrors] = useState<ResetRequestFieldErrors>(
    emptyResetRequestFieldErrors(),
  )
  const [resetConfirmFieldErrors, setResetConfirmFieldErrors] = useState<ResetConfirmFieldErrors>(
    emptyResetConfirmFieldErrors(),
  )

  const [resetErrors, setResetErrors] = useState<string[]>([])
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resetResendCooldown, setResetResendCooldown] = useState(0)

  useEffect(() => {
    if (view !== 'forgot-confirm' || resetResendCooldown <= 0) return

    const timerId = window.setTimeout(() => {
      setResetResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [view, resetResendCooldown])

  const roleText = {
    applicant: 'Войдите, чтобы откликаться на вакансии, управлять резюме и отслеживать отклики.',
    company: 'Войдите, чтобы публиковать вакансии, просматривать отклики и управлять компанией.',
  }

  const brandTitle = useMemo(() => {
    if (view === 'forgot-request') return 'Восстановление пароля'
    if (view === 'forgot-confirm') return 'Подтверждение кода'
    return 'Вход в аккаунт'
  }, [view])

  const brandDescription = useMemo(() => {
    if (view === 'forgot-request') {
      return 'Введите email, и мы отправим код для восстановления доступа.'
    }

    if (view === 'forgot-confirm') {
      return 'Введите код из письма и задайте новый пароль.'
    }

    return roleText[role]
  }, [role, view])

  const getSuccessRedirect = () => {
    if (locationState?.from) return locationState.from
    return role === 'company' ? '/employer/vacancies' : '/applicant'
  }

  const clearLoginState = () => {
    setLoginErrors([])
    setLoginSuccess('')
    setLoginFieldErrors(emptyLoginFieldErrors())
  }

  const clearResetState = () => {
    setResetErrors([])
    setResetSuccess('')
    setResetRequestFieldErrors(emptyResetRequestFieldErrors())
    setResetConfirmFieldErrors(emptyResetConfirmFieldErrors())
  }

  const switchToLogin = () => {
    clearResetState()
    clearLoginState()
    setView('login')
    setResetResendCooldown(0)
  }

  const switchToForgotRequest = () => {
    clearResetState()
    setResetCode('')
    setResetNewPassword('')
    setResetConfirmPassword('')
    setResetResendCooldown(0)
    setResetEmail(email.trim())
    setView('forgot-request')
  }

  const switchBackToForgotRequest = () => {
    clearResetState()
    setResetCode('')
    setResetNewPassword('')
    setResetConfirmPassword('')
    setShowResetPassword(false)
    setShowResetConfirmPassword(false)
    setResetResendCooldown(0)
    setView('forgot-request')
  }

  const validateLoginForm = () => {
    const nextErrors = emptyLoginFieldErrors()

    nextErrors.email = validateEmail(email)

    if (!password.trim()) {
      nextErrors.password = ['Укажите пароль.']
    }

    setLoginFieldErrors(nextErrors)

    return Object.values(nextErrors).every((items) => items.length === 0)
  }

  const validateResetRequestForm = () => {
    const nextErrors = emptyResetRequestFieldErrors()

    nextErrors.email = validateEmail(resetEmail)

    setResetRequestFieldErrors(nextErrors)

    return Object.values(nextErrors).every((items) => items.length === 0)
  }

  const validateResetConfirmForm = () => {
    const nextErrors = emptyResetConfirmFieldErrors()

    if (!resetCode.trim()) {
      nextErrors.code = ['Введите код из письма.']
    } else if (!CODE_RE.test(resetCode.trim())) {
      nextErrors.code = ['Код должен состоять из 6 цифр.']
    }

    nextErrors.newPassword = validatePasswordStrength(resetNewPassword)

    if (!resetConfirmPassword) {
      nextErrors.confirmPassword = ['Подтвердите новый пароль.']
    } else if (resetNewPassword !== resetConfirmPassword) {
      nextErrors.confirmPassword = ['Пароли не совпадают.']
    }

    setResetConfirmFieldErrors(nextErrors)

    return Object.values(nextErrors).every((items) => items.length === 0)
  }

  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault()
    clearLoginState()

    if (!validateLoginForm()) return

    setLoginLoading(true)

    try {
      const { data } = await authApi.post('/auth/login', {
        email: email.trim(),
        password,
        role,
      })

      authSession.setAccessToken(data.access_token)
      authSession.setRole(role)

      navigate(getSuccessRedirect(), { replace: true })
    } catch (error) {
      setLoginErrors(extractApiMessages(error, 'Не удалось выполнить вход. Попробуйте позже.'))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleResetRequestSubmit = async (event: FormEvent) => {
    event.preventDefault()
    clearResetState()

    if (!validateResetRequestForm()) return

    setResetLoading(true)

    try {
      await authApi.post('/auth/password-reset/request', {
        email: resetEmail.trim(),
      })

      setResetSuccess('Код восстановления отправлен на почту. Проверьте входящие и папку “Спам”.')
      setResetCode('')
      setResetNewPassword('')
      setResetConfirmPassword('')
      setResetResendCooldown(RESEND_COOLDOWN_SECONDS)
      setView('forgot-confirm')
    } catch (error) {
      setResetErrors(extractApiMessages(error, 'Не удалось отправить код. Попробуйте позже.'))
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetConfirmSubmit = async (event: FormEvent) => {
    event.preventDefault()
    clearResetState()

    const emailErrors = validateEmail(resetEmail)

    if (emailErrors.length) {
      setResetErrors(['Email не найден. Вернитесь назад и укажите почту заново.'])
      return
    }

    if (!validateResetConfirmForm()) return

    setResetLoading(true)

    try {
      await authApi.post('/auth/password-reset/confirm', {
        email: resetEmail.trim(),
        code: resetCode.trim(),
        new_password: resetNewPassword,
      })

      setView('login')
      setEmail(resetEmail.trim())
      setPassword('')
      setResetCode('')
      setResetNewPassword('')
      setResetConfirmPassword('')
      setShowResetPassword(false)
      setShowResetConfirmPassword(false)
      setResetResendCooldown(0)
      setLoginErrors([])
      setLoginFieldErrors(emptyLoginFieldErrors())
      setLoginSuccess('Пароль успешно изменён. Теперь можно войти с новым паролем.')
      setResetSuccess('')
      setResetErrors([])
    } catch (error) {
      setResetErrors(extractApiMessages(error, 'Не удалось изменить пароль. Попробуйте позже.'))
    } finally {
      setResetLoading(false)
    }
  }

  const handleResendResetCode = async () => {
    if (resetResendCooldown > 0) return

    clearResetState()

    const emailErrors = validateEmail(resetEmail)

    if (emailErrors.length) {
      setResetErrors(['Email не найден. Вернитесь назад и укажите почту заново.'])
      return
    }

    setResendLoading(true)

    try {
      await authApi.post('/auth/password-reset/request', {
        email: resetEmail.trim(),
      })

      setResetSuccess('Новый код отправлен на почту.')
      setResetResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setResetErrors(extractApiMessages(error, 'Не удалось отправить код повторно.'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="auth-card">
        <section className="auth-brand">
          <div className="auth-brand__content">
            <span className="auth-brand__eyebrow">JobFinder</span>
            <h1>{brandTitle}</h1>
            <p>{brandDescription}</p>
          </div>

          <img src={heroImage} alt="JobFinder" className="auth-brand__image" />
        </section>

        <section className="auth-panel">
          <Link to="/" className="auth-back-link">
            ← На главную
          </Link>

          {view === 'login' && (
            <>
              <h2 className="auth-panel__title">Вход</h2>

              <div className="auth-role-switch" role="tablist" aria-label="Роль входа">
                <button
                  type="button"
                  className={role === 'applicant' ? 'is-active' : ''}
                  onClick={() => {
                    setRole('applicant')
                    setLoginErrors([])
                    setLoginSuccess('')
                  }}
                >
                  Я соискатель
                </button>

                <button
                  type="button"
                  className={role === 'company' ? 'is-active' : ''}
                  onClick={() => {
                    setRole('company')
                    setLoginErrors([])
                    setLoginSuccess('')
                  }}
                >
                  Я работодатель
                </button>
              </div>

              <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
                <MessageBox type="error" messages={loginErrors} />
                <MessageBox type="success" messages={loginSuccess ? [loginSuccess] : []} />

                <label className="auth-label">
                  <span>Email</span>

                  <input
                    type="email"
                    className={`auth-input ${loginFieldErrors.email.length ? 'auth-input--error' : ''}`}
                    placeholder="you@example.com"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => {
                      setEmail(event.target.value)

                      if (loginFieldErrors.email.length) {
                        setLoginFieldErrors((prev) => ({ ...prev, email: [] }))
                      }

                      if (loginErrors.length) setLoginErrors([])
                      if (loginSuccess) setLoginSuccess('')
                    }}
                    aria-invalid={loginFieldErrors.email.length > 0}
                  />

                  <FieldErrors errors={loginFieldErrors.email} />
                </label>

                <label className="auth-label">
                  <span>Пароль</span>

                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`auth-input ${loginFieldErrors.password.length ? 'auth-input--error' : ''}`}
                      placeholder="Введите пароль"
                      value={password}
                      autoComplete="current-password"
                      onChange={(event) => {
                        setPassword(event.target.value)

                        if (loginFieldErrors.password.length) {
                          setLoginFieldErrors((prev) => ({ ...prev, password: [] }))
                        }

                        if (loginErrors.length) setLoginErrors([])
                        if (loginSuccess) setLoginSuccess('')
                      }}
                      aria-invalid={loginFieldErrors.password.length > 0}
                    />

                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <img
                        src={showPassword ? hidePasswordIcon : showPasswordIcon}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <FieldErrors errors={loginFieldErrors.password} />
                </label>

                <button type="submit" className="auth-submit-btn" disabled={loginLoading}>
                  {loginLoading ? 'Входим...' : 'Войти'}
                </button>
              </form>

              <div className="auth-links">
                <div className="auth-links__row">
                  <span>Нет аккаунта?</span>

                  <Link to="/register" state={locationState}>
                    Зарегистрироваться
                  </Link>
                </div>

                <div className="auth-links__row">
                  <span>Забыли пароль?</span>

                  <button type="button" className="auth-text-button" onClick={switchToForgotRequest}>
                    Восстановить
                  </button>
                </div>
              </div>
            </>
          )}

          {view === 'forgot-request' && (
            <>
              <h2 className="auth-panel__title">Восстановить пароль</h2>

              <p className="auth-panel__subtitle">
                Введите email, связанный с аккаунтом. Мы отправим код подтверждения.
              </p>

              <form className="auth-form" onSubmit={handleResetRequestSubmit} noValidate>
                <MessageBox type="error" messages={resetErrors} />
                <MessageBox type="success" messages={resetSuccess ? [resetSuccess] : []} />

                <label className="auth-label">
                  <span>Email</span>

                  <input
                    type="email"
                    className={`auth-input ${resetRequestFieldErrors.email.length ? 'auth-input--error' : ''}`}
                    placeholder="you@example.com"
                    value={resetEmail}
                    autoComplete="email"
                    onChange={(event) => {
                      setResetEmail(event.target.value)

                      if (resetRequestFieldErrors.email.length) {
                        setResetRequestFieldErrors({ email: [] })
                      }

                      if (resetErrors.length) setResetErrors([])
                      if (resetSuccess) setResetSuccess('')
                    }}
                    aria-invalid={resetRequestFieldErrors.email.length > 0}
                  />

                  <FieldErrors errors={resetRequestFieldErrors.email} />
                </label>

                <button type="submit" className="auth-submit-btn" disabled={resetLoading}>
                  {resetLoading ? 'Отправляем...' : 'Получить код'}
                </button>
              </form>

              <div className="auth-links">
                <div className="auth-links__row">
                  <span>Вспомнили пароль?</span>

                  <button type="button" className="auth-text-button" onClick={switchToLogin}>
                    Войти
                  </button>
                </div>
              </div>
            </>
          )}

          {view === 'forgot-confirm' && (
            <>
              <h2 className="auth-panel__title">Новый пароль</h2>

              <p className="auth-panel__subtitle">
                Введите код из письма и задайте новый пароль.
              </p>

              <div className="auth-summary-card">
                <div className="auth-summary-card__row">
                  <span>Код отправлен на</span>
                  <strong>{resetEmail.trim()}</strong>
                </div>
              </div>

              <form className="auth-form" onSubmit={handleResetConfirmSubmit} noValidate>
                <MessageBox type="error" messages={resetErrors} />
                <MessageBox type="success" messages={resetSuccess ? [resetSuccess] : []} />

                <label className="auth-label">
                  <span>Код из письма</span>

                  <input
                    type="text"
                    inputMode="numeric"
                    className={`auth-input auth-input--center ${resetConfirmFieldErrors.code.length ? 'auth-input--error' : ''}`}
                    placeholder="000000"
                    maxLength={6}
                    value={resetCode}
                    autoComplete="one-time-code"
                    onChange={(event) => {
                      const clean = event.target.value.replace(/\D/g, '')

                      setResetCode(clean)
                      setResetConfirmFieldErrors((prev) => ({ ...prev, code: [] }))

                      if (resetErrors.length) setResetErrors([])
                      if (resetSuccess) setResetSuccess('')
                    }}
                    aria-invalid={resetConfirmFieldErrors.code.length > 0}
                  />

                  <FieldErrors errors={resetConfirmFieldErrors.code} />
                </label>

                <label className="auth-label">
                  <span>Новый пароль</span>

                  <div className="password-input-wrapper">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      className={`auth-input ${resetConfirmFieldErrors.newPassword.length ? 'auth-input--error' : ''}`}
                      placeholder="Минимум 8 символов"
                      value={resetNewPassword}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setResetNewPassword(event.target.value)
                        setResetConfirmFieldErrors((prev) => ({ ...prev, newPassword: [] }))

                        if (resetErrors.length) setResetErrors([])
                        if (resetSuccess) setResetSuccess('')
                      }}
                      aria-invalid={resetConfirmFieldErrors.newPassword.length > 0}
                    />

                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowResetPassword((prev) => !prev)}
                      aria-label={showResetPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <img
                        src={showResetPassword ? hidePasswordIcon : showPasswordIcon}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <FieldErrors errors={resetConfirmFieldErrors.newPassword} />
                </label>

                <label className="auth-label">
                  <span>Подтвердите пароль</span>

                  <div className="password-input-wrapper">
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      className={`auth-input ${resetConfirmFieldErrors.confirmPassword.length ? 'auth-input--error' : ''}`}
                      placeholder="Повторите новый пароль"
                      value={resetConfirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setResetConfirmPassword(event.target.value)
                        setResetConfirmFieldErrors((prev) => ({ ...prev, confirmPassword: [] }))

                        if (resetErrors.length) setResetErrors([])
                        if (resetSuccess) setResetSuccess('')
                      }}
                      aria-invalid={resetConfirmFieldErrors.confirmPassword.length > 0}
                    />

                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                      aria-label={showResetConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <img
                        src={showResetConfirmPassword ? hidePasswordIcon : showPasswordIcon}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <FieldErrors errors={resetConfirmFieldErrors.confirmPassword} />
                </label>

                <div className="auth-inline-actions">
                  <button type="submit" className="auth-submit-btn" disabled={resetLoading}>
                    {resetLoading ? 'Сохраняем...' : 'Сменить пароль'}
                  </button>

                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={handleResendResetCode}
                    disabled={resendLoading || resetResendCooldown > 0}
                  >
                    {resendLoading
                      ? 'Отправляем...'
                      : resetResendCooldown > 0
                        ? `Повторно через ${resetResendCooldown} с`
                        : 'Отправить код ещё раз'}
                  </button>
                </div>
              </form>

              <div className="auth-links">
                <div className="auth-links__row">
                  <span>Нужен другой email?</span>

                  <button type="button" className="auth-text-button" onClick={switchBackToForgotRequest}>
                    Вернуться назад
                  </button>
                </div>

                <div className="auth-links__row">
                  <span>Вспомнили пароль?</span>

                  <button type="button" className="auth-text-button" onClick={switchToLogin}>
                    Войти
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}