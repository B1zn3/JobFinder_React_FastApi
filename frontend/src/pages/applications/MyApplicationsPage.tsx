import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './my-applications.css'

type RawApplication = Record<string, unknown>

type ApplicationStatusKey = 'pending' | 'accepted' | 'rejected'
type StatusFilter = 'all' | ApplicationStatusKey

type ApplicationItem = {
  key: string
  applicationId: number | null
  vacancyId: number | null
  resumeId: number | null
  vacancyTitle: string
  companyName: string
  resumeTitle: string
  status: ApplicationStatusKey
  statusLabel: string
  createdAt: string | null
  updatedAt: string | null
  salaryText: string
  coverLetter: string
}

type FilterItem = {
  value: StatusFilter
  label: string
}

const PAGE_SIZE = 8

const FILTERS: FilterItem[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Отправлены' },
  { value: 'accepted', label: 'Собеседования' },
  { value: 'rejected', label: 'Отказы' },
]

const STATUS_META: Record<
  ApplicationStatusKey,
  {
    label: string
    description: string
    className: string
    icon: string
  }
> = {
  pending: {
    label: 'Отправлен',
    description: 'Отклик отправлен работодателю и ожидает рассмотрения.',
    className: 'is-pending',
    icon: '↗',
  },
  accepted: {
    label: 'Собеседование',
    description: 'Работодатель заинтересовался вашей кандидатурой.',
    className: 'is-accepted',
    icon: '✓',
  },
  rejected: {
    label: 'Отказ',
    description: 'Работодатель отклонил ваш отклик.',
    className: 'is-rejected',
    icon: '×',
  },
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const safeString = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const extractApplicationsArray = (value: unknown): RawApplication[] => {
  if (Array.isArray(value)) return value as RawApplication[]

  const object = asRecord(value)
  if (!object) return []

  const possibleKeys = ['items', 'results', 'applications', 'data']

  for (const key of possibleKeys) {
    const nested = object[key]
    if (Array.isArray(nested)) {
      return nested as RawApplication[]
    }
  }

  return []
}

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('ru-RU').format(value)
}

const formatDateShort = (value?: string | null) => {
  if (!value) return 'Дата не указана'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата не указана'

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const normalizeStatus = (value: string): ApplicationStatusKey => {
  const normalized = value.trim().toLowerCase()

  if (['accepted', 'approved', 'invited', 'success', 'positive'].includes(normalized)) {
    return 'accepted'
  }

  if (['rejected', 'declined', 'denied', 'failed', 'negative'].includes(normalized)) {
    return 'rejected'
  }

  return 'pending'
}

const formatSalary = (application: RawApplication) => {
  const vacancy = asRecord(application.vacancy ?? application.job)

  const salaryMin =
    safeNumber(application.salary_min) ??
    safeNumber(application.salaryMin) ??
    safeNumber(application.salary_from) ??
    safeNumber(application.salaryFrom) ??
    safeNumber(vacancy?.salary_min) ??
    safeNumber(vacancy?.salaryMin) ??
    safeNumber(vacancy?.salary_from) ??
    safeNumber(vacancy?.salaryFrom)

  const salaryMax =
    safeNumber(application.salary_max) ??
    safeNumber(application.salaryMax) ??
    safeNumber(application.salary_to) ??
    safeNumber(application.salaryTo) ??
    safeNumber(vacancy?.salary_max) ??
    safeNumber(vacancy?.salaryMax) ??
    safeNumber(vacancy?.salary_to) ??
    safeNumber(vacancy?.salaryTo)

  const currency = safeString(application.currency) || safeString(vacancy?.currency) || 'BYN'

  if (salaryMin !== null && salaryMax !== null) {
    if (salaryMin === salaryMax) {
      return `${formatMoney(salaryMin)} ${currency}`
    }

    return `${formatMoney(salaryMin)} — ${formatMoney(salaryMax)} ${currency}`
  }

  if (salaryMin !== null) return `от ${formatMoney(salaryMin)} ${currency}`
  if (salaryMax !== null) return `до ${formatMoney(salaryMax)} ${currency}`

  return 'Зарплата не указана'
}

const normalizeApplication = (application: RawApplication, index: number): ApplicationItem => {
  const vacancy = asRecord(application.vacancy ?? application.job)
  const company = asRecord(vacancy?.company ?? application.company)
  const resume = asRecord(application.resume)
  const profession = asRecord(resume?.profession)

  const applicationId =
    safeNumber(application.id) ??
    safeNumber(application.application_id) ??
    safeNumber(application.applicationId)

  const vacancyId =
    safeNumber(application.vacancy_id) ??
    safeNumber(application.vacancyId) ??
    safeNumber(vacancy?.id)

  const resumeId =
    safeNumber(application.resume_id) ??
    safeNumber(application.resumeId) ??
    safeNumber(resume?.id)

  const status = normalizeStatus(
    safeString(application.status) ||
      safeString(application.application_status) ||
      safeString(application.applicationStatus) ||
      safeString(application.state) ||
      'pending',
  )

  const vacancyTitle =
    safeString(application.vacancy_title) ||
    safeString(application.vacancyTitle) ||
    safeString(vacancy?.title) ||
    safeString(vacancy?.name) ||
    (vacancyId ? `Вакансия #${vacancyId}` : 'Вакансия без названия')

  const companyName =
    safeString(application.company_name) ||
    safeString(application.companyName) ||
    safeString(vacancy?.company_name) ||
    safeString(vacancy?.companyName) ||
    safeString(company?.name) ||
    'Компания не указана'

  const createdAt =
    safeString(application.created_at) ||
    safeString(application.createdAt) ||
    safeString(application.applied_at) ||
    safeString(application.appliedAt) ||
    null

  const updatedAt = safeString(application.updated_at) || safeString(application.updatedAt) || null

  const resumeTitle =
    safeString(application.resume_title) ||
    safeString(application.resumeTitle) ||
    safeString(resume?.title) ||
    safeString(resume?.name) ||
    safeString(profession?.name) ||
    (resumeId ? `Резюме #${resumeId}` : 'Резюме не указано')

  const coverLetter = safeString(application.cover_letter) || safeString(application.coverLetter)

  return {
    key: `${applicationId ?? 'application'}-${vacancyId ?? 'vacancy'}-${resumeId ?? 'resume'}-${index}`,
    applicationId,
    vacancyId,
    resumeId,
    vacancyTitle,
    companyName,
    resumeTitle,
    status,
    statusLabel: STATUS_META[status].label,
    createdAt,
    updatedAt,
    salaryText: formatSalary(application),
    coverLetter,
  }
}

const fetchMyApplications = async (): Promise<ApplicationItem[]> => {
  const { data } = await http.get('/applicants/me/applications')
  const items = extractApplicationsArray(data)

  return items
    .map(normalizeApplication)
    .sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return right - left
    })
}


