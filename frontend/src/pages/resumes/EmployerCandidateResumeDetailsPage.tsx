import type { AxiosError } from 'axios'
import { type ReactNode, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './employer-candidate-resume-details.css'

type ApiErrorDetail = { msg?: string; message?: string }
type ApiErrorResponse = { detail?: string | ApiErrorDetail[] | Record<string, string>; message?: string; error?: string }

type ResumeSkill = string | { id?: number; name?: string | null }

type GeoNamedEntity = {
  name?: string | null
  full_name?: string | null
  region_name?: string | null
  district_name?: string | null
  settlement_type_name?: string | null
}

type EducationItem = {
  institution_name?: string | null
  start_date?: string | null
  end_date?: string | null
}

type WorkExperienceItem = {
  company_name?: string | null
  position?: string | null
  start_date?: string | null
  end_date?: string | null
  description?: string | null
}

type CandidateResumeDetails = {
  id?: number | null
  applicant_id?: number | null

  is_active?: boolean | null
  is_deleted?: boolean | null
  deleted_at?: string | null
  status?: string | null
  status_name?: string | null

  applicant_full_name?: string | null
  applicant_first_name?: string | null
  applicant_last_name?: string | null
  applicant_middle_name?: string | null

  applicant_email?: string | null
  applicant_user_email?: string | null
  email?: string | null
  user_email?: string | null
  applicant_phone?: string | null
  phone?: string | null

  applicant_city_name?: string | null
  applicant_city_full_name?: string | null
  applicant_region_name?: string | null
  applicant_district_name?: string | null
  applicant_settlement_type_name?: string | null
  applicant_city?: GeoNamedEntity | null
  city?: GeoNamedEntity | null

  applicant_photo?: string | null
  photo?: string | null
  applicant_age?: number | null
  applicant_gender?: string | null
  applicant_birth_date?: string | null

  profession_name?: string | null
  title?: string | null

  skills?: ResumeSkill[]
  work_experiences?: WorkExperienceItem[]
  educations?: EducationItem[]

  work_experiences_count?: number | null
  applications_count?: number | null
  latest_position?: string | null
  latest_company?: string | null
  experience_years?: number | null

  created_at?: string | null
  updated_at?: string | null
}

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const safeText = (value?: string | number | null) => {
  const text = String(value ?? '').trim()
  return text || ''
}

const fallbackText = (value?: string | number | null, fallback = 'Не указано') => {
  return safeText(value) || fallback
}

const uniqueMessages = (messages: string[]) => Array.from(new Set(messages.filter(Boolean)))

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ')) {
    return 'Недостаточно прав. Эта страница доступна работодателю.'
  }

  if (lower.includes('resume') || lower.includes('резюме')) {
    return 'Резюме не найдено или удалено.'
  }

  if (status === 400) return message || 'Некорректный запрос.'
  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав. Эта страница доступна работодателю.'
  if (status === 404) return 'Резюме не найдено или удалено.'
  if (status === 422) return 'Некорректный идентификатор резюме.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError.response?.status
  const data = axiosError.response?.data

  if (axiosError.response) {
    if (Array.isArray(data?.detail)) {
      const messages = uniqueMessages(data.detail.map((item) => translateApiErrorMessage(item.msg || item.message || '', status)))
      return messages[0] || fallback
    }

    if (typeof data?.detail === 'string') return translateApiErrorMessage(data.detail, status)

    if (data?.detail && typeof data.detail === 'object') {
      const message = data.detail.message || data.detail.error
      if (message) return translateApiErrorMessage(message, status)
    }

    if (data?.message) return translateApiErrorMessage(data.message, status)
    if (data?.error) return translateApiErrorMessage(data.error, status)
    return translateApiErrorMessage('', status)
  }

  if (axiosError.request) return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  return fallback
}

const fetchCandidateResumeDetails = async (resumeId: number): Promise<CandidateResumeDetails> => {
  const { data } = await http.get(`/companies/resumes/${resumeId}`)
  return data?.item || data
}

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const normalizeGender = (gender?: string | null) => {
  const value = safeText(gender).toLowerCase()
  if (!value) return ''
  if (['male', 'm', 'м', 'мужской'].includes(value)) return 'Мужской'
  if (['female', 'f', 'ж', 'женский'].includes(value)) return 'Женский'
  return safeText(gender)
}

