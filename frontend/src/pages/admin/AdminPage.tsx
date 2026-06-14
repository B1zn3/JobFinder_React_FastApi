  import axios from 'axios'
  import { Children, isValidElement, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
  import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
  
  import { useNavigate } from 'react-router-dom'
  import { http } from '../../shared/api/http'
  import { authSession, logoutSession } from '../../shared/auth/session'
  import showPasswordIcon from '../../assets/показать_пароль.png'
  import hidePasswordIcon from '../../assets/скрыть_пароль.png'
  import './admin.css'

  type TabKey =
    | 'dashboard'
    | 'catalogs'
    | 'admins'
    | 'users'
    | 'companies'
    | 'applicants'
    | 'vacancies'
    | 'applications'

  type CatalogKey =
    | 'regions'
    | 'districts'
    | 'settlement-types'
    | 'cities'
    | 'professions'
    | 'skills'
    | 'work-schedules'
    | 'employment-types'
    | 'company-types'
    | 'educational-institutions'
    | 'currencies'
    | 'experiences'
    | 'statuses'

  type DashboardChartKey =
    | 'registrations'
    | 'platform'
    | 'roles'
    | 'applications-status'
    | 'top-cities'
    | 'top-professions'

  type DashboardPeriod = '7d' | '30d' | '90d' | '365d' | 'all'
  type ProfessionChartSource = 'resumes' | 'vacancies'
  type CommonStatusFilter = 'all' | 'active' | 'blocked'
  type UserRoleFilter = 'all' | 'admin' | 'company' | 'applicant'
  type ResumeFilter = 'all' | 'has-resumes' | 'no-resumes'
  type SalaryFilter = 'all' | 'with-salary' | 'no-salary'

  type CatalogItem = {
    id: number
    name: string
    region_id?: number | null
    region_name?: string | null
    district_id?: number | null
    district_name?: string | null
    settlement_type_id?: number | null
    settlement_type_name?: string | null
    full_name?: string | null
  }

  type CatalogDeleteConflict = {
    requires_confirmation?: boolean
    catalog_name?: string
    item_id?: number
    item_name?: string
    usages?: Record<string, number>
    message?: string
  }

  type AuthMeResponse = {
    id: number
    email: string
    role: string
    is_active: boolean
  }

  type DashboardRegistrationPoint = {
    label?: string
    date?: string
    users?: number
    applicants?: number
    companies?: number
    admins?: number
    count?: number
  }

  type DashboardMetricItem = {
    key?: string
    label: string
    value: number
  }

  type DashboardResponse = {
    users_total?: number
    users_active?: number
    users_blocked?: number
    companies_total?: number
    applicants_total?: number
    vacancies_total?: number
    applications_total?: number
    admins_total?: number
    vacancies_by_status?: Record<string, number>
    applications_by_status?: Record<string, number>
    users_by_role?: Record<string, number>
    users_by_status?: Record<string, number>
    registrations?: DashboardRegistrationPoint[]
    registrations_by_period?: Array<{ date: string; count: number }>
    top_cities?: DashboardMetricItem[]
    top_professions?: DashboardMetricItem[]
  }

  type UserAdmin = {
    id: number
    email: string
    role: 'applicant' | 'company' | 'admin'
    is_active: boolean
    company_id?: number | null
    applicant_id?: number | null
    created_at?: string | null
    updated_at?: string | null
    company_name?: string | null
    applicant_full_name?: string | null
    vacancies_count?: number
    resumes_count?: number
    applications_count?: number
  }

  type CompanyAdmin = {
    id: number
    name: string
    website?: string | null
    company_type_name?: string | null
    cities?: string[]
    vacancies_count?: number
    user_id?: number | null
    user_email?: string | null
    is_active: boolean
    description?: string | null
    logo?: string | null
    founded_year?: number | null
    employee_count?: number | null
    vacancy_ids?: number[]
    created_at?: string | null
    updated_at?: string | null
  }

  type ApplicantAdmin = {
    id: number
    full_name: string
    email?: string | null
    phone?: string | null
    city_name?: string | null
    resumes_count?: number
    educations_count?: number
    is_active: boolean
    birth_date?: string | null
    gender?: string | null
    photo?: string | null
    resumes?: Array<Record<string, unknown>>
    educations?: Array<Record<string, unknown>>
    work_experiences?: Array<Record<string, unknown>>
    applications_count?: number
    created_at?: string | null
    updated_at?: string | null
  }

  type VacancyAdmin = {
    id: number
    title: string
    description?: string | null
    company_id?: number | null
    city_id?: number | null
    profession_id?: number | null
    status_id?: number | null
    salary_min?: number | null
    salary_max?: number | null
    currency?: string | null
    company_name?: string | null
    city_name?: string | null
    profession_name?: string | null
    status_name?: string | null
    created_at?: string | null
    updated_at?: string | null
    skills?: Array<{ id?: number; name?: string } | string>
  }

  type ApplicationAdmin = {
    vacancy_id: number
    resume_id: number
    status: string
    created_at?: string | null
    updated_at?: string | null
    vacancy_title?: string | null
    company_name?: string | null
    applicant_name?: string | null
    applicant_id?: number | null
    resume_profession?: string | null
    city_name?: string | null
    salary_min?: number | null
    salary_max?: number | null
    cover_letter?: string | null
  }

  type AdminListItem = {
    id: number
    email: string
    is_active: boolean
    created_at?: string | null
    updated_at?: string | null
  }

  type AdminDetail = {
    id: number
    email: string
    role: string
    is_active: boolean
    created_at?: string | null
    updated_at?: string | null
    password_set?: boolean | null
  }

  type DetailTarget =
    | { kind: 'admin'; id: number }
    | { kind: 'user'; id: number }
    | { kind: 'company'; id: number }
    | { kind: 'applicant'; id: number }
    | { kind: 'vacancy'; id: number }
    | { kind: 'application'; vacancyId: number; resumeId: number }
    | null

  type ChartPoint = {
    label: string
    value: number
  }

  type PageState = Record<TabKey, number>

  const PAGE_SIZE = 8

  const defaultPages: PageState = {
    dashboard: 1,
    catalogs: 1,
    admins: 1,
    users: 1,
    companies: 1,
    applicants: 1,
    vacancies: 1,
    applications: 1,
  }

  const catalogDefinitions: Array<{ key: CatalogKey; label: string }> = [
    { key: 'regions', label: 'Области' },
    { key: 'districts', label: 'Районы' },
    { key: 'cities', label: 'Города' },
    { key: 'settlement-types', label: 'Типы населённых пунктов' },
    { key: 'professions', label: 'Профессии' },
    { key: 'skills', label: 'Навыки' },
    { key: 'work-schedules', label: 'Графики работы' },
    { key: 'employment-types', label: 'Типы занятости' },
    { key: 'company-types', label: 'Типы компаний' },
    { key: 'educational-institutions', label: 'Учебные заведения' },
    { key: 'currencies', label: 'Валюты' },
    { key: 'experiences', label: 'Опыт работы' },
    { key: 'statuses', label: 'Статусы вакансий' },
  ]

  const dashboardCharts: Array<{ value: DashboardChartKey; label: string; description: string }> = [
    { value: 'registrations', label: 'Регистрации', description: 'Динамика создания аккаунтов за выбранный период.' },
    { value: 'platform', label: 'Структура платформы', description: 'Компании и соискатели.' },
    { value: 'roles', label: 'Роли пользователей', description: 'Администраторы, работодатели и соискатели.' },
    { value: 'applications-status', label: 'Статусы откликов', description: 'Распределение откликов по состояниям.' },
    { value: 'top-cities', label: 'Города', description: 'Города с наибольшим количеством соискателей.' },
    { value: 'top-professions', label: 'Профессии', description: 'Профессии резюме или вакансий за выбранный период.' },
  ]

  const dashboardPeriods: Array<{ value: DashboardPeriod; label: string }> = [
    { value: '7d', label: '7 дней' },
    { value: '30d', label: '30 дней' },
    { value: '90d', label: '90 дней' },
    { value: '365d', label: 'Год' },
    { value: 'all', label: 'Всё время' },
  ]

  const statusLabels: Record<string, string> = {
    pending: 'На рассмотрении',
    review: 'На рассмотрении',
    accepted: 'Принят',
    rejected: 'Отклонён',
    sent: 'Отправлен',
    active: 'Активные',
    blocked: 'Заблокированные',
    draft: 'Черновик',
    published: 'Опубликована',
    archived: 'Архив',
  }

  const roleLabels: Record<UserAdmin['role'], string> = {
    admin: 'Администратор',
    company: 'Работодатель',
    applicant: 'Соискатель',
  }

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>

      for (const key of ['items', 'results', 'data', 'rows']) {
        if (Array.isArray(record[key])) return record[key] as T[]
      }
    }

    return []
  }

  const safeString = (value: unknown) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    return ''
  }

  const getRecord = (value: unknown): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }

    return {}
  }
  const navigate = useNavigate()
  const queryClient = useQueryClient()

