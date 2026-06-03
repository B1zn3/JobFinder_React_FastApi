import { AxiosError } from 'axios'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession, initializeSession } from '../../shared/auth/session'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'
import showPasswordIcon from '../../assets/показать_пароль.png'
import './admin-login.css'

type FastApiValidationError = {
  detail?: Array<{ loc?: Array<string | number>; msg?: string; type?: string }> | string
}

const translateValidationMessage = (msg?: string): string => {
  if (!msg) return 'Некорректные данные.'

  if (msg.includes('String should have at least')) {
    const num = msg.match(/(\d+)/)?.[1]
    return num ? `Строка должна содержать минимум ${num} символов.` : 'Слишком короткое значение.'
  }

  if (msg.includes('Field required')) return 'Обязательное поле не заполнено.'
  if (msg.includes('Input should be a valid email')) return 'Укажите корректный email.'
  if (/[A-Za-z]/.test(msg)) return 'Некорректные данные.'

  return msg
}

const toErrorMessage = (error: unknown): string => {
  const axiosErr = error as AxiosError<FastApiValidationError>

  if (!axiosErr?.response) {
    return 'Сервер недоступен. Проверь бэкенд, CORS и подключение.'
  }

  const status = axiosErr.response.status
  const data = axiosErr.response.data

  if (Array.isArray(data?.detail)) {
    return (
      data.detail.map((item) => translateValidationMessage(item.msg)).filter(Boolean).join('; ') ||
      'Ошибка валидации данных.'
    )
  }

  if (typeof data?.detail === 'string') {
    return translateValidationMessage(data.detail)
  }

  switch (status) {
    case 400:
      return 'Некорректный запрос. Проверь введённые данные.'
    case 401:
      return 'Неверный email или пароль администратора.'
    case 403:
      return 'Доступ запрещён.'
    case 404:
      return 'Пользователь не найден.'
    case 409:
      return 'Конфликт данных. Попробуй снова.'
    case 422:
      return 'Проверь корректность email и пароля.'
    case 429:
      return 'Слишком много попыток входа. Подожди и попробуй снова.'
    default:
      return 'Внутренняя ошибка сервера. Попробуй позже.'
  }
}

export const AdminLoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const fromPath = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const bootstrap = async () => {
      const hasSession = await initializeSession()
      if (!hasSession) return

      if (authSession.getRole() === 'admin') {
        navigate(fromPath || '/admin', { replace: true })
      }
    }

    void bootstrap()
  }, [fromPath, navigate])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await http.post('/auth/login', {
        email,
        password,
        role: 'admin',
      })

      authSession.setAccessToken(data.access_token)
      authSession.setRole('admin')
      setSuccess('Вход выполнен успешно.')
      navigate(fromPath || '/admin', { replace: true })
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-card__eyebrow">JobFinder</div>
        <h1 className="admin-login-card__title">Вход для администратора</h1>
        <p className="admin-login-card__subtitle">
          Используйте учётную запись администратора для доступа к панели управления платформой.
        </p>

        <form className="admin-login-form" onSubmit={onSubmit}>
          <label className="admin-login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@jobfinder.by"
              autoComplete="email"
            />
          </label>

          <label className="admin-login-field">
            <span>Пароль</span>

            <div className="admin-login-password">
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="admin-login-password__toggle"
                onClick={() => setIsPasswordVisible((value) => !value)}
                disabled={loading}
                aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                title={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
              >
                <img
                  src={isPasswordVisible ? hidePasswordIcon : showPasswordIcon}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
          </label>

          {error ? <div className="admin-login-alert admin-login-alert--error">{error}</div> : null}
          {success ? (
            <div className="admin-login-alert admin-login-alert--success">{success}</div>
          ) : null}

          <button className="admin-login-submit" type="submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>

          <button
            type="button"
            className="admin-login-back"
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Вернуться на сайт
          </button>
        </form>
      </div>
    </div>
  )
}