const normalizeSkills = (skills?: ResumeSkill[]) => {
  return toArray<ResumeSkill>(skills)
    .map((skill) => (typeof skill === 'string' ? skill : skill.name || ''))
    .map((skill) => skill.trim())
    .filter(Boolean)
}

const formatSettlementTitle = (settlementType?: string | null, cityName?: string | null) => {
  const city = safeText(cityName)
  const type = safeText(settlementType)
  if (!city) return ''
  if (!type) return city
  if (city.toLowerCase().startsWith(`${type.toLowerCase()} `)) return city
  return `${type} ${city}`
}

const buildGeoName = (city?: GeoNamedEntity | null) => {
  if (!city) return ''
  if (safeText(city.full_name)) return safeText(city.full_name)

  return [formatSettlementTitle(city.settlement_type_name, city.name), city.district_name, city.region_name]
    .map((item) => safeText(item))
    .filter(Boolean)
    .join(', ')
}

const getApplicantCityEntity = (resume?: CandidateResumeDetails) => resume?.applicant_city || resume?.city || null

const getApplicantCityName = (resume?: CandidateResumeDetails) => {
  if (!resume) return ''
  return safeText(resume.applicant_city_full_name) || buildGeoName(getApplicantCityEntity(resume)) || safeText(resume.applicant_city_name)
}

const getApplicantRegionName = (resume?: CandidateResumeDetails) => {
  const city = getApplicantCityEntity(resume)
  return safeText(resume?.applicant_region_name) || safeText(city?.region_name)
}

const getApplicantDistrictName = (resume?: CandidateResumeDetails) => {
  const city = getApplicantCityEntity(resume)
  return safeText(resume?.applicant_district_name) || safeText(city?.district_name)
}

const getApplicantSettlementTypeName = (resume?: CandidateResumeDetails) => {
  const city = getApplicantCityEntity(resume)
  return safeText(resume?.applicant_settlement_type_name) || safeText(city?.settlement_type_name)
}

const getFullName = (resume?: CandidateResumeDetails) => {
  const fromParts = [resume?.applicant_last_name, resume?.applicant_first_name, resume?.applicant_middle_name]
    .map((item) => safeText(item))
    .filter(Boolean)
    .join(' ')

  return safeText(resume?.applicant_full_name) || fromParts || 'Соискатель'
}

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'С'
}

const getResumeStatus = (resume?: CandidateResumeDetails) => {
  const status = safeText(resume?.status_name) || safeText(resume?.status)
  const normalized = status.toLowerCase()
  const isDeleted = Boolean(resume?.is_deleted || normalized.includes('удален') || normalized.includes('deleted'))
  const isInactive = resume?.is_active === false

  if (isDeleted) return { text: 'Резюме удалено', className: 'candidate-resume-status--deleted' }
  if (isInactive) return { text: 'Резюме неактивно', className: 'candidate-resume-status--deleted' }
  return { text: 'Резюме активно', className: 'candidate-resume-status--active' }
}

const getEmail = (resume?: CandidateResumeDetails) => {
  return (
    safeText(resume?.applicant_email) ||
    safeText(resume?.applicant_user_email) ||
    safeText(resume?.user_email) ||
    safeText(resume?.email)
  )
}

const getPhone = (resume?: CandidateResumeDetails) => safeText(resume?.applicant_phone) || safeText(resume?.phone)

const getBackTarget = (state: unknown) => {
  const value = state as { from?: string; backgroundLocation?: { pathname?: string; search?: string } } | null
  return value?.from || value?.backgroundLocation?.pathname || '/company/applications'
}

type InfoItemProps = {
  label: string
  value?: string | number | null
  wide?: boolean
  href?: string
}