const getApplicantChatLink = (applicationId: number) => {
  const currentPath = window.location.pathname
  const chatBasePath = currentPath.startsWith('/applicant') ? '/applicant/chat' : '/chat'

  return `${chatBasePath}?application_id=${applicationId}`
}

const ChatIcon = () => (
  <svg className="application-chat-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.2 18.4H6.4C4.5 18.4 3 16.9 3 15V7.9C3 6 4.5 4.5 6.4 4.5H17.6C19.5 4.5 21 6 21 7.9V15C21 16.9 19.5 18.4 17.6 18.4H12.1L7.2 21V18.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const getVisiblePages = (totalPages: number, currentPage: number): Array<number | string> => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | string> = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('left-dots')

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (end < totalPages - 1) pages.push('right-dots')

  pages.push(totalPages)

  return pages
}

const toDateStart = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDateEnd = (value: string) => {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date
}

export const MyApplicationsPage = () => {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const applicationsQuery = useQuery({
    queryKey: ['applicant-my-applications'],
    queryFn: fetchMyApplications,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applications = useMemo(() => applicationsQuery.data || [], [applicationsQuery.data])

  const stats = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter((item) => item.status === 'pending').length,
      accepted: applications.filter((item) => item.status === 'accepted').length,
      rejected: applications.filter((item) => item.status === 'rejected').length,
    }
  }, [applications])

  const filteredApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const fromDate = dateFrom ? toDateStart(dateFrom) : null
    const toDate = dateTo ? toDateEnd(dateTo) : null

    return applications.filter((application) => {
      const matchesStatus = statusFilter === 'all' || application.status === statusFilter

      const matchesSearch =
        !normalizedSearch ||
        application.vacancyTitle.toLowerCase().includes(normalizedSearch) ||
        application.companyName.toLowerCase().includes(normalizedSearch) ||
        application.resumeTitle.toLowerCase().includes(normalizedSearch)

      let matchesDate = true

      if (fromDate || toDate) {
        if (!application.createdAt) {
          matchesDate = false
        } else {
          const appDate = new Date(application.createdAt)
          if (Number.isNaN(appDate.getTime())) {
            matchesDate = false
          } else {
            if (fromDate && appDate < fromDate) matchesDate = false
            if (toDate && appDate > toDate) matchesDate = false
          }
        }
      }

      return matchesStatus && matchesSearch && matchesDate
    })
  }, [applications, search, statusFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredApplications.slice(start, start + PAGE_SIZE)
  }, [filteredApplications, currentPage])

  const visiblePages = useMemo(() => {
    return getVisiblePages(totalPages, currentPage)
  }, [totalPages, currentPage])

  const selectedFilterLabel =
    FILTERS.find((filter) => filter.value === statusFilter)?.label || 'Все'

  const hasFilters =
    Boolean(search.trim()) || statusFilter !== 'all' || Boolean(dateFrom) || Boolean(dateTo)

  const hasPagination = filteredApplications.length > PAGE_SIZE

  const shownFrom = filteredApplications.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const shownTo = Math.min(currentPage * PAGE_SIZE, filteredApplications.length)

  return (
    <div className="my-applications-page">
      <Header />

      <main className="my-applications-page__main">
        <section className="my-applications-hero">
          <div className="my-applications-container">
            <div className="my-applications-hero__card">
              <div className="my-applications-hero__content">
                <h1 className="my-applications-hero__title">Мои отклики</h1>

                <p className="my-applications-hero__subtitle">
                  Управляйте своими откликами, отслеживайте решения работодателей и быстро
                  переходите к интересующим вакансиям.
                </p>
              </div>

              <button
                type="button"
                className="my-applications-primary-btn"
                onClick={() => navigate('/vacancies')}
              >
                Найти вакансии
              </button>
            </div>
          </div>
        </section>

        <section className="my-applications-content">
          <div className="my-applications-container">
            <div className="my-applications-stats">
              <button
                type="button"
                className={`applications-stat-card ${statusFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <span>Всего</span>
                <strong>{stats.all}</strong>
              </button>

              <button
                type="button"
                className={`applications-stat-card ${
                  statusFilter === 'pending' ? 'is-active' : ''
                }`}
                onClick={() => setStatusFilter('pending')}
              >
                <span>Отправлены</span>
                <strong>{stats.pending}</strong>
              </button>

              <button
                type="button"
                className={`applications-stat-card ${
                  statusFilter === 'accepted' ? 'is-active' : ''
                }`}
                onClick={() => setStatusFilter('accepted')}
              >
                <span>Собеседования</span>
                <strong>{stats.accepted}</strong>
              </button>

              <button
                type="button"
                className={`applications-stat-card ${
                  statusFilter === 'rejected' ? 'is-active' : ''
                }`}
                onClick={() => setStatusFilter('rejected')}
              >
                <span>Отказы</span>
                <strong>{stats.rejected}</strong>
              </button>
            </div>

            <div className="applications-filters-panel">
              <div className="applications-filters-panel__left">
                <label className="applications-field applications-field--search">
                  <span>Поиск</span>
                  <input
                    type="text"
                    placeholder="Вакансия, компания или резюме"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>

                <label className="applications-field">
                  <span>Статус</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    {FILTERS.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="applications-date-range">
                  <span className="applications-date-range__label">Период отклика</span>

                  <div className="applications-date-range__box">
                    <label className="applications-date-field">
                      <span>С</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                      />
                    </label>

                    <div className="applications-date-range__divider" />

                    <label className="applications-date-field">
                      <span>По</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="applications-filters-panel__right">
                {hasFilters ? (
                  <button
                    type="button"
                    className="my-applications-ghost-btn"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                      setDateFrom('')
                      setDateTo('')
                    }}
                  >
                    Сбросить фильтры
                  </button>
                ) : null}
              </div>
            </div>

            <div className="applications-list-head">
              <div>
                <h2>{selectedFilterLabel}</h2>
                <p>
                  {filteredApplications.length > 0
                    ? `Показано ${shownFrom}–${shownTo} из ${filteredApplications.length}`
                    : 'Нет откликов для отображения'}
                </p>
              </div>
            </div>

            {applicationsQuery.isLoading ? (
              <div className="applications-list">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="application-card application-card--skeleton" />
                ))}
              </div>
            ) : null}

            {applicationsQuery.isError ? (
              <div className="applications-empty applications-empty--error">
                <h3>Не удалось загрузить отклики</h3>
                <p>Проверьте соединение с сервером или попробуйте обновить страницу.</p>
              </div>
            ) : null}

            {!applicationsQuery.isLoading &&
            !applicationsQuery.isError &&
            applications.length === 0 ? (
              <div className="applications-empty">
                <h3>У вас пока нет откликов</h3>
                <p>Когда вы откликнетесь на вакансию, она появится здесь вместе со статусом.</p>

                <button
                  type="button"
                  className="my-applications-secondary-btn"
                  onClick={() => navigate('/vacancies')}
                >
                  Смотреть вакансии
                </button>
              </div>
            ) : null}

            {!applicationsQuery.isLoading &&
            !applicationsQuery.isError &&
            applications.length > 0 &&
            filteredApplications.length === 0 ? (
              <div className="applications-empty">
                <h3>Ничего не найдено</h3>
                <p>По выбранным фильтрам отклики не найдены.</p>

                <button
                  type="button"
                  className="my-applications-secondary-btn"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : null}

            {!applicationsQuery.isLoading &&
            !applicationsQuery.isError &&
            filteredApplications.length > 0 ? (
              <>
                <div className="applications-list">
                  {paginatedApplications.map((application) => {
                    const meta = STATUS_META[application.status]
                    const companyInitial = application.companyName.trim().slice(0, 1).toUpperCase() || 'J'

                    return (
                      <article
                        key={application.key}
                        className={`application-card application-card--new ${meta.className}`}
                      >
                        <div className="application-card__status-line">
                          <span className={`application-card__status-dot ${meta.className}`} />
                          <span className="application-card__date">
                            Отклик от {formatDateShort(application.createdAt)}
                          </span>

                          <div className={`application-status ${meta.className}`}>
                            <span className="application-status__icon">{meta.icon}</span>
                            <span>{application.statusLabel}</span>
                          </div>
                        </div>

                        <div className="application-card__main">
                          <div className="application-card__logo" aria-hidden="true">
                            {companyInitial}
                          </div>

                          <div className="application-card__headline">
                            <span className="application-card__company-name">
                              {application.companyName}
                            </span>

                            <h3 className="application-card__title">
                              {application.vacancyTitle}
                            </h3>

                            <p className="application-card__subtitle">{meta.description}</p>
                          </div>
                        </div>

                        <div className="application-card__info-row">
                          <div className="application-info-pill">
                            <span>Резюме</span>
                            <strong>{application.resumeTitle}</strong>
                          </div>

                          <div className="application-info-pill">
                            <span>Зарплата</span>
                            <strong>{application.salaryText}</strong>
                          </div>

                          <div className="application-info-pill">
                            <span>Обновлено</span>
                            <strong>{formatDateShort(application.updatedAt || application.createdAt)}</strong>
                          </div>
                        </div>

                        {application.coverLetter ? (
                          <div className="application-cover-letter application-cover-letter--compact">
                            <span className="application-cover-letter__label">
                              Сопроводительное письмо
                            </span>
                            <p className="application-cover-letter__text">
                              {application.coverLetter}
                            </p>
                          </div>
                        ) : null}

                        <div className="application-card__footer application-card__footer--new">
                          <div className="application-card__hint">
                            {application.status === 'accepted'
                              ? 'Работодатель пригласил вас на следующий этап.'
                              : application.status === 'rejected'
                                ? 'Работодатель завершил рассмотрение отклика.'
                                : 'Работодатель ещё рассматривает ваш отклик.'}
                          </div>

                          <div className="application-card__actions application-card__actions--new">
                            {application.applicationId ? (
                              <Link
                                to={getApplicantChatLink(application.applicationId)}
                                className="my-applications-chat-btn my-applications-chat-btn--wide"
                                aria-label={`Открыть чат по отклику на вакансию ${application.vacancyTitle}`}
                                title="Открыть чат"
                              >
                                <ChatIcon />
                                <span>Чат</span>
                              </Link>
                            ) : null}

                            {application.vacancyId ? (
                              <button
                                type="button"
                                className="my-applications-secondary-btn my-applications-secondary-btn--compact"
                                onClick={() => navigate(`/vacancies/${application.vacancyId}`)}
                              >
                                Вакансия
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="my-applications-ghost-btn my-applications-ghost-btn--compact"
                              onClick={() => navigate('/vacancies')}
                            >
                              Ещё
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>

                {hasPagination ? (
                  <div className="applications-pagination" aria-label="Пагинация откликов">
                    <button
                      type="button"
                      className="applications-pagination__arrow"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Назад
                    </button>

                    <div className="applications-pagination__pages">
                      {visiblePages.map((page) => {
                        if (typeof page === 'string') {
                          return (
                            <span key={page} className="applications-pagination__dots">
                              ...
                            </span>
                          )
                        }

                        return (
                          <button
                            key={page}
                            type="button"
                            className={`applications-pagination__page ${
                              currentPage === page ? 'is-active' : ''
                            }`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      className="applications-pagination__arrow"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Вперёд
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}