const handleLogout = async () => {

  sessionStorage.setItem('jobfinder_logout_redirect', '1')

  // СНАЧАЛА запрещаем refresh и чистим localStorage
  authSession.markLoggedOut()

  // Потом убиваем активные react-query запросы
  await queryClient.cancelQueries()
  queryClient.clear()

  // Потом просим backend удалить refresh_token cookie
  await logoutSession()

  navigate('/', { replace: true })
} 
  const safeNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }
  const getNestedName = (value: unknown) => {
    if (value && typeof value === 'object') {
      return safeString((value as Record<string, unknown>).name)
    }

    return ''
  }

  const getNestedId = (value: unknown) => {
    if (value && typeof value === 'object') {
      return safeNumber((value as Record<string, unknown>).id)
    }

    return null
  }

  const readEntityName = (item: Record<string, unknown>, directKey: string, nestedKey: string) => {
    return safeString(item[directKey]) || getNestedName(item[nestedKey])
  }

  const readEntityId = (item: Record<string, unknown>, directKey: string, nestedKey: string) => {
    return safeNumber(item[directKey]) ?? getNestedId(item[nestedKey])
  }
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('ru-RU')
  }

  const formatChartDate = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  const formatSalary = (min?: number | null, max?: number | null, currency = 'BYN') => {
    if (min && max) return `${min}–${max} ${currency}`
    if (min) return `от ${min} ${currency}`
    if (max) return `до ${max} ${currency}`
    return 'Не указана'
  }

  const formatCompactNumber = (value?: number | null) => {
    const num = Number(value || 0)
    if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}м+`
    if (num >= 100_000) return `${Math.floor(num / 1_000)}к+`
    if (num >= 10_000) return `${Math.floor(num / 1_000)}к+`
    if (num >= 1_000) return `${Math.floor(num / 100) / 10}к+`.replace('.0', '')
    return String(num)
  }

  const getPercent = (value: number, total: number) => {
    if (!total) return 0
    return Math.round((value / total) * 100)
  }

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const PASSWORD_MIN_LENGTH = 8

  const normalizeBackendMessage = (message: string, fallback: string) => {
    const text = message.trim()
    const lower = text.toLowerCase()

    if (!text) return fallback
    if (lower.includes('already') || lower.includes('exists') || lower.includes('duplicate') || lower.includes('unique') || lower.includes('зарегистр') || lower.includes('существ')) {
      return 'Такая почта уже зарегистрирована.'
    }
    if ((lower.includes('invalid') && lower.includes('email')) || (lower.includes('email') && lower.includes('valid')) || lower.includes('почт')) {
      return 'Введите корректную почту в формате name@example.com.'
    }
    if ((lower.includes('password') && (lower.includes('incorrect') || lower.includes('wrong'))) || lower.includes('неверный пароль') || lower.includes('incorrect current')) {
      return 'Текущий пароль указан неверно.'
    }
    if ((lower.includes('password') && (lower.includes('short') || lower.includes('8') || lower.includes('min'))) || (lower.includes('пароль') && lower.includes('символ'))) {
      return `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов.`
    }
    if (lower.includes('forbidden') || lower.includes('not enough permissions') || lower.includes('permission') || lower.includes('доступ')) {
      return 'Недостаточно прав для выполнения действия.'
    }
    if (lower.includes('not found') || lower.includes('не найден')) {
      return 'Запись не найдена. Обновите страницу и попробуйте снова.'
    }

    return text
  }

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail

      if (typeof detail === 'string') {
        return normalizeBackendMessage(detail, fallback)
      }

      if (Array.isArray(detail)) {
        const joined = detail
          .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object') {
              return safeString((item as Record<string, unknown>).msg) || safeString((item as Record<string, unknown>).message)
            }
            return ''
          })
          .filter(Boolean)
          .join('; ')

        if (joined) return normalizeBackendMessage(joined, fallback)
      }

      if (typeof error.message === 'string' && error.message.trim()) {
        return normalizeBackendMessage(error.message, fallback)
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return normalizeBackendMessage(error.message, fallback)
    }

    return fallback
  }


  const getCatalogDeleteConflict = (error: unknown): CatalogDeleteConflict | null => {
    if (!axios.isAxiosError(error)) return null
    if (error.response?.status !== 409) return null

    const detail = error.response.data?.detail

    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
      return null
    }

    const conflict = detail as CatalogDeleteConflict

    if (!conflict.requires_confirmation) {
      return null
    }

    return conflict
  }

  const getEmailError = (value: string) => {
    const email = value.trim()
    if (!email) return 'Введите почту.'
    if (!EMAIL_PATTERN.test(email)) return 'Введите корректную почту в формате name@example.com.'
    return ''
  }

  const getOptionalPasswordError = (value: string) => {
    const password = value.trim()
    if (!password) return ''
    if (password.length < PASSWORD_MIN_LENGTH) return `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов.`
    return ''
  }

  const getRequiredPasswordError = (value: string, label = 'Пароль') => {
    const password = value.trim()
    if (!password) return `${label}: обязательное поле.`
    if (password.length < PASSWORD_MIN_LENGTH) return `${label}: минимум ${PASSWORD_MIN_LENGTH} символов.`
    return ''
  }

  const maskEmail = (email: string) => {
    const [localPart = '', domain = ''] = email.split('@')
    if (!domain) return email
    const visible = localPart.slice(0, 3)
    const maskedLength = Math.max(localPart.length - visible.length, 3)
    const masked = '•'.repeat(maskedLength)
    return `${visible}${masked}@${domain}`
  }

  const normalizeUser = (item: Record<string, unknown>): UserAdmin => ({
    id: safeNumber(item.id) ?? 0,
    email: safeString(item.email) || 'Без email',
    role: (safeString(item.role) as UserAdmin['role']) || 'applicant',
    is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
    company_id: safeNumber(item.company_id),
    applicant_id: safeNumber(item.applicant_id),
    created_at: safeString(item.created_at) || null,
    updated_at: safeString(item.updated_at) || null,
    company_name: safeString(item.company_name) || null,
    applicant_full_name: safeString(item.applicant_full_name) || null,
    vacancies_count: safeNumber(item.vacancies_count) ?? 0,
    resumes_count: safeNumber(item.resumes_count) ?? 0,
    applications_count: safeNumber(item.applications_count) ?? 0,
  })

  const normalizeCompany = (item: Record<string, unknown>): CompanyAdmin => ({
    id: safeNumber(item.id) ?? 0,
    name: safeString(item.name) || 'Без названия',
    website: safeString(item.website) || null,
    company_type_name: safeString(item.company_type_name) || null,
    cities: toArray<string>(item.cities),
    vacancies_count: safeNumber(item.vacancies_count) ?? 0,
    user_id: safeNumber(item.user_id),
    user_email: safeString(item.user_email) || null,
    is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
    description: safeString(item.description) || null,
    logo: safeString(item.logo) || null,
    founded_year: safeNumber(item.founded_year),
    employee_count: safeNumber(item.employee_count),
    vacancy_ids: toArray<number>(item.vacancy_ids),
    created_at: safeString(item.created_at) || null,
    updated_at: safeString(item.updated_at) || null,
  })

  const normalizeApplicant = (item: Record<string, unknown>): ApplicantAdmin => ({
    id: safeNumber(item.id) ?? 0,
    full_name: safeString(item.full_name) || `Соискатель #${safeNumber(item.id) ?? 0}`,
    email: safeString(item.email) || null,
    phone: safeString(item.phone) || null,
    city_name: safeString(item.city_name) || null,
    resumes_count: safeNumber(item.resumes_count) ?? 0,
    educations_count: safeNumber(item.educations_count) ?? 0,
    is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
    birth_date: safeString(item.birth_date) || null,
    gender: safeString(item.gender) || null,
    photo: safeString(item.photo) || null,
    resumes: toArray<Record<string, unknown>>(item.resumes),
    educations: toArray<Record<string, unknown>>(item.educations),
    work_experiences: toArray<Record<string, unknown>>(item.work_experiences),
    applications_count: safeNumber(item.applications_count) ?? 0,
    created_at: safeString(item.created_at) || null,
    updated_at: safeString(item.updated_at) || null,
  })

  const normalizeVacancy = (item: Record<string, unknown>): VacancyAdmin => ({
    id: safeNumber(item.id) ?? 0,
    title: safeString(item.title) || 'Без названия',
    description: safeString(item.description) || null,

    company_id: readEntityId(item, 'company_id', 'company'),
    city_id: readEntityId(item, 'city_id', 'city'),
    profession_id: readEntityId(item, 'profession_id', 'profession'),
    status_id: readEntityId(item, 'status_id', 'status'),

    salary_min: safeNumber(item.salary_min),
    salary_max: safeNumber(item.salary_max),

    currency:
      safeString(item.currency) ||
      safeString(item.currency_name) ||
      getNestedName(item.currency) ||
      null,

    company_name: readEntityName(item, 'company_name', 'company') || null,
    city_name: readEntityName(item, 'city_name', 'city') || null,
    profession_name: readEntityName(item, 'profession_name', 'profession') || null,
    status_name: readEntityName(item, 'status_name', 'status') || null,

    created_at: safeString(item.created_at) || null,
    updated_at: safeString(item.updated_at) || null,

    skills: Array.isArray(item.skills)
      ? (item.skills as Array<{ id?: number; name?: string } | string>)
      : [],
  })

  const normalizeApplication = (item: Record<string, unknown>): ApplicationAdmin => {
    const vacancy = getRecord(item.vacancy)
    const resume = getRecord(item.resume)
    const directApplicant = getRecord(item.applicant)
    const nestedApplicant = getRecord(resume.applicant)
    const directCompany = getRecord(item.company)
    const nestedCompany = getRecord(vacancy.company)
    const directProfession = getRecord(item.profession)
    const resumeProfession = getRecord(resume.profession)
    const vacancyProfession = getRecord(vacancy.profession)
    const directCity = getRecord(item.city)
    const vacancyCity = getRecord(vacancy.city)

    const applicant = Object.keys(directApplicant).length ? directApplicant : nestedApplicant
    const company = Object.keys(directCompany).length ? directCompany : nestedCompany
    const profession = Object.keys(directProfession).length
      ? directProfession
      : Object.keys(resumeProfession).length
        ? resumeProfession
        : vacancyProfession
    const city = Object.keys(directCity).length ? directCity : vacancyCity

    const applicantName =
      safeString(item.applicant_name) ||
      safeString(applicant.full_name) ||
      [applicant.last_name, applicant.first_name, applicant.middle_name]
        .map(safeString)
        .filter(Boolean)
        .join(' ')

    return {
      vacancy_id: safeNumber(item.vacancy_id) ?? safeNumber(vacancy.id) ?? 0,
      resume_id: safeNumber(item.resume_id) ?? safeNumber(resume.id) ?? 0,
      status: safeString(item.status) || 'pending',
      created_at: safeString(item.created_at) || null,
      updated_at: safeString(item.updated_at) || null,
      vacancy_title: safeString(item.vacancy_title) || safeString(vacancy.title) || null,
      company_name: safeString(item.company_name) || safeString(company.name) || null,
      applicant_name: applicantName || null,
      applicant_id: safeNumber(item.applicant_id) ?? safeNumber(applicant.id),
      resume_profession: safeString(item.resume_profession) || safeString(profession.name) || null,
      city_name: safeString(item.city_name) || safeString(city.full_name) || safeString(city.name) || null,
      salary_min: safeNumber(item.salary_min) ?? safeNumber(vacancy.salary_min),
      salary_max: safeNumber(item.salary_max) ?? safeNumber(vacancy.salary_max),
      cover_letter: safeString(item.cover_letter) || null,
    }
  }

  const normalizeAdmin = (item: Record<string, unknown>): AdminListItem => ({
    id: safeNumber(item.id) ?? 0,
    email: safeString(item.email) || 'Без email',
    is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
    created_at: safeString(item.created_at) || null,
    updated_at: safeString(item.updated_at) || null,
  })

  const fetchAuthMe = async (): Promise<AuthMeResponse> => {
    const { data } = await http.get('/auth/me')
    return data
  }

  const fetchDashboard = async (period: DashboardPeriod): Promise<DashboardResponse> => {
    const { data } = await http.get('/admin/dashboard', { params: { period } })
    return data || {}
  }

  const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
    const { data } = await http.get(`/admin/catalogs/${name}`, { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map((item) => ({
      id: safeNumber(item.id) ?? 0,
      name: safeString(item.name) || 'Без названия',
      region_id: safeNumber(item.region_id),
      region_name: safeString(item.region_name) || null,
      district_id: safeNumber(item.district_id),
      district_name: safeString(item.district_name) || null,
      settlement_type_id: safeNumber(item.settlement_type_id),
      settlement_type_name: safeString(item.settlement_type_name) || null,
      full_name: safeString(item.full_name) || null,
    }))
  }

  const fetchUsers = async (): Promise<UserAdmin[]> => {
    const { data } = await http.get('/admin/users', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeUser)
  }

  const fetchCompanies = async (): Promise<CompanyAdmin[]> => {
    const { data } = await http.get('/admin/companies', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeCompany)
  }

  const fetchApplicants = async (): Promise<ApplicantAdmin[]> => {
    const { data } = await http.get('/admin/applicants', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeApplicant)
  }

  const fetchVacancies = async (): Promise<VacancyAdmin[]> => {
    const { data } = await http.get('/admin/vacancies', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeVacancy)
  }

  const fetchApplications = async (): Promise<ApplicationAdmin[]> => {
    const { data } = await http.get('/admin/applications', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeApplication)
  }

  const fetchAdmins = async (): Promise<AdminListItem[]> => {
    const { data } = await http.get('/admin/admins', { params: { skip: 0, limit: 100 } })
    return toArray<Record<string, unknown>>(data).map(normalizeAdmin)
  }

  const fetchUserDetail = async (id: number) => {
    const { data } = await http.get(`/admin/users/${id}`)
    return data as Record<string, unknown>
  }

  const fetchCompanyDetail = async (id: number) => {
    const { data } = await http.get(`/admin/companies/${id}`)
    return data as Record<string, unknown>
  }

  const fetchApplicantDetail = async (id: number) => {
    const { data } = await http.get(`/admin/applicants/${id}`)
    return data as Record<string, unknown>
  }

  const fetchApplicantDetailsForResumes = async (applicants: ApplicantAdmin[]): Promise<ApplicantAdmin[]> => {
    const applicantsToLoad = applicants.filter((applicant) => {
      const currentResumesCount = toArray<Record<string, unknown>>(applicant.resumes).length
      const declaredResumesCount = applicant.resumes_count

      if (currentResumesCount > 0 && (!declaredResumesCount || currentResumesCount >= declaredResumesCount)) {
        return false
      }

      return declaredResumesCount !== 0
    })

    if (!applicantsToLoad.length) return applicants

    const detailedApplicants = await Promise.all(
      applicantsToLoad.map(async (applicant) => {
        try {
          const detail = await fetchApplicantDetail(applicant.id)
          return normalizeApplicant({ ...applicant, ...detail })
        } catch {
          return applicant
        }
      }),
    )

    const detailedById = new Map(detailedApplicants.map((applicant) => [applicant.id, applicant]))
    return applicants.map((applicant) => detailedById.get(applicant.id) || applicant)
  }

  const fetchVacancyDetail = async (id: number) => {
    const { data } = await http.get(`/admin/vacancies/${id}`)
    return normalizeVacancy(data as Record<string, unknown>) as unknown as Record<string, unknown>
  }

  const fetchApplicationDetail = async (vacancyId: number, resumeId: number) => {
    const { data } = await http.get(`/admin/applications/${vacancyId}/${resumeId}`)
    return data as Record<string, unknown>
  }

  const fetchAdminDetail = async (id: number): Promise<AdminDetail> => {
    const { data } = await http.get(`/admin/admins/${id}`)
    return data
  }

  const toSearchValue = (...values: unknown[]) => values.map((item) => safeString(item).toLowerCase()).join(' ')

  const getPageItems = <T,>(items: T[], page: number) => {
    const safePage = Math.max(page, 1)
    return items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  }

  const statusFilterMatches = (isActive: boolean, filter: CommonStatusFilter) => {
    if (filter === 'active') return isActive
    if (filter === 'blocked') return !isActive
    return true
  }

  const uniqueStrings = (values: Array<string | null | undefined>) => {
    return Array.from(new Set(values.map((item) => safeString(item).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'ru'),
    )
  }

  const getCatalogDisplayName = (item: CatalogItem) => item.full_name || item.name

  const getCatalogMeta = (item: CatalogItem, catalog: CatalogKey) => {
    if (catalog === 'districts') {
      return item.region_name ? `Область: ${item.region_name}` : 'Область не указана'
    }

    if (catalog === 'cities') {
      const parts = [
        item.settlement_type_name ? `Тип: ${item.settlement_type_name}` : null,
        item.district_name ? `Район: ${item.district_name}` : null,
        item.region_name ? `Область: ${item.region_name}` : null,
      ].filter(Boolean)

      return parts.length ? parts.join(' • ') : 'Район не указан'
    }

    return null
  }

  const getCatalogSearchText = (item: CatalogItem) => {
    return toSearchValue(
      item.id,
      item.name,
      item.full_name,
      item.region_name,
      item.district_name,
      item.settlement_type_name,
    )
  }

  const getVacancySkillNames = (value: unknown) => {
    const items = toArray<unknown>(value)
    return items
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') return safeString((item as Record<string, unknown>).name)
        return ''
      })
      .filter(Boolean)
  }

  const getUserLabel = (user: UserAdmin) => roleLabels[user.role] || 'Пользователь'

  const getDateValue = (value?: string | null) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const getPeriodStart = (period: DashboardPeriod) => {
    if (period === 'all') return null

    const daysByPeriod: Record<Exclude<DashboardPeriod, 'all'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365,
    }

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - daysByPeriod[period] + 1)

    return start
  }

  const isWithinPeriod = (value: string | null | undefined, periodStart: Date | null) => {
    if (!periodStart) return true
    const date = getDateValue(value)
    return Boolean(date && date >= periodStart)
  }

  const isWithinPeriodWithFallback = (
    value: string | null | undefined,
    fallbackValue: string | null | undefined,
    periodStart: Date | null,
  ) => {
    if (!periodStart) return true
    if (value) return isWithinPeriod(value, periodStart)
    return isWithinPeriod(fallbackValue, periodStart)
  }

  const countByLabel = (labels: Array<string | null | undefined>, limit = 12): DashboardMetricItem[] => {
    const result = labels.reduce<Record<string, number>>((acc, label) => {
      const normalized = safeString(label).trim() || 'Не указано'
      acc[normalized] = (acc[normalized] || 0) + 1
      return acc
    }, {})

    return Object.entries(result)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'ru'))
      .slice(0, limit)
  }

  const getProfessionIdFromResume = (resume: Record<string, unknown>) => {
    const directId = safeNumber(resume.profession_id)
    if (directId) return directId

    const profession = resume.profession
    if (profession && typeof profession === 'object') {
      return safeNumber((profession as Record<string, unknown>).id)
    }

    return null
  }

  const getResumeProfessionName = (
    resume: Record<string, unknown>,
    professionById: Record<number, string>,
  ) => {
    const profession = resume.profession
    if (profession && typeof profession === 'object') {
      const name = safeString((profession as Record<string, unknown>).name)
      if (name) return name
    }

    const professionId = getProfessionIdFromResume(resume)
    if (professionId && professionById[professionId]) return professionById[professionId]

    const explicitName =
      safeString(resume.profession_name) ||
      safeString(resume.profession_title) ||
      safeString(resume.profession_label)

    if (explicitName) return explicitName
    if (professionId) return `Профессия #${professionId}`

    return 'Не указано'
  }

  const buildRegistrations = (users: UserAdmin[], period: DashboardPeriod) => {
    const periodStart = getPeriodStart(period)
    const points = users.reduce<Record<string, { label: string; date: string; users: number; count: number }>>((acc, user) => {
      const date = getDateValue(user.created_at)
      if (!date) return acc
      if (!isWithinPeriod(user.created_at, periodStart)) return acc

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`
      const label = `${day}.${month}`

      if (!acc[key]) acc[key] = { label, date: key, users: 0, count: 0 }

      acc[key].users += 1
      acc[key].count += 1

      return acc
    }, {})

    return Object.values(points).sort((a, b) => a.date.localeCompare(b.date))
  }

  type AdminSelectProps = {
    label?: string
    value: string | number
    onChange: (value: string) => void
    children: ReactNode
    className?: string
    disabled?: boolean
    placeholder?: string
  }

  type AdminSelectOption = {
    value: string
    label: string
    disabled: boolean
  }

  const getOptionLabel = (node: ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)

    if (Array.isArray(node)) {
      return node.map(getOptionLabel).join('')
    }

    if (isValidElement<{ children?: ReactNode }>(node)) {
      return getOptionLabel(node.props.children)
    }

    return ''
  }

  const AdminSelect = ({
    label,
    value,
    onChange,
    children,
    className = '',
    disabled = false,
    placeholder = 'Выберите значение',
  }: AdminSelectProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    const options = useMemo<AdminSelectOption[]>(() => {
      return Children.toArray(children)
        .filter(isValidElement)
        .map((child) => {
          const props = child.props as {
            value?: string | number
            disabled?: boolean
            children?: ReactNode
          }

          return {
            value: props.value === undefined ? getOptionLabel(props.children) : String(props.value),
            label: getOptionLabel(props.children),
            disabled: Boolean(props.disabled),
          }
        })
    }, [children])

    const selectedValue = String(value ?? '')
    const selectedOption = options.find((option) => option.value === selectedValue)
    const selectedLabel = selectedOption?.label || placeholder

    useEffect(() => {
      if (!isOpen) return

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node

        if (!rootRef.current?.contains(target)) {
          setIsOpen(false)
        }
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousedown', handlePointerDown)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen])

    return (
      <div
        ref={rootRef}
        className={`admin-custom-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      >
        <button
          type="button"
          className="admin-custom-select__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => {
            if (!disabled) setIsOpen((prev) => !prev)
          }}
        >
          <span className={`admin-custom-select__value ${selectedOption ? '' : 'is-placeholder'}`.trim()}>
            {selectedLabel}
          </span>
          <span className="admin-custom-select__arrow" aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="admin-custom-select__menu" role="listbox" aria-label={label || placeholder}>
            {options.length ? (
              options.map((option) => (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  role="option"
                  disabled={option.disabled}
                  aria-selected={option.value === selectedValue}
                  className={`admin-custom-select__option ${option.value === selectedValue ? 'is-selected' : ''}`.trim()}
                  onClick={() => {
                    if (option.disabled) return
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="admin-custom-select__empty">Нет вариантов</div>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  const Modal = ({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) => {
    return (
      <div className="admin-modal" onClick={onClose}>
        <div className="admin-modal__dialog" onClick={(event) => event.stopPropagation()}>
          <div className="admin-modal__header">
            <div>
              <div className="admin-modal__eyebrow">Администрирование</div>
              <h3>{title}</h3>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Закрыть окно">
              <span aria-hidden="true" />
            </button>
          </div>
          <div className="admin-modal__body">{children}</div>
        </div>
      </div>
    )
  }

  const FilterSelect = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) => (
    <label className="admin-filter-select">
      <span>{label}</span>
      <AdminSelect label={label} value={value} onChange={onChange}>{children}</AdminSelect>
    </label>
  )

  const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) => (
    <label className="admin-search-box">
      <span>Поиск</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )

  const InlineAlert = ({ children, variant = 'danger' }: { children?: ReactNode; variant?: 'danger' | 'info' }) => {
    if (!children) return null
    return <div className={`admin-inline-alert admin-inline-alert--${variant}`}>{children}</div>
  }

  const FieldHint = ({ children, variant = 'muted' }: { children?: ReactNode; variant?: 'muted' | 'danger' }) => {
    if (!children) return null
    return <em className={`admin-field-hint admin-field-hint--${variant}`}>{children}</em>
  }

  const PasswordInput = ({
    label,
    value,
    onChange,
    placeholder,
    helper,
    error,
    className = '',
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    helper?: ReactNode
    error?: ReactNode
    className?: string
  }) => {
    const [isVisible, setIsVisible] = useState(false)

    return (
      <label className={`admin-field ${className}`.trim()}>
        <span>{label}</span>
        <div className="admin-password-field">
          <input
            className="admin-input admin-password-field__input"
            type={isVisible ? 'text' : 'password'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="admin-password-field__toggle"
            onClick={() => setIsVisible((prev) => !prev)}
            aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
            title={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
          >
            <img src={isVisible ? hidePasswordIcon : showPasswordIcon} alt="" />
          </button>
        </div>
        {error ? <FieldHint variant="danger">{error}</FieldHint> : <FieldHint>{helper}</FieldHint>}
      </label>
    )
  }

  const FilterPanel = ({ children }: { children: ReactNode }) => <div className="admin-filter-panel">{children}</div>

  const Pagination = ({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) => {
    const pages = Math.max(Math.ceil(total / pageSize), 1)
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, total)

    if (total <= pageSize) {
      return total > 0 ? <div className="admin-pagination admin-pagination--single">Показано {total}</div> : null
    }

    const visiblePages = Array.from({ length: pages }, (_, index) => index + 1).filter((item) => {
      return item === 1 || item === pages || Math.abs(item - page) <= 1
    })

    return (
      <div className="admin-pagination">
        <div className="admin-pagination__meta">Показано {start}–{end} из {total}</div>
        <div className="admin-pagination__controls">
          <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Назад</button>
          {visiblePages.map((item, index) => {
            const prev = visiblePages[index - 1]
            const withGap = prev && item - prev > 1
            return (
              <span key={item} className="admin-pagination__page-wrap">
                {withGap ? <i>...</i> : null}
                <button type="button" className={item === page ? 'is-active' : ''} onClick={() => onChange(item)}>{item}</button>
              </span>
            )
          })}
          <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>Вперёд</button>
        </div>
      </div>
    )
  }

  const DashboardLineChart = ({ title, subtitle, points }: { title: string; subtitle: string; points: ChartPoint[] }) => {
    const normalizedPoints = points.filter((item) => item.label)
    const maxValue = Math.max(...normalizedPoints.map((item) => item.value), 1)
    const niceMax = Math.max(1, Math.ceil(maxValue / 5) * 5)
    const total = normalizedPoints.reduce((sum, item) => sum + item.value, 0)
    const latest = normalizedPoints[normalizedPoints.length - 1]?.value ?? 0
    const hasData = normalizedPoints.some((item) => item.value > 0)
    const yTicks = Array.from(
      new Set([niceMax, Math.round(niceMax * 0.75), Math.round(niceMax * 0.5), Math.round(niceMax * 0.25), 0]),
    )
    const chartTop = 8
    const chartBottom = 92
    const chartLeft = 4
    const chartWidth = 92

    const getY = (value: number) => chartBottom - (value / niceMax) * (chartBottom - chartTop)

    const coordinates = normalizedPoints.map((point, index) => {
      const denominator = Math.max(normalizedPoints.length - 1, 1)
      const x = normalizedPoints.length === 1 ? 50 : chartLeft + (index / denominator) * chartWidth
      const y = getY(point.value)
      return { ...point, x, y }
    })

    const linePath = coordinates.map((item) => `${item.x},${item.y}`).join(' ')
    const areaPath = coordinates.length
      ? `M ${coordinates[0].x} ${chartBottom} L ${coordinates.map((item) => `${item.x} ${item.y}`).join(' L ')} L ${coordinates[coordinates.length - 1].x} ${chartBottom} Z`
      : ''
    const visibleXAxisLabels = coordinates.filter((_, index) => {
      if (normalizedPoints.length <= 14) return true
      return index === 0 || index === normalizedPoints.length - 1 || normalizedPoints[index].value > 0
    })
    const nonZeroPoints = normalizedPoints.filter((item) => item.value > 0)

    return (
      <div className="admin-chart-card">
        <div className="admin-chart-card__head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <div className="admin-chart-card__meta">
            <div className="admin-chart-card__metric"><span>Всего</span><strong>{formatCompactNumber(total)}</strong></div>
            <div className="admin-chart-card__metric"><span>Последняя точка</span><strong>{formatCompactNumber(latest)}</strong></div>
          </div>
        </div>

        {!hasData ? (
          <div className="admin-chart-empty">Нет данных для отображения</div>
        ) : (
          <>
            <div className="admin-line-chart">
              <div className="admin-line-chart__y-axis">
                {yTicks.map((item) => (
                  <span key={item}>{formatCompactNumber(item)}</span>
                ))}
              </div>
              <div className="admin-line-chart__canvas">
                <svg className="admin-line-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {yTicks.map((tick) => {
                    const y = getY(tick)
                    return <line key={tick} x1="0" y1={y} x2="100" y2={y} className="admin-line-chart__grid" />
                  })}
                  <path d={areaPath} className="admin-line-chart__area" />
                  <polyline points={linePath} className="admin-line-chart__line" />
                </svg>
                <div className="admin-line-chart__points">
                  {coordinates.map((item) => (
                    <div
                      key={`${item.label}-${item.x}-${item.value}`}
                      className={`admin-line-chart__point ${item.value > 0 ? 'has-value' : ''}`}
                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      title={`${item.label}: ${item.value}`}
                    >
                      {item.value > 0 ? <strong>{item.value}<small>{item.label}</small></strong> : null}
                      <span />
                    </div>
                  ))}
                </div>
                <div className="admin-line-chart__x-axis">
                  {visibleXAxisLabels.map((item) => (
                    <span key={`${item.label}-${item.x}`} style={{ left: `${item.x}%` }} title={`${item.label}: ${item.value}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-line-chart__events" aria-label="Даты регистраций">
              {nonZeroPoints.map((item) => (
                <div key={`${item.label}-${item.value}`} className="admin-line-chart__event">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const DashboardBarChart = ({ title, subtitle, points }: { title: string; subtitle: string; points: ChartPoint[] }) => {
    const normalizedPoints = points.filter((item) => item.label)
    const max = Math.max(...normalizedPoints.map((item) => item.value), 1)
    const total = normalizedPoints.reduce((sum, item) => sum + item.value, 0)
    const hasData = normalizedPoints.some((item) => item.value > 0)

    return (
      <div className="admin-chart-card">
        <div className="admin-chart-card__head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <div className="admin-chart-card__meta">
            <div className="admin-chart-card__metric"><span>Категорий</span><strong>{normalizedPoints.length}</strong></div>
            <div className="admin-chart-card__metric"><span>Всего</span><strong>{formatCompactNumber(total)}</strong></div>
          </div>
        </div>

        {!hasData ? (
          <div className="admin-chart-empty">Нет данных для отображения</div>
        ) : (
          <div className="admin-progress-chart">
            {normalizedPoints.map((item, index) => {
              const width = (item.value / max) * 100
              const percent = getPercent(item.value, total)
              return (
                <div key={`${item.label}-${index}`} className="admin-progress-chart__row">
                  <div className="admin-progress-chart__meta">
                    <div className="admin-progress-chart__text"><strong>{item.label}</strong><span>{percent}% от общего</span></div>
                    <div className="admin-progress-chart__value">{formatCompactNumber(item.value)}</div>
                  </div>
                  <div className="admin-progress-chart__track">
                    <div className="admin-progress-chart__fill" style={{ width: `${Math.max(width, item.value > 0 ? 5 : 0)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const ChartBlock = ({ title, subtitle, points, variant }: { title: string; subtitle: string; points: ChartPoint[]; variant: 'line' | 'bars' }) => {
    if (variant === 'line') return <DashboardLineChart title={title} subtitle={subtitle} points={points} />
    return <DashboardBarChart title={title} subtitle={subtitle} points={points} />
  }

  const renderPrimitiveBadge = (value: boolean) => (
    <span className={`admin-badge ${value ? 'admin-badge--success' : 'admin-badge--danger'}`}>
      {value ? 'Активен' : 'Заблокирован'}
    </span>
  )

  const renderEntityButton = (label: string, onClick: () => void) => (
    <button type="button" className="admin-entity-link" onClick={onClick}>{label}</button>
  )

  const renderSummaryField = (label: string, value: ReactNode) => (
    <div className="admin-summary-item"><span>{label}</span><div>{value}</div></div>
  )

  export const AdminPage = () => {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
    const [pages, setPages] = useState<PageState>(defaultPages)
    const [selectedCatalog, setSelectedCatalog] = useState<CatalogKey>('cities')
    const [newCatalogName, setNewCatalogName] = useState('')
    const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null)
    const [editingCatalogName, setEditingCatalogName] = useState('')
    const [newCatalogRegionId, setNewCatalogRegionId] = useState('')
    const [newCatalogDistrictId, setNewCatalogDistrictId] = useState('')
    const [newCatalogSettlementTypeId, setNewCatalogSettlementTypeId] = useState('')
    const [editingCatalogRegionId, setEditingCatalogRegionId] = useState('')
    const [editingCatalogDistrictId, setEditingCatalogDistrictId] = useState('')
    const [editingCatalogSettlementTypeId, setEditingCatalogSettlementTypeId] = useState('')
    const [message, setMessage] = useState('Управляйте платформой централизованно.')
    const [pendingCatalogDelete, setPendingCatalogDelete] = useState<{
      item: CatalogItem
      catalog: CatalogKey
      conflict?: CatalogDeleteConflict
    } | null>(null)
    const [search, setSearch] = useState('')
    const [catalogSearch, setCatalogSearch] = useState('')
    const [detailTarget, setDetailTarget] = useState<DetailTarget>(null)
    const [dashboardChart, setDashboardChart] = useState<DashboardChartKey>('registrations')
    const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('30d')
    const [professionChartSource, setProfessionChartSource] = useState<ProfessionChartSource>('vacancies')
    const [adminStatusFilter, setAdminStatusFilter] = useState<CommonStatusFilter>('all')
    const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('all')
    const [userStatusFilter, setUserStatusFilter] = useState<CommonStatusFilter>('all')
    const [companyStatusFilter, setCompanyStatusFilter] = useState<CommonStatusFilter>('all')
    const [companyCityFilter, setCompanyCityFilter] = useState('all')
    const [companyTypeFilter, setCompanyTypeFilter] = useState('all')
    const [applicantStatusFilter, setApplicantStatusFilter] = useState<CommonStatusFilter>('all')
    const [applicantCityFilter, setApplicantCityFilter] = useState('all')
    const [applicantResumeFilter, setApplicantResumeFilter] = useState<ResumeFilter>('all')
    const [vacancyStatusFilter, setVacancyStatusFilter] = useState('all')
    const [vacancyCityFilter, setVacancyCityFilter] = useState('all')
    const [vacancyProfessionFilter, setVacancyProfessionFilter] = useState('all')
    const [vacancySalaryFilter, setVacancySalaryFilter] = useState<SalaryFilter>('all')
    const [applicationStatusFilter, setApplicationStatusFilter] = useState('all')
    const [applicationCompanyFilter, setApplicationCompanyFilter] = useState('all')
    const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState<AdminListItem | null>(null)
    const [deletingAdmin, setDeletingAdmin] = useState<AdminListItem | null>(null)
    const [newAdminEmail, setNewAdminEmail] = useState('')
    const [newAdminPassword, setNewAdminPassword] = useState('')
    const [editAdminEmail, setEditAdminEmail] = useState('')
    const [editAdminPassword, setEditAdminPassword] = useState('')
    const [editAdminIsActive, setEditAdminIsActive] = useState(true)
    const [editAdminCurrentPassword, setEditAdminCurrentPassword] = useState('')
    const [deleteAdminCurrentPassword, setDeleteAdminCurrentPassword] = useState('')
    const [isSelfSettingsOpen, setIsSelfSettingsOpen] = useState(false)
    const [selfEmail, setSelfEmail] = useState('')
    const [selfNewPassword, setSelfNewPassword] = useState('')
    const [selfCurrentPassword, setSelfCurrentPassword] = useState('')
    const [formError, setFormError] = useState('')

    useEffect(() => {
      const hasModal = !!detailTarget || isCreateAdminOpen || !!editingAdmin || !!deletingAdmin || isSelfSettingsOpen
      document.body.style.overflow = hasModal ? 'hidden' : ''
      return () => { document.body.style.overflow = '' }
    }, [detailTarget, isCreateAdminOpen, editingAdmin, deletingAdmin, isSelfSettingsOpen])

    const setPage = (tab: TabKey, page: number) => setPages((prev) => ({ ...prev, [tab]: Math.max(page, 1) }))
    const resetPage = (tab: TabKey = activeTab) => setPage(tab, 1)

    const authMeQuery = useQuery({ queryKey: ['admin-auth-me'], queryFn: fetchAuthMe, retry: false, refetchOnWindowFocus: false })
    const dashboardQuery = useQuery({ queryKey: ['admin-dashboard', dashboardPeriod], queryFn: () => fetchDashboard(dashboardPeriod), retry: false, refetchOnWindowFocus: false })
    const adminsQuery = useQuery({ queryKey: ['admin-admins'], queryFn: fetchAdmins, retry: false, refetchOnWindowFocus: false })
    const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers, retry: false, refetchOnWindowFocus: false })
    const companiesQuery = useQuery({ queryKey: ['admin-companies'], queryFn: fetchCompanies, retry: false, refetchOnWindowFocus: false })
    const applicantsQuery = useQuery({ queryKey: ['admin-applicants'], queryFn: fetchApplicants, retry: false, refetchOnWindowFocus: false })
    const vacanciesQuery = useQuery({ queryKey: ['admin-vacancies'], queryFn: fetchVacancies, retry: false, refetchOnWindowFocus: false })
    const applicationsQuery = useQuery({ queryKey: ['admin-applications'], queryFn: fetchApplications, retry: false, refetchOnWindowFocus: false })
    const statusesQuery = useQuery({ queryKey: ['admin-statuses'], queryFn: () => fetchCatalog('statuses'), retry: false, refetchOnWindowFocus: false })
    const professionsQuery = useQuery({ queryKey: ['admin-professions'], queryFn: () => fetchCatalog('professions'), retry: false, refetchOnWindowFocus: false })
    const applicantDetailsForResumesQuery = useQuery({
      queryKey: ['admin-applicant-details-for-resumes', applicantsQuery.data?.map((item) => item.id).join(',') || 'empty'],
      queryFn: () => fetchApplicantDetailsForResumes(applicantsQuery.data || []),
      enabled: Boolean(applicantsQuery.data?.length),
      retry: false,
      refetchOnWindowFocus: false,
    })
    const selectedCatalogQuery = useQuery({ queryKey: ['admin-catalog', selectedCatalog], queryFn: () => fetchCatalog(selectedCatalog), retry: false, refetchOnWindowFocus: false })
    const regionsCatalogQuery = useQuery({ queryKey: ['admin-catalog-options', 'regions'], queryFn: () => fetchCatalog('regions'), retry: false, refetchOnWindowFocus: false })
    const districtsCatalogQuery = useQuery({ queryKey: ['admin-catalog-options', 'districts'], queryFn: () => fetchCatalog('districts'), retry: false, refetchOnWindowFocus: false })
    const settlementTypesCatalogQuery = useQuery({ queryKey: ['admin-catalog-options', 'settlement-types'], queryFn: () => fetchCatalog('settlement-types'), retry: false, refetchOnWindowFocus: false })

    const userDetailQuery = useQuery({ queryKey: ['admin-user-detail', detailTarget?.kind === 'user' ? detailTarget.id : null], queryFn: () => fetchUserDetail((detailTarget as { kind: 'user'; id: number }).id), enabled: detailTarget?.kind === 'user', retry: false, refetchOnWindowFocus: false })
    const companyDetailQuery = useQuery({ queryKey: ['admin-company-detail', detailTarget?.kind === 'company' ? detailTarget.id : null], queryFn: () => fetchCompanyDetail((detailTarget as { kind: 'company'; id: number }).id), enabled: detailTarget?.kind === 'company', retry: false, refetchOnWindowFocus: false })
    const applicantDetailQuery = useQuery({ queryKey: ['admin-applicant-detail', detailTarget?.kind === 'applicant' ? detailTarget.id : null], queryFn: () => fetchApplicantDetail((detailTarget as { kind: 'applicant'; id: number }).id), enabled: detailTarget?.kind === 'applicant', retry: false, refetchOnWindowFocus: false })
    const vacancyDetailQuery = useQuery({ queryKey: ['admin-vacancy-detail', detailTarget?.kind === 'vacancy' ? detailTarget.id : null], queryFn: () => fetchVacancyDetail((detailTarget as { kind: 'vacancy'; id: number }).id), enabled: detailTarget?.kind === 'vacancy', retry: false, refetchOnWindowFocus: false })
    const applicationDetailQuery = useQuery({ queryKey: ['admin-application-detail', detailTarget?.kind === 'application' ? detailTarget.vacancyId : null, detailTarget?.kind === 'application' ? detailTarget.resumeId : null], queryFn: () => fetchApplicationDetail((detailTarget as { kind: 'application'; vacancyId: number; resumeId: number }).vacancyId, (detailTarget as { kind: 'application'; vacancyId: number; resumeId: number }).resumeId), enabled: detailTarget?.kind === 'application', retry: false, refetchOnWindowFocus: false })
    const adminDetailQuery = useQuery({ queryKey: ['admin-detail', detailTarget?.kind === 'admin' ? detailTarget.id : null], queryFn: () => fetchAdminDetail((detailTarget as { kind: 'admin'; id: number }).id), enabled: detailTarget?.kind === 'admin', retry: false, refetchOnWindowFocus: false })

    const isRootAdmin = authMeQuery.data?.id === 1

    const invalidateDashboard = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }) }

    const setHandledError = (error: unknown, fallback: string) => {
      const text = getErrorMessage(error, fallback)
      setFormError(text)
      setMessage(text)
    }

    const toggleUserMutation = useMutation({
      mutationFn: async (user: UserAdmin) => {
        if (user.id === 1) throw new Error('Главного администратора нельзя заблокировать.')
        await http.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active })
      },
      onSuccess: async () => {
        setMessage('Статус пользователя обновлён.')
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        await invalidateDashboard()
      },
      onError: (error) => setHandledError(error, 'Не удалось изменить статус пользователя.'),
    })
    const toggleCompanyMutation = useMutation({ mutationFn: async (company: CompanyAdmin) => { await http.patch(`/admin/companies/${company.id}/status`, { is_active: !company.is_active }) }, onSuccess: async () => { setMessage('Статус компании обновлён.'); await queryClient.invalidateQueries({ queryKey: ['admin-companies'] }); await invalidateDashboard() }, onError: (error) => setHandledError(error, 'Не удалось обновить статус компании.') })
    const toggleApplicantMutation = useMutation({ mutationFn: async (applicant: ApplicantAdmin) => { await http.patch(`/admin/applicants/${applicant.id}/status`, { is_active: !applicant.is_active }) }, onSuccess: async () => { setMessage('Статус соискателя обновлён.'); await queryClient.invalidateQueries({ queryKey: ['admin-applicants'] }); await invalidateDashboard() }, onError: (error) => setHandledError(error, 'Не удалось обновить статус соискателя.') })
    const updateVacancyStatusMutation = useMutation({ mutationFn: async (params: { vacancyId: number; statusId: number }) => { await http.patch(`/admin/vacancies/${params.vacancyId}/status`, { status_id: params.statusId }) }, onSuccess: async () => { setMessage('Статус вакансии обновлён.'); await queryClient.invalidateQueries({ queryKey: ['admin-vacancies'] }); await invalidateDashboard() }, onError: (error) => setHandledError(error, 'Не удалось обновить статус вакансии.') })
    const updateApplicationStatusMutation = useMutation({ mutationFn: async (params: { vacancyId: number; resumeId: number; status: string }) => { await http.patch(`/admin/applications/${params.vacancyId}/${params.resumeId}`, { status: params.status }) }, onSuccess: async () => { setMessage('Статус отклика обновлён.'); await queryClient.invalidateQueries({ queryKey: ['admin-applications'] }); await invalidateDashboard() }, onError: (error) => setHandledError(error, 'Не удалось обновить статус отклика.') })

    const resetCatalogDrafts = () => {
      setNewCatalogName('')
      setNewCatalogRegionId('')
      setNewCatalogDistrictId('')
      setNewCatalogSettlementTypeId('')
      setEditingCatalogId(null)
      setEditingCatalogName('')
      setEditingCatalogRegionId('')
      setEditingCatalogDistrictId('')
      setEditingCatalogSettlementTypeId('')
    }

    const buildCreateCatalogPayload = () => {
      const payload: Record<string, unknown> = { name: newCatalogName.trim() }

      if (selectedCatalog === 'districts') payload.region_id = safeNumber(newCatalogRegionId)
      if (selectedCatalog === 'cities') {
        payload.district_id = safeNumber(newCatalogDistrictId)
        payload.settlement_type_id = safeNumber(newCatalogSettlementTypeId)
      }

      return payload
    }

    const buildUpdateCatalogPayload = () => {
      const payload: Record<string, unknown> = { name: editingCatalogName.trim() }

      if (selectedCatalog === 'districts') payload.region_id = safeNumber(editingCatalogRegionId)
      if (selectedCatalog === 'cities') {
        payload.district_id = safeNumber(editingCatalogDistrictId)
        payload.settlement_type_id = safeNumber(editingCatalogSettlementTypeId)
      }

      return payload
    }

    const invalidateCatalogsAfterMutation = async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog', selectedCatalog] })
      await queryClient.invalidateQueries({ queryKey: ['admin-catalog-options'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-applicants'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-vacancies'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
      await invalidateDashboard()
    }

    const canSubmitCreateCatalog = () => {
      if (!newCatalogName.trim()) return false
      if (selectedCatalog === 'districts' && !newCatalogRegionId) return false
      if (selectedCatalog === 'cities' && (!newCatalogRegionId || !newCatalogDistrictId)) return false
      return true
    }

    const canSubmitUpdateCatalog = () => {
      if (!editingCatalogName.trim()) return false
      if (selectedCatalog === 'districts' && !editingCatalogRegionId) return false
      if (selectedCatalog === 'cities' && (!editingCatalogRegionId || !editingCatalogDistrictId)) return false
      return true
    }

    const createCatalogItemMutation = useMutation({ mutationFn: async () => { await http.post(`/admin/catalogs/${selectedCatalog}`, buildCreateCatalogPayload()) }, onSuccess: async () => { resetCatalogDrafts(); setMessage('Элемент справочника создан.'); await invalidateCatalogsAfterMutation() }, onError: (error) => setHandledError(error, 'Не удалось создать элемент справочника.') })
    const updateCatalogItemMutation = useMutation({ mutationFn: async (itemId: number) => { await http.put(`/admin/catalogs/${selectedCatalog}/${itemId}`, buildUpdateCatalogPayload()) }, onSuccess: async () => { resetCatalogDrafts(); setMessage('Элемент справочника обновлён.'); await invalidateCatalogsAfterMutation() }, onError: (error) => setHandledError(error, 'Не удалось обновить элемент справочника.') })
    const deleteCatalogItemMutation = useMutation({
      mutationFn: async (params: { item: CatalogItem; catalog: CatalogKey; force?: boolean }) => {
        await http.delete(`/admin/catalogs/${params.catalog}/${params.item.id}`, {
          params: params.force ? { force: true } : undefined,
        })
      },
      onSuccess: async () => {
        setPendingCatalogDelete(null)
        setMessage('Элемент справочника удалён.')
        await invalidateCatalogsAfterMutation()
      },
      onError: (error, params) => {
        const conflict = getCatalogDeleteConflict(error)

        if (conflict) {
          setPendingCatalogDelete({
            item: params.item,
            catalog: params.catalog,
            conflict,
          })
          setFormError('')
          setMessage('Удаление требует подтверждения.')
          return
        }

        setHandledError(error, 'Не удалось удалить элемент справочника.')
      },
    })
    const createAdminMutation = useMutation({
      mutationFn: async () => {
        await http.post('/admin/admins', { email: newAdminEmail.trim(), password: newAdminPassword })
      },
      onSuccess: async () => {
        setNewAdminEmail('')
        setNewAdminPassword('')
        setFormError('')
        setIsCreateAdminOpen(false)
        setMessage('Новый администратор создан.')
        await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        await invalidateDashboard()
      },
      onError: (error) => setHandledError(error, 'Не удалось создать администратора.'),
    })
    const updateAdminMutation = useMutation({
      mutationFn: async (adminId: number) => {
        if (adminId === 1 && !editAdminIsActive) throw new Error('Главного администратора нельзя заблокировать.')
        await http.patch(`/admin/admins/${adminId}`, {
          email: editAdminEmail.trim(),
          new_password: editAdminPassword.trim() || null,
          is_active: adminId === 1 ? true : editAdminIsActive,
          current_admin_password: editAdminCurrentPassword,
        })
      },
      onSuccess: async () => {
        setEditingAdmin(null)
        setEditAdminEmail('')
        setEditAdminPassword('')
        setEditAdminCurrentPassword('')
        setFormError('')
        setMessage('Администратор обновлён.')
        await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        await invalidateDashboard()
      },
      onError: (error) => setHandledError(error, 'Не удалось обновить администратора.'),
    })
    const deleteAdminMutation = useMutation({
      mutationFn: async (adminId: number) => {
        if (adminId === 1) throw new Error('Главного администратора нельзя удалить.')
        await http.delete(`/admin/admins/${adminId}`, { data: { current_admin_password: deleteAdminCurrentPassword } })
      },
      onSuccess: async () => {
        setDeletingAdmin(null)
        setDeleteAdminCurrentPassword('')
        setFormError('')
        setMessage('Администратор удалён.')
        await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        await invalidateDashboard()
      },
      onError: (error) => setHandledError(error, 'Не удалось удалить администратора.'),
    })

    const updateSelfSettingsMutation = useMutation({
      mutationFn: async () => {
        if (!authMeQuery.data?.id) throw new Error('Не удалось определить текущего администратора')
        const normalizedEmail = selfEmail.trim()
        const currentEmail = authMeQuery.data.email || ''
        const passwordChanged = selfNewPassword.trim().length > 0
        const emailChanged = normalizedEmail !== currentEmail
        if (!emailChanged && !passwordChanged) throw new Error('Нет изменений для сохранения')
        if (!selfCurrentPassword.trim()) throw new Error('Введите текущий пароль')
        if (passwordChanged && selfNewPassword.trim().length < 8) throw new Error('Новый пароль должен содержать минимум 8 символов')
        await http.patch(`/admin/admins/${authMeQuery.data.id}`, { email: normalizedEmail, new_password: passwordChanged ? selfNewPassword.trim() : null, is_active: authMeQuery.data.is_active ?? true, current_admin_password: selfCurrentPassword })
        return { passwordChanged }
      },
      onSuccess: async ({ passwordChanged }) => {
        setMessage(passwordChanged ? 'Данные обновлены. После смены пароля нужно войти заново.' : 'Данные администратора обновлены.')
        setIsSelfSettingsOpen(false)
        setSelfCurrentPassword('')
        setSelfNewPassword('')
        setFormError('')
        await queryClient.invalidateQueries({ queryKey: ['admin-auth-me'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-admins'] })
        if (passwordChanged) { authSession.clear(); navigate('/admin/login', { replace: true }) }
      },
      onError: (error) => setHandledError(error, 'Не удалось обновить данные администратора.'),
    })

    const selectedCatalogLabel = useMemo(() => catalogDefinitions.find((item) => item.key === selectedCatalog)?.label || 'Справочник', [selectedCatalog])

    const periodStart = useMemo(() => getPeriodStart(dashboardPeriod), [dashboardPeriod])

    const periodUsers = useMemo(() => {
      return (usersQuery.data || []).filter((item) => isWithinPeriod(item.created_at, periodStart))
    }, [usersQuery.data, periodStart])

    const periodAdmins = useMemo(() => {
      return (adminsQuery.data || []).filter((item) => isWithinPeriod(item.created_at, periodStart))
    }, [adminsQuery.data, periodStart])

    const periodCompanies = useMemo(() => {
      const users = usersQuery.data || []

      return (companiesQuery.data || []).filter((company) => {
        const linkedUser = users.find((user) => {
          return user.company_id === company.id || Boolean(company.user_id && user.id === company.user_id)
        })

        return isWithinPeriodWithFallback(company.created_at, linkedUser?.created_at, periodStart)
      })
    }, [companiesQuery.data, usersQuery.data, periodStart])

    const periodApplicants = useMemo(() => {
      const users = usersQuery.data || []

      return (applicantsQuery.data || []).filter((applicant) => {
        const linkedUser = users.find((user) => user.applicant_id === applicant.id)
        return isWithinPeriodWithFallback(applicant.created_at, linkedUser?.created_at, periodStart)
      })
    }, [applicantsQuery.data, usersQuery.data, periodStart])

    const periodVacancies = useMemo(() => {
      return (vacanciesQuery.data || []).filter((item) => isWithinPeriod(item.created_at, periodStart))
    }, [vacanciesQuery.data, periodStart])

    const periodApplications = useMemo(() => {
      return (applicationsQuery.data || []).filter((item) => isWithinPeriod(item.created_at, periodStart))
    }, [applicationsQuery.data, periodStart])

    const professionById = useMemo(() => {
      return (professionsQuery.data || []).reduce<Record<number, string>>((acc, item) => {
        acc[item.id] = item.name
        return acc
      }, {})
    }, [professionsQuery.data])

    const resumeSourceApplicants = applicantDetailsForResumesQuery.data || applicantsQuery.data || []

    const periodResumes = useMemo(() => {
      return resumeSourceApplicants.flatMap((applicant) => {
        return toArray<Record<string, unknown>>(applicant.resumes)
          .filter((resume) => {
            const resumeCreatedAt = safeString(resume.created_at) || null
            return isWithinPeriodWithFallback(resumeCreatedAt, applicant.created_at, periodStart)
          })
          .map((resume) => ({ applicant, resume }))
      })
    }, [resumeSourceApplicants, periodStart])

    const dashboard = useMemo<DashboardResponse>(() => {
      const rawDashboard = dashboardQuery.data || {}
      const hasClientData = Boolean(
        usersQuery.data || companiesQuery.data || applicantsQuery.data || vacanciesQuery.data || applicationsQuery.data,
      )

      if (!hasClientData && dashboardPeriod === 'all') {
        return rawDashboard
      }

      const usersByRole = periodUsers.reduce<Record<string, number>>((acc, item) => {
        acc[item.role] = (acc[item.role] || 0) + 1
        return acc
      }, {})

      const applicationsByStatus = periodApplications.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {})

      return {
        users_total: periodUsers.length,
        users_active: periodUsers.filter((item) => item.is_active).length,
        users_blocked: periodUsers.filter((item) => !item.is_active).length,
        companies_total: periodCompanies.length,
        applicants_total: periodApplicants.length,
        vacancies_total: periodVacancies.length,
        applications_total: periodApplications.length,
        admins_total: periodAdmins.length,
        users_by_role: usersByRole,
        applications_by_status: applicationsByStatus,
        registrations: buildRegistrations(periodUsers, dashboardPeriod),
        top_cities: countByLabel(periodApplicants.map((item) => item.city_name)),
        top_professions: countByLabel(
          periodVacancies.map((item) => {
            if (item.profession_id && professionById[item.profession_id]) return professionById[item.profession_id]
            return item.profession_name || item.title
          }),
        ),
      }
    }, [
      dashboardQuery.data,
      usersQuery.data,
      companiesQuery.data,
      applicantsQuery.data,
      vacanciesQuery.data,
      applicationsQuery.data,
      dashboardPeriod,
      periodUsers,
      periodAdmins,
      periodCompanies,
      periodApplicants,
      periodVacancies,
      periodApplications,
      professionById,
    ])

    const resumeProfessionPoints = useMemo(() => {
      return countByLabel(periodResumes.map(({ resume }) => getResumeProfessionName(resume, professionById)))
    }, [periodResumes, professionById])

    const vacancyProfessionPoints = useMemo(() => {
      return countByLabel(
        periodVacancies.map((item) => {
          if (item.profession_id && professionById[item.profession_id]) return professionById[item.profession_id]
          return item.profession_name || item.title
        }),
      )
    }, [periodVacancies, professionById])

    const companyCityOptions = useMemo(() => uniqueStrings((companiesQuery.data || []).flatMap((item) => item.cities || [])), [companiesQuery.data])
    const companyTypeOptions = useMemo(() => uniqueStrings((companiesQuery.data || []).map((item) => item.company_type_name)), [companiesQuery.data])
    const applicantCityOptions = useMemo(() => uniqueStrings((applicantsQuery.data || []).map((item) => item.city_name)), [applicantsQuery.data])
    const vacancyStatusOptions = useMemo(() => uniqueStrings((vacanciesQuery.data || []).map((item) => item.status_name)), [vacanciesQuery.data])
    const vacancyCityOptions = useMemo(() => uniqueStrings((vacanciesQuery.data || []).map((item) => item.city_name)), [vacanciesQuery.data])
    const vacancyProfessionOptions = useMemo(() => uniqueStrings((vacanciesQuery.data || []).map((item) => item.profession_name)), [vacanciesQuery.data])
    const applicationCompanyOptions = useMemo(() => uniqueStrings((applicationsQuery.data || []).map((item) => item.company_name)), [applicationsQuery.data])
    const applicationStatusOptions = useMemo(() => uniqueStrings((applicationsQuery.data || []).map((item) => item.status)), [applicationsQuery.data])

    const filteredCatalogItems = useMemo(() => {
      const value = catalogSearch.trim().toLowerCase()
      const items = selectedCatalogQuery.data || []
      if (!value) return items
      return items.filter((item) => getCatalogSearchText(item).includes(value))
    }, [catalogSearch, selectedCatalogQuery.data])

    const filteredAdmins = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (adminsQuery.data || []).filter((item) => (!value || item.email.toLowerCase().includes(value) || String(item.id).includes(value)) && statusFilterMatches(item.is_active, adminStatusFilter))
    }, [search, adminStatusFilter, adminsQuery.data])

    const filteredUsers = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (usersQuery.data || []).filter((item) => (!value || toSearchValue(item.email, item.role, item.id).includes(value)) && (userRoleFilter === 'all' || item.role === userRoleFilter) && statusFilterMatches(item.is_active, userStatusFilter))
    }, [search, userRoleFilter, userStatusFilter, usersQuery.data])

    const filteredCompanies = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (companiesQuery.data || []).filter((item) => (!value || toSearchValue(item.name, item.website, item.user_email, item.id).includes(value)) && statusFilterMatches(item.is_active, companyStatusFilter) && (companyCityFilter === 'all' || (item.cities || []).includes(companyCityFilter)) && (companyTypeFilter === 'all' || item.company_type_name === companyTypeFilter))
    }, [search, companyStatusFilter, companyCityFilter, companyTypeFilter, companiesQuery.data])

    const filteredApplicants = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (applicantsQuery.data || []).filter((item) => {
        const matchesSearch = !value || toSearchValue(item.full_name, item.phone, item.email, item.id).includes(value)
        const matchesStatus = statusFilterMatches(item.is_active, applicantStatusFilter)
        const matchesCity = applicantCityFilter === 'all' || item.city_name === applicantCityFilter
        const matchesResume = applicantResumeFilter === 'all' || (applicantResumeFilter === 'has-resumes' ? (item.resumes_count || 0) > 0 : (item.resumes_count || 0) === 0)
        return matchesSearch && matchesStatus && matchesCity && matchesResume
      })
    }, [search, applicantStatusFilter, applicantCityFilter, applicantResumeFilter, applicantsQuery.data])

    const filteredVacancies = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (vacanciesQuery.data || []).filter((item) => {
        const matchesSearch = !value || toSearchValue(item.title, item.description, item.company_name, item.id).includes(value)
        const matchesStatus = vacancyStatusFilter === 'all' || item.status_name === vacancyStatusFilter
        const matchesCity = vacancyCityFilter === 'all' || item.city_name === vacancyCityFilter
        const matchesProfession = vacancyProfessionFilter === 'all' || item.profession_name === vacancyProfessionFilter
        const hasSalary = Boolean(item.salary_min || item.salary_max)
        const matchesSalary = vacancySalaryFilter === 'all' || (vacancySalaryFilter === 'with-salary' ? hasSalary : !hasSalary)
        return matchesSearch && matchesStatus && matchesCity && matchesProfession && matchesSalary
      })
    }, [search, vacancyStatusFilter, vacancyCityFilter, vacancyProfessionFilter, vacancySalaryFilter, vacanciesQuery.data])

    const filteredApplications = useMemo(() => {
      const value = search.trim().toLowerCase()
      return (applicationsQuery.data || []).filter((item) => (!value || toSearchValue(item.vacancy_title, item.company_name, item.resume_profession, item.applicant_name, item.vacancy_id, item.resume_id).includes(value)) && (applicationStatusFilter === 'all' || item.status === applicationStatusFilter) && (applicationCompanyFilter === 'all' || item.company_name === applicationCompanyFilter))
    }, [search, applicationStatusFilter, applicationCompanyFilter, applicationsQuery.data])

    const dashboardChartMeta = useMemo(() => {
      const meta = dashboardCharts.find((item) => item.value === dashboardChart) || dashboardCharts[0]

      if (dashboardChart === 'top-professions') {
        return {
          ...meta,
          description:
            professionChartSource === 'resumes'
              ? 'Профессии резюме соискателей'
              : 'Профессии вакансий работодателей',
        }
      }

      return meta
    }, [dashboardChart, professionChartSource])
    const dashboardChartVariant = useMemo<'line' | 'bars'>(() => dashboardChart === 'registrations' ? 'line' : 'bars', [dashboardChart])

    const dashboardChartPoints = useMemo<ChartPoint[]>(() => {
      if (dashboardChart === 'registrations') {
        return (dashboard.registrations || []).map((item) => ({
          label: item.label || formatChartDate(item.date || null),
          value: item.users ?? item.count ?? 0,
        }))
      }

      if (dashboardChart === 'platform') {
        return [
          { label: 'Компании', value: dashboard.companies_total ?? 0 },
          { label: 'Соискатели', value: dashboard.applicants_total ?? 0 },
        ]
      }

      if (dashboardChart === 'roles') {
        return Object.entries(dashboard.users_by_role || {}).map(([key, value]) => ({
          label:
            key === 'admin'
              ? 'Админы'
              : key === 'company'
                ? 'Работодатели'
                : key === 'applicant'
                  ? 'Соискатели'
                  : key,
          value,
        }))
      }

      if (dashboardChart === 'applications-status') {
        return Object.entries(dashboard.applications_by_status || {}).map(([key, value]) => ({
          label: statusLabels[key] || key,
          value,
        }))
      }

      if (dashboardChart === 'top-cities') {
        return (dashboard.top_cities || []).map((item) => ({ label: item.label, value: item.value }))
      }

      return professionChartSource === 'resumes' ? resumeProfessionPoints : vacancyProfessionPoints
    }, [dashboardChart, dashboard, professionChartSource, resumeProfessionPoints, vacancyProfessionPoints])

    const detailData = detailTarget?.kind === 'admin' ? adminDetailQuery.data : detailTarget?.kind === 'user' ? userDetailQuery.data : detailTarget?.kind === 'company' ? companyDetailQuery.data : detailTarget?.kind === 'applicant' ? applicantDetailQuery.data : detailTarget?.kind === 'vacancy' ? vacancyDetailQuery.data : detailTarget?.kind === 'application' ? applicationDetailQuery.data : null
    const detailLoading = adminDetailQuery.isLoading || userDetailQuery.isLoading || companyDetailQuery.isLoading || applicantDetailQuery.isLoading || vacancyDetailQuery.isLoading || applicationDetailQuery.isLoading

    const openDetail = (target: DetailTarget) => setDetailTarget(target)
    const closeDetail = () => setDetailTarget(null)
    const openCompanyById = (companyId?: number | null) => { if (companyId) openDetail({ kind: 'company', id: companyId }) }
    const openApplicantById = (applicantId?: number | null) => { if (applicantId) openDetail({ kind: 'applicant', id: applicantId }) }
    const openVacancyById = (vacancyId?: number | null) => { if (vacancyId) openDetail({ kind: 'vacancy', id: vacancyId }) }
    const openUserById = (userId?: number | null) => { if (userId) openDetail({ kind: 'user', id: userId }) }

    const findCompanyByName = (name?: string | null) => {
      const normalized = safeString(name).trim().toLowerCase()
      if (!normalized) return null
      return (companiesQuery.data || []).find((item) => item.name.trim().toLowerCase() === normalized)
    }

    const findApplicantByName = (name?: string | null) => {
      const normalized = safeString(name).trim().toLowerCase()
      if (!normalized) return null
      return (applicantsQuery.data || []).find((item) => item.full_name.trim().toLowerCase() === normalized)
    }

    const resetSearchAndFilters = (tab: TabKey) => { setActiveTab(tab); setSearch(''); setCatalogSearch(''); resetPage(tab) }

    const resetCurrentFilters = () => {
      setSearch('')
      setCatalogSearch('')
      if (activeTab === 'admins') setAdminStatusFilter('all')
      if (activeTab === 'users') { setUserRoleFilter('all'); setUserStatusFilter('all') }
      if (activeTab === 'companies') { setCompanyStatusFilter('all'); setCompanyCityFilter('all'); setCompanyTypeFilter('all') }
      if (activeTab === 'applicants') { setApplicantStatusFilter('all'); setApplicantCityFilter('all'); setApplicantResumeFilter('all') }
      if (activeTab === 'vacancies') { setVacancyStatusFilter('all'); setVacancyCityFilter('all'); setVacancyProfessionFilter('all'); setVacancySalaryFilter('all') }
      if (activeTab === 'applications') { setApplicationStatusFilter('all'); setApplicationCompanyFilter('all') }
      resetPage(activeTab)
    }

    const openCreateAdminModal = () => {
      setFormError('')
      setNewAdminEmail('')
      setNewAdminPassword('')
      setIsCreateAdminOpen(true)
    }

    const closeCreateAdminModal = () => {
      setFormError('')
      setIsCreateAdminOpen(false)
    }

    const closeEditAdminModal = () => {
      setFormError('')
      setEditingAdmin(null)
    }

    const closeDeleteAdminModal = () => {
      setFormError('')
      setDeletingAdmin(null)
    }

    const closeSelfSettingsModal = () => {
      setFormError('')
      setIsSelfSettingsOpen(false)
    }

    const handleCreateAdmin = () => {
      const emailError = getEmailError(newAdminEmail)
      const passwordError = getRequiredPasswordError(newAdminPassword)
      const error = emailError || passwordError

      if (error) {
        setFormError(error)
        setMessage(error)
        return
      }

      setFormError('')
      createAdminMutation.mutate()
    }

    const handleUpdateAdmin = (admin: AdminListItem) => {
      const emailError = getEmailError(editAdminEmail)
      const passwordError = getOptionalPasswordError(editAdminPassword)
      const currentPasswordError = getRequiredPasswordError(editAdminCurrentPassword, 'Пароль текущего администратора')
      const rootError = admin.id === 1 && !editAdminIsActive ? 'Главного администратора нельзя заблокировать.' : ''
      const error = emailError || passwordError || currentPasswordError || rootError

      if (error) {
        setFormError(error)
        setMessage(error)
        return
      }

      setFormError('')
      updateAdminMutation.mutate(admin.id)
    }

    const handleDeleteAdmin = (admin: AdminListItem) => {
      const rootError = admin.id === 1 ? 'Главного администратора нельзя удалить.' : ''
      const passwordError = getRequiredPasswordError(deleteAdminCurrentPassword, 'Пароль текущего администратора')
      const error = rootError || passwordError

      if (error) {
        setFormError(error)
        setMessage(error)
        return
      }

      setFormError('')
      deleteAdminMutation.mutate(admin.id)
    }

    const handleUpdateSelfSettings = () => {
      const emailError = getEmailError(selfEmail)
      const passwordError = getOptionalPasswordError(selfNewPassword)
      const currentPasswordError = getRequiredPasswordError(selfCurrentPassword, 'Текущий пароль')
      const noChangesError = selfEmail.trim() === (authMeQuery.data?.email || '') && !selfNewPassword.trim()
        ? 'Нет изменений для сохранения.'
        : ''
      const error = emailError || passwordError || currentPasswordError || noChangesError

      if (error) {
        setFormError(error)
        setMessage(error)
        return
      }

      setFormError('')
      updateSelfSettingsMutation.mutate()
    }

  const renderAdminDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.email) || `Администратор ID ${safeNumber(data.id) ?? 0}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}
            {renderSummaryField('Роль', <span>Администратор</span>)}
            {renderSummaryField(
              'Статус',
              typeof data.is_active === 'boolean' ? renderPrimitiveBadge(Boolean(data.is_active)) : <span>—</span>,
            )}
            {renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
            {renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}

          </div>
        </section>
      </div>
    )
  }

    const renderUserDetailContent = () => {
      const data = (detailData || {}) as Record<string, unknown>
      const role = safeString(data.role)
      const companyId = safeNumber(data.company_id)
      const applicantId = safeNumber(data.applicant_id)
      const companyName = safeString(data.company_name)
      const applicantFullName = safeString(data.applicant_full_name)
      return <div className="admin-detail-layout"><section className="admin-section"><div className="admin-section__header"><h4>Основная информация</h4></div><div className="admin-summary-grid">{renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}{renderSummaryField('Роль', <span>{role === 'admin' ? 'Администратор' : role === 'company' ? 'Работодатель' : 'Соискатель'}</span>)}{renderSummaryField('Статус', typeof data.is_active === 'boolean' ? renderPrimitiveBadge(Boolean(data.is_active)) : <span>—</span>)}{renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}{renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}{renderSummaryField('Количество вакансий', <span>{safeString(data.vacancies_count) || '0'}</span>)}{renderSummaryField('Количество резюме', <span>{safeString(data.resumes_count) || '0'}</span>)}{renderSummaryField('Количество откликов', <span>{safeString(data.applications_count) || '0'}</span>)}</div></section>{role === 'company' ? <section className="admin-section"><div className="admin-section__header"><h4>Связанная компания</h4></div>{companyId ? <div className="admin-section__body">{renderEntityButton(companyName || `Компания #${companyId}`, () => openCompanyById(companyId))}</div> : <div className="admin-empty-inline">Компания не привязана</div>}</section> : null}{role === 'applicant' ? <section className="admin-section"><div className="admin-section__header"><h4>Связанный соискатель</h4></div>{applicantId ? <div className="admin-section__body">{renderEntityButton(applicantFullName || `Соискатель #${applicantId}`, () => openApplicantById(applicantId))}</div> : <div className="admin-empty-inline">Соискатель не привязан</div>}</section> : null}</div>
    }

    const renderCompanyDetailContent = () => {
      const data = (detailData || {}) as Record<string, unknown>
      const companyId = safeNumber(data.id) ?? 0
      const linkedVacancies = (vacanciesQuery.data || []).filter((item) => item.company_id === companyId)
      return <div className="admin-detail-layout"><section className="admin-section"><div className="admin-section__header"><h4>{safeString(data.name) || `Компания #${companyId}`}</h4></div><div className="admin-summary-grid">{renderSummaryField('Тип компании', <span>{safeString(data.company_type_name) || '—'}</span>)}{renderSummaryField('Сайт', safeString(data.website) ? <a href={safeString(data.website)} target="_blank" rel="noreferrer" className="admin-detail-link">{safeString(data.website)}</a> : <span>—</span>)}{renderSummaryField('Статус', typeof data.is_active === 'boolean' ? renderPrimitiveBadge(Boolean(data.is_active)) : <span>—</span>)}{renderSummaryField('Год основания', <span>{safeString(data.founded_year) || '—'}</span>)}{renderSummaryField('Сотрудников', <span>{safeString(data.employee_count) || '—'}</span>)}{renderSummaryField('Вакансий', <span>{safeString(data.vacancies_count) || '0'}</span>)}</div>{safeString(data.description) ? <div className="admin-description-box">{safeString(data.description)}</div> : null}</section><section className="admin-section"><div className="admin-section__header"><h4>Связанные данные</h4></div><div className="admin-summary-grid">{renderSummaryField('Пользователь', safeNumber(data.user_id) ? renderEntityButton(safeString(data.user_email) || `Пользователь #${safeNumber(data.user_id)}`, () => openUserById(safeNumber(data.user_id))) : <span>—</span>)}{renderSummaryField('Города', toArray<string>(data.cities).length ? <div className="admin-chip-list">{toArray<string>(data.cities).map((city) => <span key={city} className="admin-chip">{city}</span>)}</div> : <span>—</span>)}</div></section><section className="admin-section"><div className="admin-section__header"><h4>Вакансии компании</h4></div>{linkedVacancies.length > 0 ? <div className="admin-linked-card-grid">{linkedVacancies.map((vacancy) => <button key={vacancy.id} type="button" className="admin-linked-card" onClick={() => openVacancyById(vacancy.id)}><div className="admin-linked-card__title">{vacancy.title}</div><div className="admin-linked-card__meta"><span>{vacancy.city_name || 'Город не указан'}</span><span>{vacancy.status_name || 'Статус не указан'}</span></div><div className="admin-linked-card__text">{formatSalary(vacancy.salary_min, vacancy.salary_max, vacancy.currency || 'BYN')}</div></button>)}</div> : <div className="admin-empty-inline">У компании пока нет вакансий</div>}</section></div>
    }

    const renderApplicantDetailContent = () => {
      const data = (detailData || {}) as Record<string, unknown>
      const resumes = toArray<Record<string, unknown>>(data.resumes)
      const educations = toArray<Record<string, unknown>>(data.educations)
      const workExperiences = toArray<Record<string, unknown>>(data.work_experiences)
      return <div className="admin-detail-layout"><section className="admin-section"><div className="admin-section__header"><h4>{safeString(data.full_name) || `Соискатель #${safeNumber(data.id) ?? 0}`}</h4></div><div className="admin-summary-grid">{renderSummaryField('Email', <span>{safeString(data.email) || '—'}</span>)}{renderSummaryField('Телефон', <span>{safeString(data.phone) || '—'}</span>)}{renderSummaryField('Город', <span>{safeString(data.city_name) || '—'}</span>)}{renderSummaryField('Пол', <span>{safeString(data.gender) === 'м' ? 'Мужской' : safeString(data.gender) === 'ж' ? 'Женский' : safeString(data.gender) || '—'}</span>)}{renderSummaryField('Дата рождения', <span>{formatDateTime(safeString(data.birth_date) || null)}</span>)}{renderSummaryField('Статус', typeof data.is_active === 'boolean' ? renderPrimitiveBadge(Boolean(data.is_active)) : <span>—</span>)}{renderSummaryField('Резюме', <span>{safeString(data.resumes_count) || '0'}</span>)}{renderSummaryField('Образование', <span>{safeString(data.educations_count) || '0'}</span>)}{renderSummaryField('Отклики', <span>{safeString(data.applications_count) || '0'}</span>)}</div></section><section className="admin-section"><div className="admin-section__header"><h4>Резюме</h4></div>{resumes.length > 0 ? <div className="admin-linked-card-grid">{resumes.map((resume) => <div key={String(resume.id)} className="admin-linked-card admin-linked-card--static"><div className="admin-linked-card__title">{safeString(resume.profession_name) || `Резюме #${safeNumber(resume.id) ?? '—'}`}</div><div className="admin-linked-card__meta"><span>Откликов: {safeString(resume.applications_count) || '0'}</span><span>Опытов работы: {safeString(resume.work_experiences_count) || '0'}</span></div>{toArray<string>(resume.skills).length > 0 ? <div className="admin-chip-list">{toArray<string>(resume.skills).map((skill) => <span key={skill} className="admin-chip">{skill}</span>)}</div> : null}</div>)}</div> : <div className="admin-empty-inline">Резюме не найдены</div>}</section><section className="admin-section"><div className="admin-section__header"><h4>Образование</h4></div>{educations.length > 0 ? <div className="admin-linked-card-grid">{educations.map((education) => <div key={String(education.id)} className="admin-linked-card admin-linked-card--static"><div className="admin-linked-card__title">{safeString(education.institution_name) || `Образование #${safeNumber(education.id) ?? '—'}`}</div><div className="admin-linked-card__meta"><span>{safeString(education.start_date) ? formatDateTime(safeString(education.start_date)) : '—'}</span><span>{safeString(education.end_date) ? formatDateTime(safeString(education.end_date)) : '—'}</span></div></div>)}</div> : <div className="admin-empty-inline">Образование не указано</div>}</section><section className="admin-section"><div className="admin-section__header"><h4>Опыт работы</h4></div>{workExperiences.length > 0 ? <div className="admin-linked-card-grid">{workExperiences.map((item) => <div key={String(item.id)} className="admin-linked-card admin-linked-card--static"><div className="admin-linked-card__title">{safeString(item.position) || 'Опыт работы'}</div><div className="admin-linked-card__meta"><span>{safeString(item.company_name) || 'Компания не указана'}</span><span>{safeString(item.start_date) || '—'} — {safeString(item.end_date) || 'по настоящее время'}</span></div>{safeString(item.description) ? <div className="admin-linked-card__text">{safeString(item.description)}</div> : null}</div>)}</div> : <div className="admin-empty-inline">Опыт работы не указан</div>}</section></div>
    }

  const renderVacancyDetailContent = () => {
    const data = (detailData || {}) as Record<string, unknown>

    const companyId = safeNumber(data.company_id)
    const cityId = safeNumber(data.city_id)
    const professionId = safeNumber(data.profession_id)
    const statusId = safeNumber(data.status_id)

    const companyName =
      safeString(data.company_name) ||
      getNestedName(data.company) ||
      companiesQuery.data?.find((item) => item.id === companyId)?.name ||
      ''

    const cityName =
      safeString(data.city_name) ||
      getNestedName(data.city) ||
      ''

    const professionName =
      safeString(data.profession_name) ||
      getNestedName(data.profession) ||
      (professionId && professionById[professionId] ? professionById[professionId] : '')

    const statusName =
      safeString(data.status_name) ||
      getNestedName(data.status) ||
      ''

    const currency =
      safeString(data.currency) ||
      safeString(data.currency_name) ||
      getNestedName(data.currency) ||
      'BYN'

    const skillNames = getVacancySkillNames(data.skills)

    return (
      <div className="admin-detail-layout">
        <section className="admin-section">
          <div className="admin-section__header">
            <h4>{safeString(data.title) || `Вакансия ID ${safeNumber(data.id) ?? 0}`}</h4>
          </div>

          <div className="admin-summary-grid">
            {renderSummaryField(
              'Компания',
              companyId ? (
                renderEntityButton(companyName || `Компания ID ${companyId}`, () => openCompanyById(companyId))
              ) : (
                <span>{companyName || '—'}</span>
              ),
            )}

            {renderSummaryField('Город', <span>{cityName || (cityId ? `Город ID ${cityId}` : '—')}</span>)}

            {renderSummaryField(
              'Профессия',
              <span>{professionName || (professionId ? `Профессия ID ${professionId}` : '—')}</span>,
            )}

            {renderSummaryField(
              'Статус',
              <span>{statusName || (statusId ? `Статус ID ${statusId}` : '—')}</span>,
            )}

            {renderSummaryField(
              'Зарплата',
              <span>{formatSalary(safeNumber(data.salary_min), safeNumber(data.salary_max), currency)}</span>,
            )}

            {renderSummaryField('Создана', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}
          </div>

          {safeString(data.description) ? (
            <div className="admin-description-box">{safeString(data.description)}</div>
          ) : null}
        </section>

        <section className="admin-section">
          <div className="admin-section__header">
            <h4>Навыки</h4>
          </div>

          {skillNames.length > 0 ? (
            <div className="admin-chip-list">
              {skillNames.map((skill) => (
                <span key={skill} className="admin-chip">{skill}</span>
              ))}
            </div>
          ) : (
            <div className="admin-empty-inline">Навыки не указаны</div>
          )}
        </section>
      </div>
    )
  }
    const renderApplicationDetailContent = () => {
      const data = (detailData || {}) as Record<string, unknown>
      const matchedCompany = findCompanyByName(safeString(data.company_name))
      const matchedApplicant = findApplicantByName(safeString(data.applicant_name))
      return <div className="admin-detail-layout"><section className="admin-section"><div className="admin-section__header"><h4>Информация об отклике</h4></div><div className="admin-summary-grid">{renderSummaryField('Вакансия', safeNumber(data.vacancy_id) ? renderEntityButton(safeString(data.vacancy_title) || `Вакансия #${safeNumber(data.vacancy_id)}`, () => openVacancyById(safeNumber(data.vacancy_id))) : <span>{safeString(data.vacancy_title) || '—'}</span>)}{renderSummaryField('Компания', matchedCompany ? renderEntityButton(matchedCompany.name, () => openCompanyById(matchedCompany.id)) : <span>{safeString(data.company_name) || '—'}</span>)}{renderSummaryField('Соискатель', matchedApplicant ? renderEntityButton(matchedApplicant.full_name, () => openApplicantById(matchedApplicant.id)) : <span>{safeString(data.applicant_name) || '—'}</span>)}{renderSummaryField('Профессия резюме', <span>{safeString(data.resume_profession) || '—'}</span>)}{renderSummaryField('Город', <span>{safeString(data.city_name) || '—'}</span>)}{renderSummaryField('Статус', <span>{statusLabels[safeString(data.status)] || safeString(data.status) || '—'}</span>)}{renderSummaryField('Создан', <span>{formatDateTime(safeString(data.created_at) || null)}</span>)}{renderSummaryField('Обновлён', <span>{formatDateTime(safeString(data.updated_at) || null)}</span>)}{renderSummaryField('Зарплата по вакансии', <span>{formatSalary(safeNumber(data.salary_min), safeNumber(data.salary_max), 'BYN')}</span>)}</div>{safeString(data.cover_letter) ? <div className="admin-description-box">{safeString(data.cover_letter)}</div> : null}</section></div>
    }

    const getDetailTitle = () => {
      if (!detailTarget) return ''

      const data = (detailData || {}) as Record<string, unknown>

      if (detailTarget.kind === 'admin') {
        const email = safeString(data.email) || adminsQuery.data?.find((item) => item.id === detailTarget.id)?.email
        return email ? `Администратор: ${email}` : `Администратор ID ${detailTarget.id}`
      }

      if (detailTarget.kind === 'user') {
        const user = usersQuery.data?.find((item) => item.id === detailTarget.id)
        const email = safeString(data.email) || user?.email
        return email ? `Пользователь: ${email}` : `Пользователь ID ${detailTarget.id}`
      }

      if (detailTarget.kind === 'company') {
        const company = companiesQuery.data?.find((item) => item.id === detailTarget.id)
        const name = safeString(data.name) || company?.name
        return name ? `Компания: ${name}` : `Компания ID ${detailTarget.id}`
      }

      if (detailTarget.kind === 'applicant') {
        const applicant = applicantsQuery.data?.find((item) => item.id === detailTarget.id)
        const name = safeString(data.full_name) || applicant?.full_name
        return name ? `Соискатель: ${name}` : `Соискатель ID ${detailTarget.id}`
      }

      if (detailTarget.kind === 'vacancy') {
        const vacancy = vacanciesQuery.data?.find((item) => item.id === detailTarget.id)
        const title = safeString(data.title) || vacancy?.title
        return title ? `Вакансия: ${title}` : `Вакансия ID ${detailTarget.id}`
      }

      const title = safeString(data.vacancy_title)
      const applicant = safeString(data.applicant_name)
      if (title && applicant) return `Отклик: ${applicant} → ${title}`
      if (title) return `Отклик на вакансию: ${title}`
      return `Отклик: вакансия ${detailTarget.vacancyId}, резюме ${detailTarget.resumeId}`
    }

    const renderDetailModal = () => {
      if (!detailTarget) return null

      return (
        <Modal title={getDetailTitle()} subtitle="Подробная информация по выбранной сущности." onClose={closeDetail}>
          {detailLoading ? (
            <div className="admin-empty-inline">Загрузка...</div>
          ) : !detailData ? (
            <div className="admin-empty-inline">Не удалось загрузить данные.</div>
          ) : detailTarget.kind === 'admin' ? (
            renderAdminDetailContent()
          ) : detailTarget.kind === 'user' ? (
            renderUserDetailContent()
          ) : detailTarget.kind === 'company' ? (
            renderCompanyDetailContent()
          ) : detailTarget.kind === 'applicant' ? (
            renderApplicantDetailContent()
          ) : detailTarget.kind === 'vacancy' ? (
            renderVacancyDetailContent()
          ) : (
            renderApplicationDetailContent()
          )}
        </Modal>
      )
    }

    const renderDashboard = () => (
      <div className="admin-panel">
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <span>Пользователи</span>
            <strong title={String(dashboard.users_total ?? 0)}>{formatCompactNumber(dashboard.users_total)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Активные</span>
            <strong title={String(dashboard.users_active ?? 0)}>{formatCompactNumber(dashboard.users_active)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Компании</span>
            <strong title={String(dashboard.companies_total ?? 0)}>{formatCompactNumber(dashboard.companies_total)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Соискатели</span>
            <strong title={String(dashboard.applicants_total ?? 0)}>{formatCompactNumber(dashboard.applicants_total)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Вакансии</span>
            <strong title={String(dashboard.vacancies_total ?? 0)}>{formatCompactNumber(dashboard.vacancies_total)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Отклики</span>
            <strong title={String(dashboard.applications_total ?? 0)}>{formatCompactNumber(dashboard.applications_total)}</strong>
          </div>
        </div>

        <div className="admin-analytics-shell">
          <div className="admin-analytics-sidebar">
            <div className="admin-analytics-sidebar__title">Выбор графика</div>
            {dashboardCharts.map((item) => (
              <button
                key={item.value}
                type="button"
                className={dashboardChart === item.value ? 'is-active' : ''}
                onClick={() => setDashboardChart(item.value)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <div className="admin-analytics-main">
            <div className="admin-analytics-toolbar">
              <div>
                <h3>{dashboardChartMeta.label}</h3>
                <p>{dashboardChartMeta.description}</p>
              </div>

              <div className="admin-analytics-actions">
                {dashboardChart === 'top-professions' ? (
                  <div className="admin-source-tabs" aria-label="Источник профессий">
                    <button
                      type="button"
                      className={professionChartSource === 'vacancies' ? 'is-active' : ''}
                      onClick={() => setProfessionChartSource('vacancies')}
                    >
                      Работодатели
                    </button>
                    <button
                      type="button"
                      className={professionChartSource === 'resumes' ? 'is-active' : ''}
                      onClick={() => setProfessionChartSource('resumes')}
                    >
                      Соискатели
                    </button>
                  </div>
                ) : null}

                <div className="admin-period-tabs">
                  {dashboardPeriods.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={dashboardPeriod === item.value ? 'is-active' : ''}
                      onClick={() => setDashboardPeriod(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ChartBlock
              title={dashboardChartMeta.label}
              subtitle={dashboardChartMeta.description}
              points={dashboardChartPoints}
              variant={dashboardChartVariant}
            />
          </div>
        </div>
      </div>
    )

    const renderCatalogs = () => {
    const items = getPageItems(filteredCatalogItems, pages.catalogs)
    const regions = regionsCatalogQuery.data || []
    const districts = districtsCatalogQuery.data || []
    const settlementTypes = settlementTypesCatalogQuery.data || []
    const selectedCatalogDefinition = catalogDefinitions.find((item) => item.key === selectedCatalog)

    const createCatalogClassName = [
      'admin-catalog-create',
      selectedCatalog === 'districts' ? 'admin-catalog-create--districts' : '',
      selectedCatalog === 'cities' ? 'admin-catalog-create--cities' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const getEditFieldsClassName = () => {
      return [
        'admin-catalog-edit-fields',
        selectedCatalog === 'districts' ? 'admin-catalog-edit-fields--districts' : '',
        selectedCatalog === 'cities' ? 'admin-catalog-edit-fields--cities' : '',
      ]
        .filter(Boolean)
        .join(' ')
    }

    const openCatalogEdit = (item: CatalogItem) => {
      setEditingCatalogId(item.id)
      setEditingCatalogName(item.name)
      setEditingCatalogRegionId(item.region_id ? String(item.region_id) : '')
      setEditingCatalogDistrictId(item.district_id ? String(item.district_id) : '')
      setEditingCatalogSettlementTypeId(item.settlement_type_id ? String(item.settlement_type_id) : '')
    }

    const renderCatalogParentFields = (mode: 'create' | 'edit') => {
      const isEdit = mode === 'edit'

      const regionId = isEdit ? editingCatalogRegionId : newCatalogRegionId
      const districtId = isEdit ? editingCatalogDistrictId : newCatalogDistrictId
      const settlementTypeId = isEdit ? editingCatalogSettlementTypeId : newCatalogSettlementTypeId

      const setRegionId = isEdit ? setEditingCatalogRegionId : setNewCatalogRegionId
      const setDistrictId = isEdit ? setEditingCatalogDistrictId : setNewCatalogDistrictId
      const setSettlementTypeId = isEdit ? setEditingCatalogSettlementTypeId : setNewCatalogSettlementTypeId

      if (selectedCatalog === 'districts') {
        return (
          <AdminSelect
            className="admin-custom-select--catalog"
            value={regionId}
            onChange={setRegionId}
            placeholder="Выберите область"
          >
            <option value="">Выберите область</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </AdminSelect>
        )
      }

      if (selectedCatalog === 'cities') {
        const filteredDistricts = regionId
          ? districts.filter((district) => String(district.region_id || '') === String(regionId))
          : districts

        return (
          <>
            <AdminSelect
              className="admin-custom-select--catalog"
              value={regionId}
              onChange={(value) => {
                setRegionId(value)
                setDistrictId('')
              }}
              placeholder="Выберите область"
            >
              <option value="">Выберите область</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </AdminSelect>

            <AdminSelect
              className="admin-custom-select--catalog"
              value={districtId}
              onChange={setDistrictId}
              placeholder={regionId ? 'Выберите район' : 'Сначала выберите область'}
              disabled={!regionId}
            >
              <option value="">{regionId ? 'Выберите район' : 'Сначала выберите область'}</option>
              {filteredDistricts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </AdminSelect>

            <AdminSelect
              className="admin-custom-select--catalog"
              value={settlementTypeId}
              onChange={setSettlementTypeId}
              placeholder="Выберите тип"
            >
              <option value="">Выберите тип</option>
              {settlementTypes.map((settlementType) => (
                <option key={settlementType.id} value={settlementType.id}>
                  {settlementType.name}
                </option>
              ))}
            </AdminSelect>
          </>
        )
      }

      return null
    }

    return (
      <div className="admin-panel">
        <div className="admin-card">
          <div className="admin-card__header admin-card__header--stacked">
            <div>
              <h3>Справочники</h3>
              <p>Выберите справочник, найдите нужный элемент или добавьте новый.</p>
            </div>

            <div className="admin-catalog-layout">
              <aside className="admin-catalog-menu">
                <div className="admin-catalog-menu__title">Тип справочника</div>

                {catalogDefinitions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={selectedCatalog === item.key ? 'is-active' : ''}
                    onClick={() => {
                      setSelectedCatalog(item.key)
                      resetCatalogDrafts()
                      setCatalogSearch('')
                      resetPage('catalogs')
                    }}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </aside>

              <div className="admin-catalog-content">
                <div className="admin-catalog-content__header">
                  <div>
                    <span>Текущий справочник</span>
                    <strong>{selectedCatalogDefinition?.label || selectedCatalogLabel}</strong>
                  </div>

                  <div className="admin-catalog-count">
                    {filteredCatalogItems.length} элементов
                  </div>
                </div>

                <div className="admin-catalog-tools">
                  <SearchBox
                    value={catalogSearch}
                    onChange={(value) => {
                      setCatalogSearch(value)
                      resetPage('catalogs')
                    }}
                    placeholder={`Поиск: ${selectedCatalogLabel}`}
                  />

                  <div className={createCatalogClassName}>
                    <input
                      value={newCatalogName}
                      onChange={(event) => setNewCatalogName(event.target.value)}
                      placeholder={
                        selectedCatalog === 'cities'
                          ? 'Название города'
                          : selectedCatalog === 'districts'
                            ? 'Название района'
                            : 'Название нового элемента'
                      }
                    />

                    {renderCatalogParentFields('create')}

                    <button
                      type="button"
                      className="admin-primary-btn"
                      onClick={() => createCatalogItemMutation.mutate()}
                      disabled={createCatalogItemMutation.isPending || !canSubmitCreateCatalog()}
                    >
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="admin-stack">
                  {items.map((item) => {
                    const meta = getCatalogMeta(item, selectedCatalog)

                    return (
                      <div key={item.id} className="admin-list-row">
                        {editingCatalogId === item.id ? (
                          <>
                            <div className={getEditFieldsClassName()}>
                              <input
                                className="admin-input"
                                value={editingCatalogName}
                                onChange={(event) => setEditingCatalogName(event.target.value)}
                                placeholder={
                                  selectedCatalog === 'cities'
                                    ? 'Название города'
                                    : selectedCatalog === 'districts'
                                      ? 'Название района'
                                      : 'Название элемента'
                                }
                              />

                              {renderCatalogParentFields('edit')}
                            </div>

                            <div className="admin-actions-row">
                              <button
                                type="button"
                                className="admin-primary-btn"
                                onClick={() => updateCatalogItemMutation.mutate(item.id)}
                                disabled={updateCatalogItemMutation.isPending || !canSubmitUpdateCatalog()}
                              >
                                Сохранить
                              </button>

                              <button
                                type="button"
                                className="admin-ghost-btn"
                                onClick={resetCatalogDrafts}
                              >
                                Отмена
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <strong>{getCatalogDisplayName(item)}</strong>
                              <p>ID: {item.id}{meta ? ` • ${meta}` : ''}</p>
                            </div>

                            <div className="admin-actions-row">
                              <button
                                type="button"
                                className="admin-action-btn"
                                onClick={() => openCatalogEdit(item)}
                              >
                                Редактировать
                              </button>

                              <button
                                type="button"
                                className="admin-danger-btn"
                                onClick={() =>
                                  deleteCatalogItemMutation.mutate({
                                    item,
                                    catalog: selectedCatalog,
                                  })
                                }
                                disabled={deleteCatalogItemMutation.isPending}
                              >
                                Удалить
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}

                  {!selectedCatalogQuery.isLoading && !items.length && (
                    <div className="admin-empty-inline">
                      Ничего не найдено.
                    </div>
                  )}

                  {selectedCatalogQuery.isLoading && (
                    <div className="admin-empty-inline">
                      Загрузка справочника...
                    </div>
                  )}
                </div>

                <Pagination
                  page={pages.catalogs}
                  total={filteredCatalogItems.length}
                  pageSize={PAGE_SIZE}
                  onChange={(page) => setPage('catalogs', page)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

    const renderAdmins = () => {
      const items = getPageItems(filteredAdmins, pages.admins)

      return (
        <div className="admin-panel admin-panel--admins">
          <div className="admin-card admin-card--table">
            <div className="admin-card__header admin-card__header--stacked">
              <div>
                <h3>Администраторы</h3>
                <p>Список служебных аккаунтов панели управления.</p>
              </div>

              <FilterPanel>
                <SearchBox
                  value={search}
                  onChange={(value) => {
                    setSearch(value)
                    resetPage('admins')
                  }}
                  placeholder="Найти по email или ID"
                />

                <FilterSelect
                  label="Статус"
                  value={adminStatusFilter}
                  onChange={(value) => {
                    setAdminStatusFilter(value as CommonStatusFilter)
                    resetPage('admins')
                  }}
                >
                  <option value="all">Все статусы</option>
                  <option value="active">Активные</option>
                  <option value="blocked">Заблокированные</option>
                </FilterSelect>

                <button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>
                  Сбросить
                </button>

                {isRootAdmin ? (
                  <button type="button" className="admin-primary-btn" onClick={openCreateAdminModal}>
                    Создать администратора
                  </button>
                ) : null}
              </FilterPanel>
            </div>

            <div className="admin-table-card">
              <div className="admin-table-card__head admin-table-card__head--admins">
                <span>Email</span>
                <span>Статус</span>
                <span>Создан</span>
                <span>Обновлён</span>
                <span>Действия</span>
              </div>

              <div className="admin-table-card__body">
                {items.map((admin) => {
                  const isMainAdmin = admin.id === 1

                  return (
                    <div key={admin.id} className="admin-table-row admin-table-row--admins">
                      <div className="admin-table-row__main">
                        <strong>{admin.email}</strong>
                        <span>ID: {admin.id}{isMainAdmin ? ' • главный аккаунт' : ''}</span>
                      </div>

                      <div>{renderPrimitiveBadge(admin.is_active)}</div>
                      <div className="admin-muted-value">{formatDateTime(admin.created_at)}</div>
                      <div className="admin-muted-value">{formatDateTime(admin.updated_at)}</div>

                      <div className="admin-actions-row">
                        {isRootAdmin ? (
                          <>
                            <button
                              type="button"
                              className="admin-action-btn"
                              onClick={() => {
                                setFormError('')
                                setEditingAdmin(admin)
                                setEditAdminEmail(admin.email)
                                setEditAdminPassword('')
                                setEditAdminIsActive(admin.id === 1 ? true : admin.is_active)
                                setEditAdminCurrentPassword('')
                              }}
                            >
                              Редактировать
                            </button>

                            <button
                              type="button"
                              className="admin-danger-btn"
                              onClick={() => {
                                if (isMainAdmin) {
                                  const text = 'Главного администратора нельзя удалить.'
                                  setFormError(text)
                                  setMessage(text)
                                  return
                                }

                                setFormError('')
                                setDeletingAdmin(admin)
                                setDeleteAdminCurrentPassword('')
                              }}
                              disabled={isMainAdmin}
                              title={isMainAdmin ? 'Главного администратора нельзя удалить' : undefined}
                            >
                              Удалить
                            </button>
                          </>
                        ) : (
                          <span className="admin-muted-value">Только просмотр</span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {filteredAdmins.length === 0 ? (
                  <div className="admin-empty-inline">Администраторы не найдены</div>
                ) : null}
              </div>
            </div>

            <Pagination page={pages.admins} total={filteredAdmins.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('admins', page)} />
          </div>
        </div>
      )
    }

    const renderUsers = () => {
      const items = getPageItems(filteredUsers, pages.users)

      return (
        <div className="admin-panel">
          <div className="admin-card">
            <div className="admin-card__header admin-card__header--stacked">
              <h3>Пользователи</h3>
              <FilterPanel>
                <SearchBox value={search} onChange={(value) => { setSearch(value); resetPage('users') }} placeholder="Email, роль или ID" />
                <FilterSelect label="Роль" value={userRoleFilter} onChange={(value) => { setUserRoleFilter(value as UserRoleFilter); resetPage('users') }}>
                  <option value="all">Все</option>
                  <option value="admin">Администраторы</option>
                  <option value="company">Работодатели</option>
                  <option value="applicant">Соискатели</option>
                </FilterSelect>
                <FilterSelect label="Статус" value={userStatusFilter} onChange={(value) => { setUserStatusFilter(value as CommonStatusFilter); resetPage('users') }}>
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="blocked">Заблокированные</option>
                </FilterSelect>
                <button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>Сбросить</button>
              </FilterPanel>
            </div>

            <div className="admin-stack">
              {items.map((user) => {
                const isMainAdmin = user.id === 1

                return (
                  <div key={user.id} className="admin-list-row">
                    <div>
                      <strong>{user.email}</strong>
                      <p>{isMainAdmin ? 'Главный администратор' : getUserLabel(user)} • ID: {user.id} • {user.is_active ? 'Активен' : 'Заблокирован'}</p>
                    </div>

                    <div className="admin-actions-row">
                      <button type="button" className="admin-action-btn" onClick={() => openDetail({ kind: 'user', id: user.id })}>Подробнее</button>
                      <button
                        type="button"
                        className={user.is_active ? 'admin-danger-btn' : 'admin-primary-btn'}
                        onClick={() => toggleUserMutation.mutate(user)}
                        disabled={toggleUserMutation.isPending || isMainAdmin}
                        title={isMainAdmin ? 'Главного администратора нельзя заблокировать' : undefined}
                      >
                        {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredUsers.length === 0 ? <div className="admin-empty-inline">Нет пользователей</div> : null}
            </div>

            <Pagination page={pages.users} total={filteredUsers.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('users', page)} />
          </div>
        </div>
      )
    }

    const renderCompanies = () => { const items = getPageItems(filteredCompanies, pages.companies); return <div className="admin-panel"><div className="admin-card"><div className="admin-card__header admin-card__header--stacked"><h3>Компании</h3><FilterPanel><SearchBox value={search} onChange={(value) => { setSearch(value); resetPage('companies') }} placeholder="Название, email, сайт или ID" /><FilterSelect label="Статус" value={companyStatusFilter} onChange={(value) => { setCompanyStatusFilter(value as CommonStatusFilter); resetPage('companies') }}><option value="all">Все</option><option value="active">Активные</option><option value="blocked">Заблокированные</option></FilterSelect><FilterSelect label="Город" value={companyCityFilter} onChange={(value) => { setCompanyCityFilter(value); resetPage('companies') }}><option value="all">Все</option>{companyCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</FilterSelect><FilterSelect label="Тип" value={companyTypeFilter} onChange={(value) => { setCompanyTypeFilter(value); resetPage('companies') }}><option value="all">Все</option>{companyTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</FilterSelect><button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>Сбросить</button></FilterPanel></div><div className="admin-stack">{items.map((company) => <div key={company.id} className="admin-list-row"><div><strong>{company.name}</strong><p>ID: {company.id} • {company.is_active ? 'Активна' : 'Заблокирована'}{company.website ? ` • ${company.website}` : ''}</p></div><div className="admin-actions-row"><button type="button" className="admin-action-btn" onClick={() => openDetail({ kind: 'company', id: company.id })}>Подробнее</button><button type="button" className={company.is_active ? 'admin-danger-btn' : 'admin-primary-btn'} onClick={() => toggleCompanyMutation.mutate(company)} disabled={toggleCompanyMutation.isPending}>{company.is_active ? 'Заблокировать' : 'Разблокировать'}</button></div></div>)}{filteredCompanies.length === 0 ? <div className="admin-empty-inline">Нет компаний</div> : null}</div><Pagination page={pages.companies} total={filteredCompanies.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('companies', page)} /></div></div> }

    const renderApplicants = () => { const items = getPageItems(filteredApplicants, pages.applicants); return <div className="admin-panel"><div className="admin-card"><div className="admin-card__header admin-card__header--stacked"><h3>Соискатели</h3><FilterPanel><SearchBox value={search} onChange={(value) => { setSearch(value); resetPage('applicants') }} placeholder="Имя, телефон, email или ID" /><FilterSelect label="Статус" value={applicantStatusFilter} onChange={(value) => { setApplicantStatusFilter(value as CommonStatusFilter); resetPage('applicants') }}><option value="all">Все</option><option value="active">Активные</option><option value="blocked">Заблокированные</option></FilterSelect><FilterSelect label="Город" value={applicantCityFilter} onChange={(value) => { setApplicantCityFilter(value); resetPage('applicants') }}><option value="all">Все</option>{applicantCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</FilterSelect><FilterSelect label="Резюме" value={applicantResumeFilter} onChange={(value) => { setApplicantResumeFilter(value as ResumeFilter); resetPage('applicants') }}><option value="all">Все</option><option value="has-resumes">Есть резюме</option><option value="no-resumes">Без резюме</option></FilterSelect><button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>Сбросить</button></FilterPanel></div><div className="admin-stack">{items.map((applicant) => <div key={applicant.id} className="admin-list-row"><div><strong>{applicant.full_name}</strong><p>ID: {applicant.id} • {applicant.phone || 'Телефон не указан'} • {applicant.is_active ? 'Активен' : 'Заблокирован'}</p></div><div className="admin-actions-row"><button type="button" className="admin-action-btn" onClick={() => openDetail({ kind: 'applicant', id: applicant.id })}>Подробнее</button><button type="button" className={applicant.is_active ? 'admin-danger-btn' : 'admin-primary-btn'} onClick={() => toggleApplicantMutation.mutate(applicant)} disabled={toggleApplicantMutation.isPending}>{applicant.is_active ? 'Заблокировать' : 'Разблокировать'}</button></div></div>)}{filteredApplicants.length === 0 ? <div className="admin-empty-inline">Нет соискателей</div> : null}</div><Pagination page={pages.applicants} total={filteredApplicants.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('applicants', page)} /></div></div> }

    const renderVacancies = () => { const items = getPageItems(filteredVacancies, pages.vacancies); return <div className="admin-panel"><div className="admin-card"><div className="admin-card__header admin-card__header--stacked"><h3>Вакансии</h3><FilterPanel><SearchBox value={search} onChange={(value) => { setSearch(value); resetPage('vacancies') }} placeholder="Название, компания, описание или ID" /><FilterSelect label="Статус" value={vacancyStatusFilter} onChange={(value) => { setVacancyStatusFilter(value); resetPage('vacancies') }}><option value="all">Все</option>{vacancyStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</FilterSelect><FilterSelect label="Город" value={vacancyCityFilter} onChange={(value) => { setVacancyCityFilter(value); resetPage('vacancies') }}><option value="all">Все</option>{vacancyCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</FilterSelect><FilterSelect label="Профессия" value={vacancyProfessionFilter} onChange={(value) => { setVacancyProfessionFilter(value); resetPage('vacancies') }}><option value="all">Все</option>{vacancyProfessionOptions.map((profession) => <option key={profession} value={profession}>{profession}</option>)}</FilterSelect><FilterSelect label="Зарплата" value={vacancySalaryFilter} onChange={(value) => { setVacancySalaryFilter(value as SalaryFilter); resetPage('vacancies') }}><option value="all">Любая</option><option value="with-salary">Указана</option><option value="no-salary">Не указана</option></FilterSelect><button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>Сбросить</button></FilterPanel></div><div className="admin-stack">{items.map((vacancy) => <div key={vacancy.id} className="admin-list-row"><div><strong>{vacancy.title}</strong><p>ID: {vacancy.id} • {vacancy.company_name || companiesQuery.data?.find((company) => company.id === vacancy.company_id)?.name || `Компания ID ${vacancy.company_id ?? '—'}`} • {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancy.currency || 'BYN')}</p></div><div className="admin-actions-row"><AdminSelect
                    className="admin-select--compact"
                    value={vacancy.status_id ?? ''}
                    onChange={(value) => updateVacancyStatusMutation.mutate({ vacancyId: vacancy.id, statusId: Number(value) })}
                    placeholder="Статус"
                  >
                    <option value="" disabled>Статус</option>
                    {statusesQuery.data?.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
                  </AdminSelect><button type="button" className="admin-action-btn" onClick={() => openDetail({ kind: 'vacancy', id: vacancy.id })}>Подробнее</button></div></div>)}{filteredVacancies.length === 0 ? <div className="admin-empty-inline">Нет вакансий</div> : null}</div><Pagination page={pages.vacancies} total={filteredVacancies.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('vacancies', page)} /></div></div> }

    const renderApplications = () => {
      const items = getPageItems(filteredApplications, pages.applications)

      return (
        <div className="admin-panel admin-panel--applications">
          <div className="admin-card admin-card--table">
            <div className="admin-card__header admin-card__header--stacked">
              <div>
                <h3>Отклики</h3>
                <p>Контроль заявок соискателей: вакансия, кандидат, резюме, статус и дата отправки.</p>
              </div>

              <FilterPanel>
                <SearchBox
                  value={search}
                  onChange={(value) => {
                    setSearch(value)
                    resetPage('applications')
                  }}
                  placeholder="Вакансия, компания, кандидат, резюме или ID"
                />

                <FilterSelect
                  label="Статус"
                  value={applicationStatusFilter}
                  onChange={(value) => {
                    setApplicationStatusFilter(value)
                    resetPage('applications')
                  }}
                >
                  <option value="all">Все статусы</option>
                  {applicationStatusOptions.map((status) => (
                    <option key={status} value={status}>{statusLabels[status] || status}</option>
                  ))}
                </FilterSelect>

                <FilterSelect
                  label="Компания"
                  value={applicationCompanyFilter}
                  onChange={(value) => {
                    setApplicationCompanyFilter(value)
                    resetPage('applications')
                  }}
                >
                  <option value="all">Все компании</option>
                  {applicationCompanyOptions.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </FilterSelect>

                <button type="button" className="admin-ghost-btn" onClick={resetCurrentFilters}>
                  Сбросить
                </button>
              </FilterPanel>
            </div>

            {applicationsQuery.isLoading ? (
              <div className="admin-empty-inline">Загружаем отклики...</div>
            ) : null}

            {applicationsQuery.isError ? (
              <div className="admin-error-box">Не удалось загрузить отклики. Проверь backend endpoint /admin/applications.</div>
            ) : null}

            <div className="admin-table-card">
              <div className="admin-table-card__head admin-table-card__head--applications">
                <span>Отклик</span>
                <span>Кандидат</span>
                <span>Компания</span>
                <span>Статус</span>
                <span>Дата</span>
                <span>Действия</span>
              </div>

              <div className="admin-table-card__body">
                {items.map((item) => (
                  <div key={`${item.vacancy_id}-${item.resume_id}`} className="admin-table-row admin-table-row--applications">
                    <div className="admin-table-row__main">
                      <strong>{item.vacancy_title || `Вакансия #${item.vacancy_id}`}</strong>
                      <span>{item.resume_profession || `Резюме #${item.resume_id}`}</span>
                    </div>

                    <div className="admin-muted-value">{item.applicant_name || 'Кандидат не указан'}</div>
                    <div className="admin-muted-value">{item.company_name || 'Компания не указана'}</div>

                    <AdminSelect
                      className="admin-select--compact admin-select--status"
                      value={item.status}
                      onChange={(value) => updateApplicationStatusMutation.mutate({
                        vacancyId: item.vacancy_id,
                        resumeId: item.resume_id,
                        status: value,
                      })}
                      placeholder="Статус"
                    >
                      <option value="pending">На рассмотрении</option>
                      <option value="accepted">Принят</option>
                      <option value="rejected">Отклонён</option>
                    </AdminSelect>

                    <div className="admin-muted-value">{formatDateTime(item.created_at)}</div>

                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => openDetail({ kind: 'application', vacancyId: item.vacancy_id, resumeId: item.resume_id })}
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                ))}

                {!applicationsQuery.isLoading && filteredApplications.length === 0 ? (
                  <div className="admin-empty-state">
                    <strong>Отклики не найдены</strong>
                    <span>Проверь фильтры или наличие заявок в базе данных.</span>
                  </div>
                ) : null}
              </div>
            </div>

            <Pagination page={pages.applications} total={filteredApplications.length} pageSize={PAGE_SIZE} onChange={(page) => setPage('applications', page)} />
          </div>
        </div>
      )
    }

    const tabContent: Record<TabKey, JSX.Element> = { dashboard: renderDashboard(), catalogs: renderCatalogs(), admins: renderAdmins(), users: renderUsers(), companies: renderCompanies(), applicants: renderApplicants(), vacancies: renderVacancies(), applications: renderApplications() }

    return (
      <div className="admin-dashboard">
        <aside className="admin-sidebar">
          <div className="admin-sidebar__nav">
            <button type="button" className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => resetSearchAndFilters('dashboard')}>Обзор</button>
            <button type="button" className={activeTab === 'catalogs' ? 'active' : ''} onClick={() => resetSearchAndFilters('catalogs')}>Справочники</button>
            <button type="button" className={activeTab === 'admins' ? 'active' : ''} onClick={() => resetSearchAndFilters('admins')}>Администраторы</button>
            <button type="button" className={activeTab === 'users' ? 'active' : ''} onClick={() => resetSearchAndFilters('users')}>Пользователи</button>
            <button type="button" className={activeTab === 'companies' ? 'active' : ''} onClick={() => resetSearchAndFilters('companies')}>Компании</button>
            <button type="button" className={activeTab === 'applicants' ? 'active' : ''} onClick={() => resetSearchAndFilters('applicants')}>Соискатели</button>
            <button type="button" className={activeTab === 'vacancies' ? 'active' : ''} onClick={() => resetSearchAndFilters('vacancies')}>Вакансии</button>
            <button type="button" className={activeTab === 'applications' ? 'active' : ''} onClick={() => resetSearchAndFilters('applications')}>Отклики</button>
          </div>
          <div className="admin-sidebar__footer">
            <div className="admin-sidebar__current-user">
              <span>Текущий админ</span>
              <strong>{authMeQuery.data?.email ? maskEmail(authMeQuery.data.email) : '—'}</strong>
              {isRootAdmin ? <em>Главный администратор</em> : null}
            </div>
            <button
              type="button"
              className="admin-sidebar__settings"
              onClick={() => {
                setFormError('')
                setSelfEmail(authMeQuery.data?.email || '')
                setSelfNewPassword('')
                setSelfCurrentPassword('')
                setIsSelfSettingsOpen(true)
              }}
            >
              Изменить свои данные
            </button>
            <button type="button" className="admin-sidebar__danger" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-main__topbar">
            <div className="admin-main__eyebrow">Администрирование</div>
            <h2>
              {activeTab === 'dashboard' && 'Обзор платформы'}
              {activeTab === 'catalogs' && 'Управление справочниками'}
              {activeTab === 'admins' && 'Управление администраторами'}
              {activeTab === 'users' && 'Управление пользователями'}
              {activeTab === 'companies' && 'Управление компаниями'}
              {activeTab === 'applicants' && 'Управление соискателями'}
              {activeTab === 'vacancies' && 'Управление вакансиями'}
              {activeTab === 'applications' && 'Управление откликами'}
            </h2>
            <p>{message}</p>
          </div>
          <section className="admin-content">{tabContent[activeTab]}</section>
        </main>

        {renderDetailModal()}

        {isCreateAdminOpen ? (
          <Modal
            title="Создание администратора"
            subtitle="Новый пользователь сразу получит роль администратора. Доступно только главному админу."
            onClose={closeCreateAdminModal}
          >
            <InlineAlert>{formError}</InlineAlert>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Email</span>
                <input
                  className="admin-input"
                  type="email"
                  value={newAdminEmail}
                  onChange={(event) => { setNewAdminEmail(event.target.value); setFormError('') }}
                  placeholder="admin@jobfinder.by"
                  autoComplete="email"
                />
                <FieldHint variant={newAdminEmail && getEmailError(newAdminEmail) ? 'danger' : 'muted'}>
                  {newAdminEmail && getEmailError(newAdminEmail) ? getEmailError(newAdminEmail) : 'Формат: name@example.com. Почта должна быть уникальной.'}
                </FieldHint>
              </label>
              <PasswordInput
                label="Пароль"
                value={newAdminPassword}
                onChange={(value) => { setNewAdminPassword(value); setFormError('') }}
                placeholder="Минимум 8 символов"
                helper="Минимум 8 символов. Лучше использовать буквы, цифры и спецсимволы."
                error={newAdminPassword ? getRequiredPasswordError(newAdminPassword) : ''}
              />
            </div>
            <div className="admin-modal__footer">
              <button type="button" className="admin-ghost-btn" onClick={closeCreateAdminModal}>Отмена</button>
              <button
                type="button"
                className="admin-primary-btn"
                onClick={handleCreateAdmin}
                disabled={createAdminMutation.isPending || !isRootAdmin}
              >
                {createAdminMutation.isPending ? 'Создаём...' : 'Создать'}
              </button>
            </div>
          </Modal>
        ) : null}

        {editingAdmin ? (
          <Modal
            title={`Редактирование администратора: ${editingAdmin.email}`}
            subtitle="Для сохранения изменений требуется пароль текущего главного администратора."
            onClose={closeEditAdminModal}
          >
            <InlineAlert>{formError}</InlineAlert>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Email</span>
                <input
                  className="admin-input"
                  type="email"
                  value={editAdminEmail}
                  onChange={(event) => { setEditAdminEmail(event.target.value); setFormError('') }}
                  placeholder="admin@jobfinder.by"
                  autoComplete="email"
                />
                <FieldHint variant={editAdminEmail && getEmailError(editAdminEmail) ? 'danger' : 'muted'}>
                  {editAdminEmail && getEmailError(editAdminEmail) ? getEmailError(editAdminEmail) : 'Формат: name@example.com.'}
                </FieldHint>
              </label>
              <PasswordInput
                label="Новый пароль"
                value={editAdminPassword}
                onChange={(value) => { setEditAdminPassword(value); setFormError('') }}
                placeholder="Оставь пустым, если не меняешь"
                helper="Оставь пустым, если пароль менять не нужно."
                error={editAdminPassword ? getOptionalPasswordError(editAdminPassword) : ''}
              />
              <PasswordInput
                label="Пароль текущего администратора"
                value={editAdminCurrentPassword}
                onChange={(value) => { setEditAdminCurrentPassword(value); setFormError('') }}
                placeholder="Подтверждение действия"
                helper="Нужен для защиты изменения данных администратора."
                className="admin-field--full"
              />
              <label className="admin-checkbox admin-field--full">
                <input
                  type="checkbox"
                  checked={editingAdmin.id === 1 ? true : editAdminIsActive}
                  onChange={(event) => setEditAdminIsActive(event.target.checked)}
                  disabled={editingAdmin.id === 1}
                />
                <span>{editingAdmin.id === 1 ? 'Главный администратор всегда активен' : 'Администратор активен'}</span>
              </label>
            </div>
            <div className="admin-modal__footer">
              <button type="button" className="admin-ghost-btn" onClick={closeEditAdminModal}>Отмена</button>
              <button
                type="button"
                className="admin-primary-btn"
                onClick={() => handleUpdateAdmin(editingAdmin)}
                disabled={updateAdminMutation.isPending || !isRootAdmin}
              >
                {updateAdminMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </Modal>
        ) : null}

        {deletingAdmin ? (
          <Modal
            title={`Удаление администратора: ${deletingAdmin.email}`}
            subtitle="Удаление необратимо. Для подтверждения введи пароль текущего главного администратора."
            onClose={closeDeleteAdminModal}
          >
            <InlineAlert>{formError}</InlineAlert>
            <div className="admin-warning-box">
              Будет удалён администратор <strong>{deletingAdmin.email}</strong>.
            </div>
            <PasswordInput
              label="Пароль текущего администратора"
              value={deleteAdminCurrentPassword}
              onChange={(value) => { setDeleteAdminCurrentPassword(value); setFormError('') }}
              placeholder="Подтверждение действия"
              helper="Введите пароль главного администратора, чтобы подтвердить удаление."
            />
            <div className="admin-modal__footer">
              <button type="button" className="admin-ghost-btn" onClick={closeDeleteAdminModal}>Отмена</button>
              <button
                type="button"
                className="admin-danger-btn"
                onClick={() => handleDeleteAdmin(deletingAdmin)}
                disabled={deleteAdminMutation.isPending || deletingAdmin.id === 1 || !isRootAdmin}
              >
                {deleteAdminMutation.isPending ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </Modal>
        ) : null}

        {pendingCatalogDelete?.conflict ? (
          <Modal
            title="Подтвердите удаление"
            subtitle="Элемент справочника используется в связанных данных."
            onClose={() => {
              if (!deleteCatalogItemMutation.isPending) {
                setPendingCatalogDelete(null)
              }
            }}
          >
            <div className="admin-delete-confirm">
              <div className="admin-delete-confirm__warning">
                Вы хотите удалить элемент справочника{' '}
                <strong>
                  «{pendingCatalogDelete.conflict.item_name || getCatalogDisplayName(pendingCatalogDelete.item)}»
                </strong>
                . Он используется в системе. При подтверждении связанные данные будут удалены или отвязаны.
              </div>

              {pendingCatalogDelete.conflict.usages ? (
                <div className="admin-delete-confirm__list">
                  {Object.entries(pendingCatalogDelete.conflict.usages).map(([name, count]) => (
                    <div key={name} className="admin-delete-confirm__item">
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {pendingCatalogDelete.conflict.message ? (
                <div className="admin-delete-confirm__note">
                  {pendingCatalogDelete.conflict.message}
                </div>
              ) : null}

              <div className="admin-delete-confirm__danger">
                Действие необратимо. При удалении связанных справочников могут быть удалены города,
                вакансии, отклики, чаты, избранные вакансии и связи компаний. У соискателей город будет очищен.
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  className="admin-ghost-btn"
                  onClick={() => setPendingCatalogDelete(null)}
                  disabled={deleteCatalogItemMutation.isPending}
                >
                  Отмена
                </button>

                <button
                  type="button"
                  className="admin-danger-btn"
                  onClick={() =>
                    deleteCatalogItemMutation.mutate({
                      item: pendingCatalogDelete.item,
                      catalog: pendingCatalogDelete.catalog,
                      force: true,
                    })
                  }
                  disabled={deleteCatalogItemMutation.isPending}
                >
                  {deleteCatalogItemMutation.isPending ? 'Удаляем...' : 'Удалить всё связанное'}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {isSelfSettingsOpen ? (
          <Modal title="Мои данные" subtitle="Здесь можно изменить свой email и пароль." onClose={closeSelfSettingsModal}>
            <InlineAlert>{formError}</InlineAlert>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Новый email</span>
                <input
                  className="admin-input"
                  type="email"
                  value={selfEmail}
                  onChange={(event) => { setSelfEmail(event.target.value); setFormError('') }}
                  placeholder="admin@jobfinder.by"
                  autoComplete="email"
                />
                <FieldHint variant={selfEmail && getEmailError(selfEmail) ? 'danger' : 'muted'}>
                  {selfEmail && getEmailError(selfEmail) ? getEmailError(selfEmail) : 'Формат: name@example.com.'}
                </FieldHint>
              </label>
              <PasswordInput
                label="Новый пароль"
                value={selfNewPassword}
                onChange={(value) => { setSelfNewPassword(value); setFormError('') }}
                placeholder="Оставь пустым, если не меняешь"
                helper="Оставь пустым, если пароль менять не нужно."
                error={selfNewPassword ? getOptionalPasswordError(selfNewPassword) : ''}
              />
              <PasswordInput
                label="Текущий пароль"
                value={selfCurrentPassword}
                onChange={(value) => { setSelfCurrentPassword(value); setFormError('') }}
                placeholder="Подтверждение действия"
                helper="Нужен для подтверждения изменения своих данных."
                className="admin-field--full"
              />
            </div>
            <div className="admin-modal__footer">
              <button type="button" className="admin-ghost-btn" onClick={closeSelfSettingsModal}>Отмена</button>
              <button
                type="button"
                className="admin-primary-btn"
                onClick={handleUpdateSelfSettings}
                disabled={updateSelfSettingsMutation.isPending}
              >
                {updateSelfSettingsMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </Modal>
        ) : null}
      </div>
    )
  }