const InfoItem = ({ label, value, wide, href }: InfoItemProps) => {
  const text = fallbackText(value)

  return (
    <div className={`candidate-resume-info-item${wide ? ' candidate-resume-info-item--wide' : ''}`}>
      <span>{label}</span>
      {href && safeText(value) ? (
        <a className="candidate-resume-info-link" href={href}>
          {text}
        </a>
      ) : (
        <strong>{text}</strong>
      )}
    </div>
  )
}

type SectionProps = {
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
}

const Section = ({ title, subtitle, badge, children }: SectionProps) => (
  <section className="candidate-resume-view-card">
    <div className="candidate-resume-section__head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {badge ? <span className="candidate-resume-count-badge">{badge}</span> : null}
    </div>
    {children}
  </section>
)

export const EmployerCandidateResumeDetailsPage = () => {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const resumeId = Number(params.resumeId || params.id)

  const detailsQuery = useQuery({
    queryKey: ['company-candidate-resume-details', resumeId],
    queryFn: () => fetchCandidateResumeDetails(resumeId),
    enabled: Number.isFinite(resumeId) && resumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resume = detailsQuery.data
  const fullName = useMemo(() => getFullName(resume), [resume])
  const avatar = safeText(resume?.applicant_photo) || safeText(resume?.photo)
  const status = getResumeStatus(resume)
  const skills = normalizeSkills(resume?.skills)
  const workExperiences = toArray<WorkExperienceItem>(resume?.work_experiences)
  const educations = toArray<EducationItem>(resume?.educations)
  const backTarget = getBackTarget(location.state)
  const phone = getPhone(resume)
  const email = getEmail(resume)
  const cityName = getApplicantCityName(resume)
  const regionName = getApplicantRegionName(resume)
  const districtName = getApplicantDistrictName(resume)
  const settlementType = getApplicantSettlementTypeName(resume)

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(backTarget)
  }

  return (
    <div className="candidate-resume-view-page">
      <Header />

      <main className="candidate-resume-view-page__main">
        <div className="candidate-resume-view-container">
          <button type="button" className="candidate-resume-btn candidate-resume-btn--outline candidate-resume-back-alone" onClick={handleBack}>
            Назад
          </button>

          {detailsQuery.isLoading ? (
            <div className="candidate-resume-view-card candidate-resume-empty">Загружаем резюме...</div>
          ) : null}

          {detailsQuery.isError ? (
            <div className="candidate-resume-view-card candidate-resume-empty candidate-resume-empty--error">
              {getErrorMessage(detailsQuery.error, 'Не удалось загрузить резюме.')}
            </div>
          ) : null}

          {resume ? (
            <>
              {(resume.is_deleted || resume.is_active === false) ? (
                <div className="candidate-resume-deleted-alert">
                  {resume.is_deleted ? 'Резюме удалено. Данные показываются только для истории отклика.' : 'Резюме неактивно. Соискатель мог скрыть его из поиска.'}
                </div>
              ) : null}

              <section className="candidate-resume-view-card candidate-resume-hero candidate-resume-hero--compact">
                <div className="candidate-resume-hero__topbar">
                  <div className="candidate-resume-label">Карточка соискателя</div>
                  <span className={`candidate-resume-status ${status.className}`}>{status.text}</span>
                </div>

                <div className="candidate-resume-hero__body">
                  {avatar ? (
                    <img className="candidate-resume-hero__avatar" src={avatar} alt={fullName} />
                  ) : (
                    <div className="candidate-resume-hero__avatar candidate-resume-hero__avatar--placeholder">{getInitials(fullName)}</div>
                  )}

                  <div className="candidate-resume-hero__content">
                    <h1>{fullName}</h1>
                    <p>{fallbackText(resume.profession_name || resume.title, 'Профессия не указана')}</p>

                    <div className="candidate-resume-hero__quick-grid">
                      <InfoItem label="Телефон" value={phone} href={phone ? `tel:${phone}` : undefined} />
                      <InfoItem label="Почта" value={email} href={email ? `mailto:${email}` : undefined} />
                      <InfoItem label="Населённый пункт" value={cityName} />
                      <InfoItem label="Возраст" value={resume.applicant_age ? `${resume.applicant_age} лет` : ''} />
                    </div>
                  </div>
                </div>
              </section>

              <Section title="Контакты и адрес" subtitle="Данные, которые нужны работодателю для связи с кандидатом.">
                <div className="candidate-resume-info-grid">
                  <InfoItem label="Телефон" value={phone} href={phone ? `tel:${phone}` : undefined} />
                  <InfoItem label="Почта" value={email} href={email ? `mailto:${email}` : undefined} />
                  <InfoItem label="Адрес / населённый пункт" value={cityName} wide />
                  <InfoItem label="Область" value={regionName} />
                  <InfoItem label="Район" value={districtName} />
                  <InfoItem label="Тип населённого пункта" value={settlementType} />
                </div>
              </Section>

              <Section title="Сведения о кандидате" subtitle="Основная информация без технических ID.">
                <div className="candidate-resume-info-grid">
                  <InfoItem label="ФИО" value={fullName} />
                  <InfoItem label="Профессия" value={resume.profession_name || resume.title} />
                  <InfoItem label="Пол" value={normalizeGender(resume.applicant_gender)} />
                  <InfoItem label="Дата рождения" value={formatDate(resume.applicant_birth_date)} />
                  <InfoItem label="Возраст" value={resume.applicant_age ? `${resume.applicant_age} лет` : ''} />
                  <InfoItem label="Опыт" value={resume.experience_years ? `${resume.experience_years} лет` : 'Без опыта'} />
                  <InfoItem label="Последняя должность" value={resume.latest_position} />
                  <InfoItem label="Последняя компания" value={resume.latest_company} />
                  <InfoItem label="Откликов по резюме" value={resume.applications_count ?? 0} />
                  <InfoItem label="Обновлено" value={formatDateTime(resume.updated_at)} />
                  <InfoItem label="Создано" value={formatDateTime(resume.created_at)} />
                  {resume.deleted_at ? <InfoItem label="Удалено" value={formatDateTime(resume.deleted_at)} /> : null}
                </div>
              </Section>

              <Section title="Навыки" badge={`${skills.length} шт.`}>
                {skills.length ? (
                  <div className="candidate-resume-chip-list">
                    {skills.map((skill) => (
                      <span className="candidate-resume-chip" key={skill}>{skill}</span>
                    ))}
                  </div>
                ) : (
                  <div className="candidate-resume-empty-inline">Навыки не указаны.</div>
                )}
              </Section>

              <Section title="Опыт работы" subtitle="Компании, должности и обязанности кандидата." badge={`${workExperiences.length} записей`}>
                {workExperiences.length ? (
                  <div className="candidate-resume-timeline">
                    {workExperiences.map((experience, index) => (
                      <article className="candidate-resume-timeline-card" key={`${experience.company_name}-${experience.position}-${index}`}>
                        <div className="candidate-resume-timeline-card__head">
                          <div>
                            <h3>{fallbackText(experience.position, 'Должность не указана')}</h3>
                            <p>{fallbackText(experience.company_name, 'Компания не указана')}</p>
                          </div>
                          <span>{formatDate(experience.start_date) || 'Начало не указано'} — {formatDate(experience.end_date) || 'по настоящее время'}</span>
                        </div>
                        {safeText(experience.description) ? <div className="candidate-resume-description">{experience.description}</div> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="candidate-resume-empty-inline">Опыт работы не указан.</div>
                )}
              </Section>

              <Section title="Образование" subtitle="Учебные заведения и периоды обучения." badge={`${educations.length} записей`}>
                {educations.length ? (
                  <div className="candidate-resume-timeline">
                    {educations.map((education, index) => (
                      <article className="candidate-resume-timeline-card" key={`${education.institution_name}-${index}`}>
                        <div className="candidate-resume-timeline-card__head">
                          <div>
                            <h3>{fallbackText(education.institution_name, 'Учебное заведение не указано')}</h3>
                            <p>Образование</p>
                          </div>
                          <span>{formatDate(education.start_date) || 'Начало не указано'} — {formatDate(education.end_date) || 'окончание не указано'}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="candidate-resume-empty-inline">Образование не указано.</div>
                )}
              </Section>
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default EmployerCandidateResumeDetailsPage
