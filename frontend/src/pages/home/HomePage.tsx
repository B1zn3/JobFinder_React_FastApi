import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Footer } from '../../shared/ui/Footer'
import { Header } from '../../shared/ui/Header'
import { authSession, initializeSession } from '../../shared/auth/session'
import heroImage from '../../assets/главная.jpg'
import './home.css'

type VacancyListItem = {
  id: number
  title: string
  salary_min?: number | null
  salary_max?: number | null
  company_name: string
  company_id?: number
  city_name?: string | null
  profession_name?: string | null
}

type Company = {
  id: number
  name: string
  description?: string
  website?: string
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies_count?: number
}

type Category = {
  id: number
  name: string
  count: number
}
const formatVacanciesCount = (count?: number) => {
  const value = count ?? 0

  const mod10 = value % 10
  const mod100 = value % 100

  if (mod10 === 1 && mod100 !== 11) {
    return `${value} вакансия`
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${value} вакансии`
  }

  return `${value} вакансий`
}
const fetchVacancies = async (): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: { skip: 0, limit: 3 },
  })
  return data
}

const fetchCompanies = async (): Promise<Company[]> => {
  const { data } = await http.get('/public/companies', {
    params: { skip: 0, limit: 6 },
  })
  return data
}

const fetchPopularCategories = async (): Promise<Category[]> => {
  const { data } = await http.get('/public/professions', {
    params: { limit: 6 },
  })
  return data
}

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN'
) => {
  const min = typeof salaryMin === 'number' && salaryMin > 0 ? salaryMin : null
  const max = typeof salaryMax === 'number' && salaryMax > 0 ? salaryMax : null

  if (min && max) {
    if (min === max) {
      return `${min.toLocaleString('ru-RU')} ${currency}`
    }
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) {
    return `от ${min.toLocaleString('ru-RU')} ${currency}`
  }

  if (max) {
    return `до ${max.toLocaleString('ru-RU')} ${currency}`
  }

  return 'Зарплата не указана'
}

const CompanyLogo = ({ src, name }: { src?: string | null; name: string }) => {
  if (src) {
    return <img src={src} alt={name} className="company-logo-img" />
  }
  const initial = name.charAt(0).toUpperCase()
  return <div className="company-logo-placeholder">{initial}</div>
}

const steps = [
  { title: 'Найди', desc: 'Ищи вакансии по фильтрам или просматривай список' },
  { title: 'Откликнись', desc: 'Отправляй отклики в один клик' },
  { title: 'Пройди собеседование', desc: 'Общайся с работодателями напрямую' },
  { title: 'Получи работу', desc: 'Начинай карьеру мечты' },
]

export const HomePage = () => {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const hasSession = await initializeSession()
      if (!hasSession) return
      const role = authSession.getRole()
      if (role === 'company') navigate('/employer/vacancies', { replace: true })
      else if (role === 'admin') navigate('/admin', { replace: true })
      else navigate('/applicant', { replace: true })
    }
    checkSession()
  }, [navigate])



  const vacanciesQuery = useQuery({
    queryKey: ['landing-vacancies'],
    queryFn: fetchVacancies,
  })

  const companiesQuery = useQuery({
    queryKey: ['landing-companies'],
    queryFn: fetchCompanies,
  })

  const categoriesQuery = useQuery({
    queryKey: ['popular-categories'],
    queryFn: fetchPopularCategories,
  })

    const categoriesWithStatic = useMemo(() => {
    if (!categoriesQuery.data) return []
    // Статические числа для первых 6 категорий (можно изменить под ваши нужды)
    const staticCounts = [209, 134, 49, 87, 110, 34]
    return categoriesQuery.data.map((cat, idx) => ({
      ...cat,
      staticCount: staticCounts[idx] || Math.floor(Math.random() * 4000) + 500
    }))
  }, [categoriesQuery.data])

  const handleVacancyClick = (vacancyId: number) => {
  navigate(`/vacancies/${vacancyId}`)
}
const handleVacanciesPageClick = () => {
  navigate('/vacancies')
}
const handleCompaniesPageClick = () => {
  navigate('/companies')
}
const handleCompanyClick = (companyId: number) => {
  navigate(`/companies/${companyId}`)
}

  const handleNavClick = (path: string) => {
    navigate('/vacancies', { state: { from: path } })
  }

  const handleCategoryClick = (categoryId: number) => {
  navigate(`/vacancies?profession_id=${categoryId}`)
}
  return (
    <div className="home">
      <Header />

      <main>
        {/* Hero */}
        <section
          className="hero"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="hero__content">
            <h1 className="hero__title">Найди работу, <br /> которая тебя вдохновляет</h1>
            <p className="hero__subtitle">
              Более 10 000 вакансий в IT, финансах, маркетинге и других сферах.
              Присоединяйся к тысячам компаний, которые уже ищут сотрудников.
            </p>
            <button className="btn btn--primary btn--large" onClick={() => handleNavClick('/vacancies')}>
              Смотреть вакансии
            </button>
            <div className="hero__stats">
              <div className="stat">
                <span className="stat__value">10 000+</span>
                <span className="stat__label">вакансий</span>
              </div>
              <div className="stat">
                <span className="stat__value">5 000+</span>
                <span className="stat__label">компаний</span>
              </div>
              <div className="stat">
                <span className="stat__value">2 млн</span>
                <span className="stat__label">пользователей</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="how-it-works">
          <div className="container">
            <h2 className="section-title">Как это работает</h2>
            <div className="steps-grid">
              {steps.map((step, idx) => (
                <div key={idx} className="step-card">
                  <span className="step-number">{idx + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Popular categories — динамические кнопки */}
        <section className="categories">
          <div className="container">
            <h2 className="section-title">Популярные категории</h2>

            {categoriesQuery.isLoading && (
              <div className="categories-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="category-card category-card--skeleton">
                    <div className="skeleton skeleton--title" />
                    <div className="skeleton skeleton--line" />
                  </div>
                ))}
              </div>
            )}

            {categoriesQuery.isError && (
              <div className="message message--error">
                <p>Не удалось загрузить популярные категории</p>
              </div>
            )}

            {categoriesQuery.isSuccess && categoriesWithStatic.length === 0 && (
              <div className="message">
                <p>Нет категорий</p>
              </div>
            )}

            {categoriesQuery.isSuccess && categoriesWithStatic.length > 0 && (
              <div className="categories-grid">
                {categoriesWithStatic.map((cat) => (
                  <button
                    key={cat.id}
                    className="category-card"
                    onClick={() => handleCategoryClick(cat.id)}
                  >
                    <span className="category-name">{cat.name}</span>
                    <span className="category-count">{cat.staticCount} вакансий</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Vacancies */}
        <section className="vacancies">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Свежие вакансии</h2>
              <button className="link-more" onClick={handleVacanciesPageClick}>
                Все вакансии →
              </button>
            </div>

            {vacanciesQuery.isLoading && (
              <div className="vacancies-grid">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="vacancy-card vacancy-card--skeleton">
                    <div className="skeleton skeleton--logo" />
                    <div className="skeleton skeleton--title" />
                    <div className="skeleton skeleton--line" />
                    <div className="skeleton skeleton--line short" />
                  </div>
                ))}
              </div>
            )}

            {vacanciesQuery.isError && (
              <div className="message message--error">
                <h3>Не удалось загрузить вакансии</h3>
                <p>Попробуйте обновить страницу</p>
              </div>
            )}

            {vacanciesQuery.isSuccess && vacanciesQuery.data.length === 0 && (
              <div className="message">
                <h3>Нет вакансий</h3>
                <p>Загляните позже</p>
              </div>
            )}

            {vacanciesQuery.isSuccess && vacanciesQuery.data.length > 0 && (
              <div className="vacancies-grid">
                {vacanciesQuery.data.map((vacancy, index) => {
                  const isThird = index === 2
                  return (
                    <article
                      key={vacancy.id}
                      className={`vacancy-card ${isThird ? 'vacancy-card--third' : ''}`}
                      onClick={() => handleVacancyClick(vacancy.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleVacancyClick(vacancy.id)}
                    >
                      <div className="vacancy-card__header">
                        <div
                          className="vacancy-card__company-logo"
                          onClick={(e) => {
                            e.stopPropagation()
                            vacancy.company_id && handleCompanyClick(vacancy.company_id)
                          }}
                        >
                          <CompanyLogo name={vacancy.company_name} />
                        </div>
                      </div>
                      <div className="vacancy-card__title">{vacancy.title}</div>
                      <div className="vacancy-card__salary">
                        {formatSalary(vacancy.salary_min, vacancy.salary_max)}
                      </div>
                      <div
                        className="vacancy-card__company-name"
                        onClick={(e) => {
                          e.stopPropagation()
                          vacancy.company_id && handleCompanyClick(vacancy.company_id)
                        }}
                      >
                        {vacancy.company_name}
                      </div>
                      <div className="vacancy-card__meta">
                        {vacancy.city_name && <span>{vacancy.city_name}</span>}
                        {vacancy.profession_name && <span>{vacancy.profession_name}</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Companies */}
        <section className="companies">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Топ‑компании на платформе</h2>
              <button className="link-more" onClick={handleCompaniesPageClick}>
                Все компании →
              </button>
            </div>

            {companiesQuery.isLoading && (
              <div className="companies-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="company-card company-card--skeleton">
                    <div className="skeleton skeleton--circle" />
                    <div className="skeleton skeleton--title" />
                    <div className="skeleton skeleton--line" />
                    <div className="skeleton skeleton--line short" />
                  </div>
                ))}
              </div>
            )}

            {companiesQuery.isError && (
              <div className="message message--error">
                <h3>Не удалось загрузить компании</h3>
              </div>
            )}

            {companiesQuery.isSuccess && companiesQuery.data.length === 0 && (
              <div className="message">
                <h3>Нет компаний</h3>
              </div>
            )}

            {companiesQuery.isSuccess && companiesQuery.data.length > 0 && (
          <div className="companies-grid">
            {companiesQuery.data.map((company) => (
              <article
                key={company.id}
                className="company-card"
                onClick={() => handleCompanyClick(company.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCompanyClick(company.id)}
              >
                <div className="company-card__top">
                  <div className="company-card__logo-wrapper">
                    <CompanyLogo src={company.logo} name={company.name} />
                  </div>

                  <div className="company-card__identity">
                    <h3 className="company-card__name">{company.name}</h3>
                  </div>
                </div>

                {company.description && (
                  <p className="company-card__description">
                    {company.description.length > 96
                      ? `${company.description.slice(0, 96)}…`
                      : company.description}
                  </p>
                )}

                <div className="company-card__footer">
                  <span className="company-card__vacancies">
                    {formatVacanciesCount(company.vacancies_count)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
          </div>
        </section>

        {/* Work in Minsk — сворачиваемая секция */}
        <section className="info-minsk">
          <div className="container">
            <h2 className="section-title">Работа в Минске</h2>
            <div className="info-content">
              {!expanded ? (
                <>
                  <p>
                    На поиски работы в Минске уходит много времени? Ищете сервис, где собраны актуальные вакансии по всей Беларуси: в Минске, Гомеле, Могилеве, Витебске, Бресте и Гродно? JobFinder - это именно то, что вы искали!
                  </p>
                  <p>
                    В нашу базу ежедневно поступают актуальные предложения. Здесь найдется работа для опытных мастеров своего дела и начинающих специалистов без опыта.
                  </p>
                  <p>
                    Функционал сайта JobFinder сэкономит ваше время! Работодатели смогут быстро искать сотрудников, а соискатели подбирать интересные для себя вакансии.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    На поиски работы в Минске уходит много времени? Ищете сервис, где собраны актуальные вакансии по всей Беларуси: в Минске, Гомеле, Могилеве, Витебске, Бресте и Гродно? JobFinder - это именно то, что вы искали!
                  </p>
                  <p>
                    В нашу базу ежедневно поступают актуальные предложения. Здесь найдется работа для опытных мастеров своего дела и начинающих специалистов без опыта.
                  </p>
                  <p>
                    Функционал сайта JobFinder сэкономит ваше время! Работодатели смогут быстро искать сотрудников, а соискатели подбирать интересные для себя вакансии.
                  </p>
                  <p>
                    Есть вакансии в Минске? Нужны специалисты, которым интересна работа в Минске и области?
                  </p>
                  <p>
                    Знакомьтесь с регулярно обновляемыми резюме на JobFinder! Здесь вы найдете кандидатов на вакантную должность с необходимым стажем и набором навыков. Необходимо лишь разместить вакансию. Более того, получая доступ к нашей базе, вы сами выбираете время для изучения интересных резюме.
                  </p>
                  <p>
                    Инструменты на сайте не раз доказывали свою эффективность. Пользуясь ими, вы определенно сократите время, затрачиваемое на размещение и закрытие вакансий в Минске и других городах Беларуси. Теперь информация о тех, кто ищет работу в Минске, оказывается в вашем распоряжении по первому же требованию.
                  </p>
                  <p>
                    JobFinder – беспроигрышный сайт для поиска работы!
                  </p>
                </>
              )}
            </div>
            <button className="expand-button" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Свернуть' : 'Развернуть'} 
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: 8 }}>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d={expanded ? "m8 4.5 5 5-.99.99L8 6.48 3.99 10.5 3 9.5z" : "m8 11.5 5-5-.99-.99L8 9.52 3.99 5.51 3 6.5z"}
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}