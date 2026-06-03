import axios, { AxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { env } from '../../shared/config/env'
import { authSession } from '../../shared/auth/session'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'
import heroImage from '../../assets/регистрция.avif'
import './register.css'

type RoleUi = 'applicant' | 'company'
type RegisterStep = 'form' | 'confirm'

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

type RegisterFieldErrors = {
  email: string[]
  password: string[]
  confirmPassword: string[]
  companyName: string[]
}

type ConfirmFieldErrors = {
  code: string[]
}

type PendingRegisterPayload = {
  email: string
  password: string
  role: RoleUi
  company_name: string | null
}

const authApi = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const CODE_RE = /^\d{6}$/
const SPECIAL_RE = /[^A-Za-zА-Яа-я0-9]/
const STORAGE_KEY = 'jobfinder_register_pending'
const RESEND_COOLDOWN_SECONDS = 60

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const emptyRegisterFieldErrors = (): RegisterFieldErrors => ({
  email: [],
  password: [],
  confirmPassword: [],
  companyName: [],
})

const emptyConfirmFieldErrors = (): ConfirmFieldErrors => ({
  code: [],
})

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
    lower.includes('пользователь с таким email уже существует') ||
    lower.includes('email уже используется') ||
    lower.includes('user already exists') ||
    lower.includes('already exists')
  ) {
    return 'Пользователь с таким email уже существует.'
  }

  if (
    lower.includes('название компании обязательно') ||
    lower.includes('company name')
  ) {
    return 'Для работодателя нужно указать название компании.'
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

  if (
    lower.includes('регистрация не найдена') ||
    lower.includes('сессия регистрации не найдена')
  ) {
    return 'Сессия регистрации истекла. Заполните форму заново.'
  }

  if (
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('слишком много')
  ) {
    return 'Слишком много попыток. Попробуйте чуть позже.'
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
      return ['Недостаточно прав или неверные данные.']
    case 409:
      return ['Пользователь с таким email уже существует.']
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

export const RegisterPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const [step, setStep] = useState<RegisterStep>('form')
  const [role, setRole] = useState<RoleUi>('applicant')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [code, setCode] = useState('')
  const [pendingPayload, setPendingPayload] = useState<PendingRegisterPayload | null>(null)

  const [registerFieldErrors, setRegisterFieldErrors] = useState<RegisterFieldErrors>(
    emptyRegisterFieldErrors(),
  )
  const [confirmFieldErrors, setConfirmFieldErrors] = useState<ConfirmFieldErrors>(
    emptyConfirmFieldErrors(),
  )

  const [formErrors, setFormErrors] = useState<string[]>([])
  const [formSuccess, setFormSuccess] = useState('')

  const [submitLoading, setSubmitLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as PendingRegisterPayload

      if (parsed?.email && parsed?.password && parsed?.role) {
        setPendingPayload(parsed)
        setEmail(parsed.email)
        setPassword(parsed.password)
        setConfirmPassword(parsed.password)
        setRole(parsed.role)
        setCompanyName(parsed.company_name || '')
        setStep('confirm')
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (step !== 'confirm' || resendCooldown <= 0) return

    const timerId = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [step, resendCooldown])

  const roleText = {
    applicant: 'Создайте профиль, чтобы откликаться на вакансии и управлять резюме.',
    company: 'Создайте профиль компании, чтобы публиковать вакансии и находить сотрудников.',
  }

  const brandTitle = useMemo(() => {
    return step === 'confirm' ? 'Подтвердите email' : 'Создание аккаунта'
  }, [step])

  const brandDescription = useMemo(() => {
    if (step === 'confirm') {
      return 'Мы отправили код подтверждения на почту. Введите его, чтобы завершить регистрацию.'
    }

    return roleText[role]
  }, [role, step])

  const getSuccessRedirect = (successRole: RoleUi) => {
    if (locationState?.from) return locationState.from
    return successRole === 'company' ? 'employer/vacancies' : '/applicant'
  }

  const clearFormMessages = () => {
    setFormErrors([])
    setFormSuccess('')
  }

  const clearRegisterFieldErrors = () => {
    setRegisterFieldErrors(emptyRegisterFieldErrors())
  }

  const clearConfirmFieldErrors = () => {
    setConfirmFieldErrors(emptyConfirmFieldErrors())
  }

  const validateRegisterForm = () => {
    const nextErrors = emptyRegisterFieldErrors()

    nextErrors.email = validateEmail(email)
    nextErrors.password = validatePasswordStrength(password)

    if (!confirmPassword) {
      nextErrors.confirmPassword = ['Подтвердите пароль.']
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = ['Пароли не совпадают.']
    }

    if (role === 'company') {
      if (!companyName.trim()) {
        nextErrors.companyName = ['Укажите название компании.']
      } else if (companyName.trim().length < 2) {
        nextErrors.companyName = ['Название компании должно содержать минимум 2 символа.']
      }
    }

    setRegisterFieldErrors(nextErrors)

    return Object.values(nextErrors).every((items) => items.length === 0)
  }

  const validateConfirmForm = () => {
    const nextErrors = emptyConfirmFieldErrors()

    if (!code.trim()) {
      nextErrors.code = ['Введите код из письма.']
    } else if (!CODE_RE.test(code.trim())) {
      nextErrors.code = ['Код должен состоять из 6 цифр.']
    }

    setConfirmFieldErrors(nextErrors)

    return Object.values(nextErrors).every((items) => items.length === 0)
  }

  const handleStartRegister = async (event: FormEvent) => {
    event.preventDefault()
    clearFormMessages()
    clearRegisterFieldErrors()

    if (!validateRegisterForm()) return

    const payload: PendingRegisterPayload = {
      email: email.trim(),
      password,
      role,
      company_name: role === 'company' ? companyName.trim() : null,
    }

    setSubmitLoading(true)

    try {
      await authApi.post('/auth/register', payload)

      setPendingPayload(payload)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setStep('confirm')
      setCode('')
      setFormSuccess('Код подтверждения отправлен на почту.')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setFormErrors(extractApiMessages(error, 'Не удалось начать регистрацию. Попробуйте позже.'))
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleConfirmRegister = async (event: FormEvent) => {
    event.preventDefault()
    clearFormMessages()
    clearConfirmFieldErrors()

    if (!pendingPayload) {
      setFormErrors(['Сессия регистрации не найдена. Заполните форму заново.'])
      setStep('form')
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }

    if (!validateConfirmForm()) return

    setConfirmLoading(true)

    try {
      const { data } = await authApi.post('/auth/register/confirm', {
        email: pendingPayload.email,
        code: code.trim(),
      })

      authSession.setAccessToken(data.access_token)
      authSession.setRole(pendingPayload.role)

      sessionStorage.removeItem(STORAGE_KEY)
      navigate(getSuccessRedirect(pendingPayload.role), { replace: true })
    } catch (error) {
      setFormErrors(extractApiMessages(error, 'Не удалось подтвердить регистрацию.'))
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return

    clearFormMessages()

    if (!pendingPayload) {
      setFormErrors(['Сессия регистрации не найдена. Заполните форму заново.'])
      setStep('form')
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }

    setResendLoading(true)

    try {
      await authApi.post('/auth/register', pendingPayload)

      setFormSuccess('Новый код подтверждения отправлен на почту.')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setFormErrors(extractApiMessages(error, 'Не удалось отправить код повторно.'))
    } finally {
      setResendLoading(false)
    }
  }

  const handleBackToForm = () => {
    clearFormMessages()
    clearConfirmFieldErrors()
    setStep('form')
    setCode('')
    setPendingPayload(null)
    setResendCooldown(0)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="register-page">
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

          {step === 'form' && (
            <>
              <h2 className="auth-panel__title">Регистрация</h2>

              <div className="auth-role-switch" role="tablist" aria-label="Роль регистрации">
                <button
                  type="button"
                  className={role === 'applicant' ? 'is-active' : ''}
                  onClick={() => {
                    setRole('applicant')
                    setCompanyName('')
                    setFormErrors([])
                    setFormSuccess('')
                    setRegisterFieldErrors((prev) => ({ ...prev, companyName: [] }))
                  }}
                >
                  Я ищу работу
                </button>

                <button
                  type="button"
                  className={role === 'company' ? 'is-active' : ''}
                  onClick={() => {
                    setRole('company')
                    setFormErrors([])
                    setFormSuccess('')
                  }}
                >
                  Я ищу сотрудников
                </button>
              </div>

              <form className="auth-form" onSubmit={handleStartRegister} noValidate>
                <MessageBox type="error" messages={formErrors} />
                <MessageBox type="success" messages={formSuccess ? [formSuccess] : []} />

                <label className="auth-label">
                  <span>Email</span>

                  <input
                    type="email"
                    className={`auth-input ${registerFieldErrors.email.length ? 'auth-input--error' : ''}`}
                    placeholder="you@example.com"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setRegisterFieldErrors((prev) => ({ ...prev, email: [] }))

                      if (formErrors.length) setFormErrors([])
                      if (formSuccess) setFormSuccess('')
                    }}
                    aria-invalid={registerFieldErrors.email.length > 0}
                  />

                  <FieldErrors errors={registerFieldErrors.email} />
                </label>

                {role === 'company' && (
                  <label className="auth-label">
                    <span>Название компании</span>

                    <input
                      type="text"
                      className={`auth-input ${registerFieldErrors.companyName.length ? 'auth-input--error' : ''}`}
                      placeholder="Например: БелСофт"
                      value={companyName}
                      autoComplete="organization"
                      onChange={(event) => {
                        setCompanyName(event.target.value)
                        setRegisterFieldErrors((prev) => ({ ...prev, companyName: [] }))

                        if (formErrors.length) setFormErrors([])
                        if (formSuccess) setFormSuccess('')
                      }}
                      aria-invalid={registerFieldErrors.companyName.length > 0}
                    />

                    <FieldErrors errors={registerFieldErrors.companyName} />
                  </label>
                )}

                <label className="auth-label">
                  <span>Пароль</span>

                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`auth-input ${registerFieldErrors.password.length ? 'auth-input--error' : ''}`}
                      placeholder="Минимум 8 символов"
                      value={password}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setRegisterFieldErrors((prev) => ({ ...prev, password: [] }))

                        if (formErrors.length) setFormErrors([])
                        if (formSuccess) setFormSuccess('')
                      }}
                      aria-invalid={registerFieldErrors.password.length > 0}
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

                  <FieldErrors errors={registerFieldErrors.password} />
                </label>

                <label className="auth-label">
                  <span>Подтвердите пароль</span>

                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`auth-input ${registerFieldErrors.confirmPassword.length ? 'auth-input--error' : ''}`}
                      placeholder="Повторите пароль"
                      value={confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setConfirmPassword(event.target.value)
                        setRegisterFieldErrors((prev) => ({ ...prev, confirmPassword: [] }))

                        if (formErrors.length) setFormErrors([])
                        if (formSuccess) setFormSuccess('')
                      }}
                      aria-invalid={registerFieldErrors.confirmPassword.length > 0}
                    />

                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <img
                        src={showConfirmPassword ? hidePasswordIcon : showPasswordIcon}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <FieldErrors errors={registerFieldErrors.confirmPassword} />
                </label>

                <button type="submit" className="auth-submit-btn" disabled={submitLoading}>
                  {submitLoading ? 'Отправляем код...' : 'Продолжить'}
                </button>
              </form>

              <div className="auth-links">
                <div className="auth-links__row">
                  <span>Уже есть аккаунт?</span>

                  <Link to="/login" state={locationState}>
                    Войти
                  </Link>
                </div>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <h2 className="auth-panel__title">Подтверждение почты</h2>

              <p className="auth-panel__subtitle">
                Мы отправили 6-значный код на почту.
              </p>

              <div className="auth-summary-card">
                <div className="auth-summary-card__row">
                  <span>Роль</span>
                  <strong>{pendingPayload?.role === 'company' ? 'Работодатель' : 'Соискатель'}</strong>
                </div>

                <div className="auth-summary-card__row">
                  <span>Email</span>
                  <strong>{pendingPayload?.email || email.trim()}</strong>
                </div>

                {pendingPayload?.role === 'company' && pendingPayload.company_name ? (
                  <div className="auth-summary-card__row">
                    <span>Компания</span>
                    <strong>{pendingPayload.company_name}</strong>
                  </div>
                ) : null}
              </div>

              <form className="auth-form" onSubmit={handleConfirmRegister} noValidate>
                <MessageBox type="error" messages={formErrors} />
                <MessageBox type="success" messages={formSuccess ? [formSuccess] : []} />

                <label className="auth-label">
                  <span>Код из письма</span>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`auth-input auth-input--center ${confirmFieldErrors.code.length ? 'auth-input--error' : ''}`}
                    placeholder="000000"
                    value={code}
                    autoComplete="one-time-code"
                    onChange={(event) => {
                      const clean = event.target.value.replace(/\D/g, '')

                      setCode(clean)
                      setConfirmFieldErrors({ code: [] })

                      if (formErrors.length) setFormErrors([])
                      if (formSuccess) setFormSuccess('')
                    }}
                    aria-invalid={confirmFieldErrors.code.length > 0}
                  />

                  <FieldErrors errors={confirmFieldErrors.code} />
                </label>

                <div className="auth-inline-actions">
                  <button type="submit" className="auth-submit-btn" disabled={confirmLoading}>
                    {confirmLoading ? 'Подтверждаем...' : 'Завершить регистрацию'}
                  </button>

                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={handleResendCode}
                    disabled={resendLoading || resendCooldown > 0}
                  >
                    {resendLoading
                      ? 'Отправляем...'
                      : resendCooldown > 0
                        ? `Повторно через ${resendCooldown} с`
                        : 'Отправить код ещё раз'}
                  </button>

                  <button
                    type="button"
                    className="auth-secondary-btn"
                    onClick={handleBackToForm}
                    disabled={confirmLoading || resendLoading}
                  >
                    Изменить данные
                  </button>
                </div>
              </form>

              <div className="auth-links">
                <div className="auth-links__row">
                  <span>Уже есть аккаунт?</span>

                  <Link to="/login" state={locationState}>
                    Войти
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
} 