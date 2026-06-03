import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { authSession } from '../../shared/auth/session'
import { useUnreadChatsCount } from '../hooks/useUnreadChatsCount'
import './Header.css'

const ChatIcon = () => (
  <svg viewBox="0 0 23 23" fill="none" aria-hidden="true">
    <path
      d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M16 17l5-5-5-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12H9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BurgerIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {open ? (
      <>
        <path
          d="M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M6 6l12 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        <path
          d="M4 7h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 12h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
)

const ChatBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null

  return (
    <span className="header__chat-badge" aria-label={`Непрочитанных сообщений: ${count}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

export const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const burgerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const isAuthenticated = !!authSession.getAccessToken()
  const role = authSession.getRole()

  const unreadChatsQuery = useUnreadChatsCount()
  const unreadChatsCount = unreadChatsQuery.data || 0

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        burgerRef.current &&
        !burgerRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    setIsMobileMenuOpen(false)
    authSession.clear()
    window.dispatchEvent(new Event('auth-changed'))
    navigate('/', { replace: true })
  }

  const closeMenu = () => setIsMobileMenuOpen(false)

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `header__nav-link${isActive ? ' active' : ''}`

  const getToolBtnClass = ({ isActive }: { isActive: boolean }) =>
    `header__tool-btn${isActive ? ' active' : ''}`

  const renderChatIconWithBadge = () => (
    <span className="header__tool-icon-wrap">
      <ChatIcon />
      <ChatBadge count={unreadChatsCount} />
    </span>
  )

  return (
    <header className="header">
      <div className="container header__inner">
        <div className="header__topline">
          <NavLink to="/" className="header__logo" onClick={closeMenu}>
            JobFinder
          </NavLink>

          <button
            ref={burgerRef}
            type="button"
            className={`header__burger ${isMobileMenuOpen ? 'is-open' : ''}`}
            aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <BurgerIcon open={isMobileMenuOpen} />
          </button>
        </div>

        <div
          ref={menuRef}
          className={`header__panel ${isMobileMenuOpen ? 'is-open' : ''}`}
        >
          <div className="header__left">
            {!isAuthenticated ? (
              <nav className="header__nav">
                <NavLink
                  to="/vacancies"
                  className={getNavLinkClass}
                  onClick={closeMenu}
                >
                  Вакансии
                </NavLink>
                <NavLink
                  to="/companies"
                  className={getNavLinkClass}
                  onClick={closeMenu}
                >
                  Компании
                </NavLink>
              </nav>
            ) : (
              <nav className="header__nav">
                {role === 'applicant' && (
                  <>
                    <NavLink
                      to="/applicant"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Резюме
                    </NavLink>
                    <NavLink
                      to="/vacancies"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Вакансии
                    </NavLink>
                    <NavLink
                      to="/companies"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Компании
                    </NavLink>
                    <NavLink
                      to="/responses"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Отклики
                    </NavLink>
                  </>
                )}

                {role === 'company' && (
                  <>
                    <NavLink
                      to="/employer/vacancies"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Мои вакансии
                    </NavLink>

                    <NavLink
                      to="/employer/applications"
                      className={getNavLinkClass}
                      onClick={closeMenu}
                    >
                      Отклики
                    </NavLink>
                  </>
                )}

                {role === 'admin' && (
                  <NavLink
                    to="/admin"
                    className={getNavLinkClass}
                    onClick={closeMenu}
                  >
                    Админ-панель
                  </NavLink>
                )}
              </nav>
            )}
          </div>

          <div className="header__actions">
            {!isAuthenticated ? (
              <>
                <NavLink
                  to="/login"
                  className="btn btn--outline"
                  onClick={closeMenu}
                >
                  Войти
                </NavLink>
                <NavLink
                  to="/register"
                  className="btn btn--primary"
                  onClick={closeMenu}
                >
                  Регистрация
                </NavLink>
              </>
            ) : (
              <>
                {role === 'applicant' && (
                  <div className="header__applicant-tools">
                    <NavLink
                      to="/applicant/chat"
                      className={getToolBtnClass}
                      aria-label="Чаты"
                      title="Чаты"
                      onClick={closeMenu}
                    >
                      {renderChatIconWithBadge()}
                      <span className="header__tool-btn-text">Чаты</span>
                    </NavLink>

                    <NavLink
                      to="/applicant/favorites"
                      className="header__tool-btn"
                      aria-label="Избранное"
                      title="Избранное"
                      onClick={closeMenu}
                    >
                      <HeartIcon />
                      <span className="header__tool-btn-text">Избранное</span>
                    </NavLink>

                    <NavLink
                      to="/applicant/profile"
                      className="header__profile-chip"
                      onClick={closeMenu}
                    >
                      <span className="header__profile-chip-avatar">
                        <UserIcon />
                      </span>
                      <span className="header__profile-chip-text">Профиль</span>
                    </NavLink>

                    <button
                      onClick={handleLogout}
                      className="header__logout-btn"
                      type="button"
                    >
                      <LogoutIcon />
                      <span className="header__logout-text">Выйти</span>
                    </button>
                  </div>
                )}

                {role === 'company' && (
                  <div className="header__employer-tools">
                    <NavLink
                      to="/employer/chat"
                      className={getToolBtnClass}
                      aria-label="Чат"
                      title="Чат"
                      onClick={closeMenu}
                    >
                      {renderChatIconWithBadge()}
                      <span className="header__tool-btn-text">Чат</span>
                    </NavLink>

                    <NavLink
                      to="/employer/company-profile"
                      className="header__profile-chip header__profile-chip--company"
                      onClick={closeMenu}
                    >
                      <span className="header__profile-chip-avatar">
                        <UserIcon />
                      </span>
                      <span className="header__profile-chip-text">Профиль</span>
                    </NavLink>

                    <button
                      onClick={handleLogout}
                      className="header__logout-btn header__logout-btn--company"
                      type="button"
                    >
                      <LogoutIcon />
                      <span className="header__logout-text">Выйти</span>
                    </button>
                  </div>
                )}

                {role === 'admin' && (
                  <div className="header__account-box">
                    <span className="header__user">Админ</span>
                    <button
                      onClick={handleLogout}
                      className="btn btn--text"
                      type="button"
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
