import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancy-detail.css'

type VacancyListItem = {
  id: number
  title: string
  salary_min?: number | null
  salary_max?: number | null
  company_name: string
  currency?: string | null
}

type GeoCity = {
  id: number
  name: string
  full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
}

type VacancyDetail = {
  id: number
  title: string
  description: string
  salary_min?: number | null
  salary_max?: number | null
  company_id?: number | null
  company_name: string
  city_name: string
  city_full_name?: string | null
  city?: GeoCity | null
  profession_name: string
  employment_type: string
  work_schedule: string
  currency?: string | null
  experience: string
  skills: string[]
  company_description?: string | null
  company_website?: string | null
  company_logo?: string | null
  company_founded_year?: number | null
  company_employee_count?: number | null
  company_city_names?: string[] | null
  company_cities?: string[] | GeoCity[] | null
}

type CompanyDetail = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  city_names?: string[] | null
  cities?: GeoCity[] | null
}

type ResumeItem = {
  id: number
  profession_id?: number | null
  profession?: {
    id: number
    name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
}

type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

type ApplicationItem = {
  id?: number | string | null
  vacancy_id?: number | string | null
  resume_id?: number | string | null
  status?: ApplicationStatus | string | null
  cover_letter?: string | null
  created_at?: string | null
  updated_at?: string | null
  vacancy?: {
    id?: number | string | null
  } | null
  resume?: {
    id?: number | string | null
  } | null
}

type FavoriteResumeInfo = {
  id: number
  profession_id?: number | null
  profession_name?: string | null
  title?: string | null
}

type FavoriteVacancyState = {
  vacancy_id: number
  is_favorite: boolean
  favorite_id?: number | null
  resume_id?: number | null
  resume?: FavoriteResumeInfo | null
}

type FavoriteMutationPayload =
  | {
      action: 'add'
      resumeId: number
    }
  | {
      action: 'remove'
      resumeId: number
    }

type ApplyPayload = {
  vacancy_id: number
  resume_id: number
  cover_letter?: string | null
}

type ApiValidationItem = {
  msg?: string
  loc?: Array<string | number>
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

const MAX_COVER_LETTER_LENGTH = 1000
const RESUMES_PER_PAGE = 3
const APPLICATIONS_PAGE_LIMIT = 100
const APPLICATIONS_MAX_PAGES = 50

const normalizeArrayResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const objectData = data as {
      items?: unknown[]
      results?: unknown[]
      data?: unknown[]
      applications?: unknown[]
    }

    if (Array.isArray(objectData.items)) return objectData.items as T[]
    if (Array.isArray(objectData.results)) return objectData.results as T[]
    if (Array.isArray(objectData.data)) return objectData.data as T[]
    if (Array.isArray(objectData.applications)) return objectData.applications as T[]
  }

  return []
}

const getApplicationVacancyId = (application: ApplicationItem) => {
  const rawVacancyId = application.vacancy_id ?? application.vacancy?.id

  if (rawVacancyId === null || rawVacancyId === undefined) return null

  const numericVacancyId = Number(rawVacancyId)

  return Number.isFinite(numericVacancyId) ? numericVacancyId : null
}

const fetchVacancy = async (id: string): Promise<VacancyDetail> => {
  const { data } = await http.get(`/public/vacancies/${id}`)
  return data
}

const fetchCompanyDetail = async (id: number): Promise<CompanyDetail> => {
  const { data } = await http.get(`/public/companies/${id}`)
  return data
}

const fetchRelatedVacancies = async (search: string): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: { search, limit: 12, skip: 0 },
  })

  return Array.isArray(data) ? data : []
}

const fetchCurrentApplication = async (vacancyId: string): Promise<ApplicationItem | null> => {
  const currentVacancyId = Number(vacancyId)

  if (!Number.isFinite(currentVacancyId)) return null

  for (let page = 0; page < APPLICATIONS_MAX_PAGES; page += 1) {
    const skip = page * APPLICATIONS_PAGE_LIMIT

    const { data } = await http.get('/applicants/me/applications', {
      params: {
        skip,
        limit: APPLICATIONS_PAGE_LIMIT,
      },
    })

    const applications = normalizeArrayResponse<ApplicationItem>(data)

    const foundApplication =
      applications.find((application) => getApplicationVacancyId(application) === currentVacancyId) ||
      null

    if (foundApplication) return foundApplication

    if (applications.length < APPLICATIONS_PAGE_LIMIT) return null
  }

  return null
}

const fetchMyResumes = async (): Promise<ResumeItem[]> => {
  const { data } = await http.get('/applicants/me/resumes', {
    params: { skip: 0, limit: 100 },
  })

  return normalizeArrayResponse<ResumeItem>(data)
}

const fetchFavoriteState = async (vacancyId: string): Promise<FavoriteVacancyState> => {
  const { data } = await http.get(`/applicants/me/favorite-vacancies/${vacancyId}/state`)

  return {
    vacancy_id: Number(data?.vacancy_id ?? vacancyId),
    is_favorite: Boolean(data?.is_favorite),
    favorite_id: data?.favorite_id ?? null,
    resume_id: data?.resume_id ?? null,
    resume: data?.resume ?? null,
  }
}

const addFavoriteVacancy = async (vacancyId: number, resumeId: number) => {
  const { data } = await http.post(`/applicants/me/favorite-vacancies/${vacancyId}`, {
    resume_id: resumeId,
  })

  return data
}

const removeFavoriteVacancy = async (vacancyId: number, resumeId: number) => {
  await http.delete(`/applicants/me/favorite-vacancies/${vacancyId}`, {
    params: {
      resume_id: resumeId,
    },
  })
}

const createApplication = async (payload: ApplyPayload): Promise<ApplicationItem> => {
  const { data } = await http.post('/applicants/me/applications', {
    vacancy_id: payload.vacancy_id,
    resume_id: payload.resume_id,
    cover_letter: payload.cover_letter?.trim() || null,
  })

  return data
}

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN',
) => {
  const min = typeof salaryMin === 'number' && salaryMin > 0 ? salaryMin : null
  const max = typeof salaryMax === 'number' && salaryMax > 0 ? salaryMax : null

  if (min && max) {
    if (min === max) return `${min.toLocaleString('ru-RU')} ${currency}`
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min) return `от ${min.toLocaleString('ru-RU')} ${currency}`
  if (max) return `до ${max.toLocaleString('ru-RU')} ${currency}`

  return 'Зарплата не указана'
}

const formatCompactCount = (value?: number | null) => {
  const num = Number(value ?? 0)

  if (!Number.isFinite(num) || num <= 0) return '0'
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}m+`
  if (num >= 10_000) return `${Math.floor(num / 1_000)}k+`

  return num.toLocaleString('ru-RU')
}

const formatEmployeeCount = (value?: number | null) => {
  const num = Number(value ?? 0)
  if (!num) return 'Не указано'

  return formatCompactCount(num)
}

const getCityDisplayName = (city?: GeoCity | null) => {
  if (!city) return ''

  if (city.full_name?.trim()) {
    return city.full_name.trim()
  }

  const title = [city.settlement_type_name, city.name].filter(Boolean).join(' ').trim()
  const parts = [title || city.name, city.district_name, city.region_name]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return parts.join(', ')
}

const normalizeOfficeName = (office: string | GeoCity | null | undefined) => {
  if (!office) return ''

  if (typeof office === 'string') {
    return office.trim()
  }

  return getCityDisplayName(office).trim()
}

const formatDate = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('ru-RU')
}

const getResumeTitle = (resume: ResumeItem) => {
  return resume.profession?.name || `Резюме #${resume.id}`
}

const normalizeApplicationStatus = (status?: string | null): ApplicationStatus | null => {
  const normalized = String(status || '').toLowerCase().trim()

  if (!normalized) return null

  if (
    normalized === 'accepted' ||
    normalized.includes('accepted') ||
    normalized.includes('собесед') ||
    normalized.includes('приглас')
  ) {
    return 'accepted'
  }

  if (
    normalized === 'rejected' ||
    normalized.includes('rejected') ||
    normalized.includes('отказ')
  ) {
    return 'rejected'
  }

  if (
    normalized === 'pending' ||
    normalized.includes('pending') ||
    normalized.includes('отклик')
  ) {
    return 'pending'
  }

  return null
}

const getApplicationUi = (status?: string | null, hasApplication = false) => {
  const normalized = normalizeApplicationStatus(status)

  if (normalized === 'accepted') {
    return {
      text: 'Вас пригласили',
      note: 'Работодатель пригласил вас на следующий этап.',
      className: 'is-state-accepted',
    }
  }

  if (normalized === 'rejected') {
    return {
      text: 'Вам отказали',
      note: 'Работодатель отказал по этому отклику.',
      className: 'is-state-rejected',
    }
  }

  if (normalized === 'pending' || hasApplication) {
    return {
      text: 'Вы откликнулись',
      note: 'Ваш отклик отправлен и находится на рассмотрении.',
      className: 'is-state-pending',
    }
  }

  return {
    text: 'Откликнуться',
    note: '',
    className: 'is-cta',
  }
}

const translateApiMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (
    lower.includes('already applied') ||
    lower.includes('duplicate') ||
    lower.includes('уже отклик')
  ) {
    return 'Вы уже откликались на эту вакансию.'
  }

  if (lower.includes('favorite') || lower.includes('избран')) {
    return 'Не удалось изменить избранное.'
  }

  if (
    lower.includes('resume not found') ||
    lower.includes('резюме не найден') ||
    lower.includes('нет резюме')
  ) {
    return 'Выберите доступное резюме или создайте новое.'
  }

  if (lower.includes('vacancy not found') || lower.includes('вакансия не найден')) {
    return 'Вакансия не найдена.'
  }

  if (lower.includes('cover_letter') || lower.includes('сопровод')) {
    return 'Сопроводительное письмо должно быть не длиннее 1000 символов.'
  }

  if (
    lower.includes('access denied') ||
    lower.includes('не принадлежит') ||
    lower.includes('доступ запрещ')
  ) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (
    lower.includes('not authenticated') ||
    lower.includes('unauthorized') ||
    lower.includes('credentials')
  ) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return 'Вы уже откликались на эту вакансию.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback = 'Не удалось выполнить действие.') => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback

  const status = error.response?.status
  const data = error.response?.data

  if (!error.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (Array.isArray(data?.detail)) {
    const messages = data.detail
      .map((item) => translateApiMessage(item.msg || '', status))
      .filter(Boolean)

    if (messages.length) return messages[0]
  }

  if (typeof data?.detail === 'string') {
    return translateApiMessage(data.detail, status)
  }

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error
    if (message) return translateApiMessage(message, status)
  }

  if (data?.message) return translateApiMessage(data.message, status)
  if (data?.error) return translateApiMessage(data.error, status)

  if (status === 409) return 'Вы уже откликались на эту вакансию.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return fallback
}

const HeartIcon = ({ active }: { active: boolean }) => (
  <svg
    className="vacancy-detail-favorite-btn__icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const VacancyDetailPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { vacancyId } = useParams<{ vacancyId: string }>()

  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [favoriteMessage, setFavoriteMessage] = useState('')
  const [favoriteModalError, setFavoriteModalError] = useState('')

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false)

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [selectedFavoriteResumeId, setSelectedFavoriteResumeId] = useState<number | null>(null)

  const [coverLetter, setCoverLetter] = useState('')
  const [resumePage, setResumePage] = useState(1)
  const [favoriteResumePage, setFavoriteResumePage] = useState(1)

  const [localApplication, setLocalApplication] = useState<ApplicationItem | null>(null)

  const accessToken =
    authSession.getAccessToken?.() ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token')

  const rawRole = authSession.getRole?.() || localStorage.getItem('role') || ''
  const normalizedRole = String(rawRole).toLowerCase().trim()

  const isAuthenticated = Boolean(accessToken)
  const isCompany =
    normalizedRole === 'company' ||
    normalizedRole === 'employer' ||
    normalizedRole === 'работодатель' ||
    normalizedRole.includes('company') ||
    normalizedRole.includes('employer')

  const isApplicant =
    isAuthenticated &&
    !isCompany &&
    (normalizedRole === '' ||
      normalizedRole === 'applicant' ||
      normalizedRole === 'соискатель' ||
      normalizedRole.includes('applicant'))

  const vacancyQuery = useQuery({
    queryKey: ['vacancy-detail', vacancyId],
    queryFn: () => fetchVacancy(vacancyId as string),
    enabled: Boolean(vacancyId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const favoriteStateQuery = useQuery({
    queryKey: ['favorite-vacancy-state', vacancyId],
    queryFn: () => fetchFavoriteState(vacancyId as string),
    enabled: Boolean(vacancyId) && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const companyQuery = useQuery({
    queryKey: ['vacancy-detail-company', vacancyQuery.data?.company_id],
    queryFn: () => fetchCompanyDetail(vacancyQuery.data?.company_id as number),
    enabled: Boolean(vacancyQuery.data?.company_id),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const relatedQuery = useQuery({
    queryKey: ['vacancy-related', vacancyQuery.data?.title],
    enabled: Boolean(vacancyQuery.data?.title),
    queryFn: () => fetchRelatedVacancies(vacancyQuery.data?.title.split(' ')[0] ?? ''),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const currentApplicationQuery = useQuery({
    queryKey: ['applicant-current-application', vacancyId],
    queryFn: () => fetchCurrentApplication(vacancyId as string),
    enabled: Boolean(vacancyId) && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const myResumesQuery = useQuery({
    queryKey: ['applicant-my-resumes', 'vacancy-actions'],
    queryFn: fetchMyResumes,
    enabled: (isApplyModalOpen || isFavoriteModalOpen) && isAuthenticated && isApplicant,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resumes = useMemo(() => myResumesQuery.data || [], [myResumesQuery.data])

  const favoriteMutation = useMutation({
    mutationFn: async (payload: FavoriteMutationPayload) => {
      if (!vacancyId) {
        throw new Error('Некорректный id вакансии.')
      }

      const numericVacancyId = Number(vacancyId)

      if (!Number.isFinite(numericVacancyId)) {
        throw new Error('Некорректный id вакансии.')
      }

      if (payload.action === 'add') {
        return addFavoriteVacancy(numericVacancyId, payload.resumeId)
      }

      await removeFavoriteVacancy(numericVacancyId, payload.resumeId)
      return null
    },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: ['favorite-vacancy-state', vacancyId],
      })

      const previousFavoriteState = queryClient.getQueryData<FavoriteVacancyState>([
        'favorite-vacancy-state',
        vacancyId,
      ])

      const pickedResume = resumes.find((resume) => resume.id === payload.resumeId)

      queryClient.setQueryData<FavoriteVacancyState>(['favorite-vacancy-state', vacancyId], {
        vacancy_id: Number(vacancyId),
        is_favorite: payload.action === 'add',
        favorite_id: payload.action === 'add' ? previousFavoriteState?.favorite_id ?? null : null,
        resume_id: payload.action === 'add' ? payload.resumeId : null,
        resume:
          payload.action === 'add' && pickedResume
            ? {
                id: pickedResume.id,
                profession_id: pickedResume.profession_id ?? pickedResume.profession?.id ?? null,
                profession_name: pickedResume.profession?.name ?? null,
                title: getResumeTitle(pickedResume),
              }
            : null,
      })

      return { previousFavoriteState }
    },

    onSuccess: async (_, payload) => {
      setActionError('')
      setActionMessage('')
      setFavoriteModalError('')

      if (payload.action === 'add') {
        setFavoriteMessage('Вакансия добавлена в избранное.')
        setIsFavoriteModalOpen(false)
        setSelectedFavoriteResumeId(null)
        setFavoriteResumePage(1)
      } else {
        setFavoriteMessage('Вакансия удалена из избранного.')
      }

      await queryClient.invalidateQueries({
        queryKey: ['applicant-favorite-vacancies'],
      })
    },

    onError: (error, payload, context) => {
      if (context?.previousFavoriteState) {
        queryClient.setQueryData(
          ['favorite-vacancy-state', vacancyId],
          context.previousFavoriteState,
        )
      }

      const message = getErrorMessage(
        error,
        payload.action === 'add'
          ? 'Не удалось добавить вакансию в избранное.'
          : 'Не удалось удалить вакансию из избранного.',
      )

      setFavoriteMessage('')
      setActionMessage('')

      if (payload.action === 'add') {
        setFavoriteModalError(message)
      } else {
        setActionError(message)
      }
    },

    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['favorite-vacancy-state', vacancyId],
      })
    },
  })

  const applyMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: async (createdApplication) => {
      const safeCreatedApplication: ApplicationItem = {
        ...createdApplication,
        vacancy_id: createdApplication.vacancy_id ?? Number(vacancyId),
        status: createdApplication.status || 'pending',
      }

      setActionError('')
      setActionMessage('Отклик успешно отправлен.')
      setLocalApplication(safeCreatedApplication)
      setIsApplyModalOpen(false)
      setCoverLetter('')
      setSelectedResumeId(null)
      setResumePage(1)

      queryClient.setQueryData<ApplicationItem | null>(
        ['applicant-current-application', vacancyId],
        safeCreatedApplication,
      )

      await queryClient.invalidateQueries({ queryKey: ['applicant-current-application', vacancyId] })
      await queryClient.invalidateQueries({ queryKey: ['vacancy-detail', vacancyId] })
    },
    onError: async (error) => {
      const message = getErrorMessage(error, 'Не удалось отправить отклик.')

      setActionMessage('')
      setActionError(message)

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 409 || message.toLowerCase().includes('уже отклик'))
      ) {
        const duplicateApplication: ApplicationItem = {
          vacancy_id: vacancyId ? Number(vacancyId) : null,
          resume_id: selectedResumeId,
          status: 'pending',
          cover_letter: coverLetter.trim() || null,
        }

        setLocalApplication(duplicateApplication)

        queryClient.setQueryData<ApplicationItem | null>(
          ['applicant-current-application', vacancyId],
          duplicateApplication,
        )

        await queryClient.invalidateQueries({
          queryKey: ['applicant-current-application', vacancyId],
        })
      }
    },
  })

  const relatedVacancies = useMemo(() => {
    if (!relatedQuery.data) return []

    return relatedQuery.data.filter((item) => item.id !== Number(vacancyId)).slice(0, 3)
  }, [relatedQuery.data, vacancyId])

  const currentQueryApplication = currentApplicationQuery.data || null

  const effectiveApplication = useMemo(() => {
    if (!vacancyId) return currentQueryApplication

    const currentVacancyId = Number(vacancyId)
    if (!Number.isFinite(currentVacancyId)) return currentQueryApplication

    if (localApplication && getApplicationVacancyId(localApplication) === currentVacancyId) {
      return localApplication
    }

    return currentQueryApplication
  }, [currentQueryApplication, localApplication, vacancyId])

  const hasEffectiveApplication = Boolean(effectiveApplication)
  const applicationUi = getApplicationUi(effectiveApplication?.status, hasEffectiveApplication)

  const resumeTotalPages = Math.max(Math.ceil(resumes.length / RESUMES_PER_PAGE), 1)

  const paginatedResumes = useMemo(() => {
    const start = (resumePage - 1) * RESUMES_PER_PAGE
    return resumes.slice(start, start + RESUMES_PER_PAGE)
  }, [resumes, resumePage])

  const visibleResumeStart = resumes.length === 0 ? 0 : (resumePage - 1) * RESUMES_PER_PAGE + 1
  const visibleResumeEnd = Math.min(resumePage * RESUMES_PER_PAGE, resumes.length)

  const selectedResume = useMemo(() => {
    if (!selectedResumeId) return null

    return resumes.find((item) => item.id === selectedResumeId) || null
  }, [resumes, selectedResumeId])

  const favoriteResumeTotalPages = Math.max(Math.ceil(resumes.length / RESUMES_PER_PAGE), 1)

  const paginatedFavoriteResumes = useMemo(() => {
    const start = (favoriteResumePage - 1) * RESUMES_PER_PAGE
    return resumes.slice(start, start + RESUMES_PER_PAGE)
  }, [resumes, favoriteResumePage])

  const visibleFavoriteResumeStart =
    resumes.length === 0 ? 0 : (favoriteResumePage - 1) * RESUMES_PER_PAGE + 1

  const visibleFavoriteResumeEnd = Math.min(favoriteResumePage * RESUMES_PER_PAGE, resumes.length)

  const selectedFavoriteResume = useMemo(() => {
    if (!selectedFavoriteResumeId) return null

    return resumes.find((item) => item.id === selectedFavoriteResumeId) || null
  }, [resumes, selectedFavoriteResumeId])

  const vacancy = vacancyQuery.data
  const company = companyQuery.data

  const isFavorite = Boolean(favoriteStateQuery.data?.is_favorite)
  const isFavoriteChecking =
    isAuthenticated &&
    isApplicant &&
    !favoriteStateQuery.data &&
    (favoriteStateQuery.isLoading || favoriteStateQuery.isFetching)

  const companyId = vacancy?.company_id ?? company?.id ?? null
  const companyHref = companyId ? `/companies/${companyId}` : ''

  const companyInfo = useMemo(() => {
    return {
      name: company?.name || vacancy?.company_name || 'Компания',
      description: company?.description ?? vacancy?.company_description ?? null,
      website: company?.website ?? vacancy?.company_website ?? null,
      logo: company?.logo ?? vacancy?.company_logo ?? null,
      foundedYear: company?.founded_year ?? vacancy?.company_founded_year ?? null,
      employeeCount: company?.employee_count ?? vacancy?.company_employee_count ?? null,
    }
  }, [company, vacancy])

  const companyOfficeNames = useMemo(() => {
    const vacancyCompanyCities = Array.isArray(vacancy?.company_cities)
      ? vacancy.company_cities
      : []

    const names = [
      ...(company?.city_names || []),
      ...((company?.cities || []).map(normalizeOfficeName)),
      ...(vacancy?.company_city_names || []),
      ...vacancyCompanyCities.map((item) => normalizeOfficeName(item as string | GeoCity)),
    ]

    return Array.from(
      new Set(
        names
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    )
  }, [company, vacancy])

  const mainCompanyOfficeName = companyOfficeNames[0] || ''
  const hiddenCompanyOfficeCount = Math.max(companyOfficeNames.length - 1, 0)
  const companyOfficeLabel = mainCompanyOfficeName
    ? `${mainCompanyOfficeName}${hiddenCompanyOfficeCount > 0 ? ', и др.' : ''}`
    : 'Не указан'

  const vacancyCityName = getCityDisplayName(vacancy?.city) || vacancy?.city_full_name || vacancy?.city_name || ''

  useEffect(() => {
    setLocalApplication(null)
    setActionMessage('')
    setActionError('')
    setFavoriteMessage('')
    setFavoriteModalError('')
    setIsApplyModalOpen(false)
    setIsFavoriteModalOpen(false)
    setSelectedResumeId(null)
    setSelectedFavoriteResumeId(null)
    setCoverLetter('')
    setResumePage(1)
    setFavoriteResumePage(1)
  }, [vacancyId])

  useEffect(() => {
    if (!favoriteMessage) return

    const timeout = window.setTimeout(() => {
      setFavoriteMessage('')
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [favoriteMessage])

  useEffect(() => {
    if (!isApplyModalOpen) return

    setResumePage(1)
  }, [isApplyModalOpen])

  useEffect(() => {
    if (!isFavoriteModalOpen) return

    setFavoriteResumePage(1)
  }, [isFavoriteModalOpen])

  useEffect(() => {
    if (resumePage <= resumeTotalPages) return

    setResumePage(resumeTotalPages)
  }, [resumePage, resumeTotalPages])

  useEffect(() => {
    if (favoriteResumePage <= favoriteResumeTotalPages) return

    setFavoriteResumePage(favoriteResumeTotalPages)
  }, [favoriteResumePage, favoriteResumeTotalPages])

  useEffect(() => {
    if (!isApplyModalOpen || selectedResumeId || resumes.length === 0) return

    setSelectedResumeId(resumes[0].id)
  }, [isApplyModalOpen, resumes, selectedResumeId])

  useEffect(() => {
    if (!isFavoriteModalOpen || selectedFavoriteResumeId || resumes.length === 0) return

    setSelectedFavoriteResumeId(resumes[0].id)
  }, [isFavoriteModalOpen, resumes, selectedFavoriteResumeId])

  useEffect(() => {
    if (!isApplyModalOpen) return

    const previousOverflow = document.body.style.overflow

    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || applyMutation.isPending) return

      setIsApplyModalOpen(false)
      setSelectedResumeId(null)
      setCoverLetter('')
      setActionError('')
      setResumePage(1)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeByEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeByEscape)
    }
  }, [isApplyModalOpen, applyMutation.isPending])

  useEffect(() => {
    if (!isFavoriteModalOpen) return

    const previousOverflow = document.body.style.overflow

    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || favoriteMutation.isPending) return

      setIsFavoriteModalOpen(false)
      setSelectedFavoriteResumeId(null)
      setFavoriteModalError('')
      setFavoriteResumePage(1)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeByEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeByEscape)
    }
  }, [isFavoriteModalOpen, favoriteMutation.isPending])

  const handleToggleFavorite = async () => {
    if (!vacancyId || favoriteMutation.isPending || isFavoriteChecking) return

    setActionMessage('')
    setActionError('')
    setFavoriteMessage('')
    setFavoriteModalError('')

    if (!isAuthenticated) {
      const redirectPath = `/vacancies/${vacancyId}`

            navigate(`/register?redirect=${encodeURIComponent(redirectPath)}`, {
        state: { from: redirectPath },
      })

      return
    }

    if (!isApplicant) {
      setActionError('Добавлять вакансии в избранное может только соискатель.')
      return
    }

    if (isFavorite) {
      const resumeId = favoriteStateQuery.data?.resume_id

      if (!resumeId) {
        setActionError('Не удалось определить резюме, к которому привязана избранная вакансия.')
        return
      }

      await favoriteMutation.mutateAsync({
        action: 'remove',
        resumeId,
      })

      return
    }

    setIsFavoriteModalOpen(true)
  }

  const handleCloseFavoriteModal = () => {
    if (favoriteMutation.isPending) return

    setIsFavoriteModalOpen(false)
    setSelectedFavoriteResumeId(null)
    setFavoriteModalError('')
    setFavoriteResumePage(1)
  }

  const handleSubmitFavorite = async () => {
    if (!vacancyId) return

    setFavoriteModalError('')
    setActionError('')
    setActionMessage('')
    setFavoriteMessage('')

    if (!selectedFavoriteResumeId) {
      setFavoriteModalError('Выберите резюме, к которому относится избранная вакансия.')
      return
    }

    await favoriteMutation.mutateAsync({
      action: 'add',
      resumeId: selectedFavoriteResumeId,
    })
  }

  const handleOpenApplyModal = async () => {
    if (!vacancyId) return

    setActionMessage('')
    setActionError('')

    if (!isAuthenticated) {
      const redirectPath = `/vacancies/${vacancyId}`

      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`, {
        state: { from: redirectPath },
      })

      return
    }

    if (!isApplicant) {
      setActionError('Откликаться на вакансии может только соискатель.')
      return
    }

    if (hasEffectiveApplication) return

    setIsApplyModalOpen(true)
  }

  const handleCloseApplyModal = () => {
    if (applyMutation.isPending) return

    setIsApplyModalOpen(false)
    setSelectedResumeId(null)
    setCoverLetter('')
    setActionError('')
    setResumePage(1)
  }

  const handleSubmitApplication = async () => {
    if (!vacancyId) return

    setActionMessage('')
    setActionError('')

    if (!selectedResumeId) {
      setActionError('Выберите резюме для отклика.')
      return
    }

    if (coverLetter.length > MAX_COVER_LETTER_LENGTH) {
      setActionError('Сопроводительное письмо должно быть не длиннее 1000 символов.')
      return
    }

    await applyMutation.mutateAsync({
      vacancy_id: Number(vacancyId),
      resume_id: selectedResumeId,
      cover_letter: coverLetter.trim() || null,
    })
  }

  if (!vacancyId) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state">Некорректный id вакансии.</main>
        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isLoading) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state">Загружаем карточку вакансии...</main>
        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isError || !vacancy) {
    return (
      <div className="vacancy-detail-page">
        <Header />
        <main className="vacancy-detail-page__state vacancy-detail-page__state--error">
          Не удалось загрузить карточку вакансии.
        </main>
        <Footer />
      </div>
    )
  }

  const vacancyCurrency = vacancy.currency || 'BYN'
  const skills = Array.isArray(vacancy.skills) ? vacancy.skills : []

  const isApplicationChecking =
    isAuthenticated &&
    isApplicant &&
    !hasEffectiveApplication &&
    (currentApplicationQuery.isLoading || currentApplicationQuery.isFetching)

  const applyButtonText =
    applyMutation.isPending || isApplicationChecking ? 'Проверяем...' : applicationUi.text

  const isApplyDisabled = applyMutation.isPending || isApplicationChecking || hasEffectiveApplication

  const applyButtonClassName = `btn btn--large vacancy-detail-apply-btn ${
    hasEffectiveApplication ? applicationUi.className : 'is-cta'
  }`

  const favoriteButtonText = favoriteMutation.isPending
    ? 'Сохраняем...'
    : isFavorite
      ? 'В избранном'
      : 'В избранное'

  return (
    <div className="vacancy-detail-page">
      <Header />

      <main className="vacancy-detail-page__main">
        <section className="vacancy-detail-hero">
          <div className="container">
            <div className="vacancy-detail-hero__card">
              <div className="vacancy-detail-hero__breadcrumbs">
                <Link to="/vacancies">Вакансии</Link>
                <span>•</span>
                <span>{vacancy.profession_name}</span>
              </div>

              <div className="vacancy-detail-hero__top">
                <div className="vacancy-detail-hero__main">
                  <h1 className="vacancy-detail-hero__title">{vacancy.title}</h1>

                  {companyId ? (
                    <Link
                      to={companyHref}
                      className="vacancy-detail-hero__company vacancy-detail-hero__company--link"
                    >
                      {vacancy.company_name}
                    </Link>
                  ) : (
                    <div className="vacancy-detail-hero__company">{vacancy.company_name}</div>
                  )}

                  <div className="vacancy-detail-hero__location">{vacancyCityName}</div>
                </div>

                <div className="vacancy-detail-hero__salary-box">
                  <strong className="vacancy-detail-hero__salary-value">
                    {formatSalary(vacancy.salary_min, vacancy.salary_max, vacancyCurrency)}
                  </strong>
                </div>
              </div>

              <div className="vacancy-detail-hero__meta">
                <span className="vacancy-detail-pill">{vacancy.profession_name}</span>
                <span className="vacancy-detail-pill">{vacancy.employment_type}</span>
                <span className="vacancy-detail-pill">{vacancy.work_schedule}</span>
                <span className="vacancy-detail-pill">{vacancy.experience}</span>
              </div>

              <div className="vacancy-detail-hero__actions">
                <div className="vacancy-detail-hero__action-row">
                  <button
                    type="button"
                    className={applyButtonClassName}
                    onClick={handleOpenApplyModal}
                    disabled={isApplyDisabled}
                  >
                    {applyButtonText}
                  </button>

                  <button
                    type="button"
                    className={`vacancy-detail-favorite-btn ${isFavorite ? 'is-active' : ''}`}
                    onClick={handleToggleFavorite}
                    disabled={favoriteMutation.isPending || isFavoriteChecking}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                    title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                  >
                    <HeartIcon active={isFavorite} />
                    <span>{favoriteButtonText}</span>
                  </button>
                </div>

                {hasEffectiveApplication && applicationUi.note ? (
                  <p className="vacancy-detail-status-note">{applicationUi.note}</p>
                ) : null}

                {actionMessage ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--success">
                    {actionMessage}
                  </p>
                ) : null}

                {favoriteMessage ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--favorite">
                    {favoriteMessage}
                  </p>
                ) : null}

                {actionError && !isApplyModalOpen && !isFavoriteModalOpen ? (
                  <p className="vacancy-detail-status-note vacancy-detail-status-note--error">
                    {actionError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="vacancy-detail-content">
          <div className="container">
            <div className="vacancy-detail-layout">
              <section className="vacancy-detail-main">
                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Описание вакансии</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <p className="vacancy-detail-description">{vacancy.description}</p>
                  </div>
                </article>

                <article className="vacancy-detail-card">
                  <div className="vacancy-detail-card__header">
                    <h2>Ключевые навыки</h2>
                  </div>

                  <div className="vacancy-detail-card__body">
                    <div className="vacancy-detail-skills">
                      {skills.length === 0 ? (
                        <span className="vacancy-detail-skill">Не указаны</span>
                      ) : null}

                      {skills.map((skill) => (
                        <span key={skill} className="vacancy-detail-skill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>

                {relatedVacancies.length > 0 ? (
                  <article className="vacancy-detail-card">
                    <div className="vacancy-detail-card__header">
                      <h2>Похожие вакансии</h2>
                    </div>

                    <div className="vacancy-related-list">
                      {relatedVacancies.map((item) => (
                        <Link
                          key={item.id}
                          to={`/vacancies/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="vacancy-related-item"
                        >
                          <div className="vacancy-related-item__title">{item.title}</div>

                          <div className="vacancy-related-item__salary">
                            {formatSalary(
                              item.salary_min,
                              item.salary_max,
                              item.currency || vacancyCurrency,
                            )}
                          </div>

                          <div className="vacancy-related-item__company">{item.company_name}</div>
                        </Link>
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>

              <aside className="vacancy-detail-sidebar">
  <section className="vacancy-detail-card vacancy-company-card">
    {companyId ? (
      <Link
        to={companyHref}
        className="vacancy-company-card__head vacancy-company-card__head-link"
        aria-label={`Открыть карточку компании ${companyInfo.name}`}
      >
        {companyInfo.logo ? (
          <img
            src={companyInfo.logo}
            alt={companyInfo.name}
            className="vacancy-company-card__logo"
          />
        ) : (
          <div className="vacancy-company-card__logo vacancy-company-card__logo--placeholder">
            {companyInfo.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="vacancy-company-card__head-text">
          <h3>{companyInfo.name}</h3>
          <p>Информация о компании</p>
        </div>
      </Link>
    ) : (
      <div className="vacancy-company-card__head">
        {companyInfo.logo ? (
          <img
            src={companyInfo.logo}
            alt={companyInfo.name}
            className="vacancy-company-card__logo"
          />
        ) : (
          <div className="vacancy-company-card__logo vacancy-company-card__logo--placeholder">
            {companyInfo.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="vacancy-company-card__head-text">
          <h3>{companyInfo.name}</h3>
          <p>Информация о компании</p>
        </div>
      </div>
    )}

    <div className="vacancy-company-card__offices-block">
      <div className="vacancy-company-card__offices-title">
        Офис компании
      </div>

      <div
        className="vacancy-company-card__office-main"
        title={companyOfficeNames.length > 0 ? companyOfficeNames.join(', ') : ''}
      >
        {companyOfficeLabel}
      </div>
    </div>

    <ul className="vacancy-company-card__list">
      <li>
        <span>Год основания</span>
        <strong>{companyInfo.foundedYear || 'Не указано'}</strong>
      </li>

      <li>
        <span>Сотрудников</span>
        <strong>{formatEmployeeCount(companyInfo.employeeCount)}</strong>
      </li>

      {companyInfo.website ? (
        <li>
          <span>Сайт</span>
          <a href={companyInfo.website} target="_blank" rel="noreferrer">
            Перейти
          </a>
        </li>
      ) : null}
    </ul>

    {companyId ? (
      <Link to={companyHref} className="vacancy-company-card__open-link">
        Открыть карточку компании
      </Link>
    ) : null}
  </section>
</aside>
            </div>
          </div>
        </section>
      </main>

      {isFavoriteModalOpen ? (
        <div className="apply-modal-overlay" onMouseDown={handleCloseFavoriteModal}>
          <section
            className="apply-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="favorite-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="apply-modal__header">
              <div>
                <p className="apply-modal__eyebrow">Добавление в избранное</p>
                <h2 id="favorite-modal-title">{vacancy.title}</h2>
                <p>Выберите резюме, к которому относится эта вакансия.</p>
              </div>

              <button
                type="button"
                className="apply-modal__close"
                onClick={handleCloseFavoriteModal}
                disabled={favoriteMutation.isPending}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {myResumesQuery.isLoading ? (
              <div className="apply-modal__state">Загружаем ваши резюме...</div>
            ) : null}

            {myResumesQuery.isError ? (
              <div className="apply-modal__error">Не удалось загрузить резюме.</div>
            ) : null}

            {!myResumesQuery.isLoading && !myResumesQuery.isError && resumes.length === 0 ? (
              <div className="apply-modal__empty">
                <h3>У вас пока нет резюме</h3>
                <p>Без резюме нельзя добавить вакансию в избранное.</p>

                <button
                  type="button"
                  className="apply-modal__primary"
                  onClick={() => navigate('/applicant/resume/create')}
                >
                  Создать резюме
                </button>
              </div>
            ) : null}

            {resumes.length > 0 ? (
              <>
                <div className="apply-modal__section">
                  <div className="apply-modal__section-head apply-modal__section-head--resumes">
                    <div>
                      <h3>Выберите резюме</h3>
                      <p>
                        Показано {visibleFavoriteResumeStart}–{visibleFavoriteResumeEnd} из{' '}
                        {resumes.length}
                      </p>
                    </div>

                    {favoriteResumeTotalPages > 1 ? (
                      <div className="apply-resume-pagination">
                        <button
                          type="button"
                          onClick={() =>
                            setFavoriteResumePage((page) => Math.max(page - 1, 1))
                          }
                          disabled={favoriteResumePage === 1}
                          aria-label="Предыдущая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                          </svg>
                        </button>

                        <span>
                          {favoriteResumePage}/{favoriteResumeTotalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setFavoriteResumePage((page) =>
                              Math.min(page + 1, favoriteResumeTotalPages),
                            )
                          }
                          disabled={favoriteResumePage === favoriteResumeTotalPages}
                          aria-label="Следующая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 6L15 12L9 18" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="apply-resume-list">
                    {paginatedFavoriteResumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        className={`apply-resume-card ${
                          selectedFavoriteResumeId === resume.id ? 'is-selected' : ''
                        }`}
                        onClick={() => setSelectedFavoriteResumeId(resume.id)}
                      >
                        <span className="apply-resume-card__title">{getResumeTitle(resume)}</span>

                        {resume.updated_at || resume.created_at ? (
                          <span className="apply-resume-card__meta">
                            Обновлено: {formatDate(resume.updated_at || resume.created_at)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                {favoriteModalError ? (
                  <div className="apply-modal__error">{favoriteModalError}</div>
                ) : null}

                <div className="apply-modal__footer">
                  <button
                    type="button"
                    className="apply-modal__secondary"
                    onClick={handleCloseFavoriteModal}
                    disabled={favoriteMutation.isPending}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="apply-modal__primary"
                    onClick={handleSubmitFavorite}
                    disabled={favoriteMutation.isPending || !selectedFavoriteResumeId}
                  >
                    {favoriteMutation.isPending
                      ? 'Добавляем...'
                      : selectedFavoriteResume
                        ? `Добавить к «${getResumeTitle(selectedFavoriteResume)}»`
                        : 'Добавить в избранное'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {isApplyModalOpen ? (
        <div className="apply-modal-overlay" onMouseDown={handleCloseApplyModal}>
          <section
            className="apply-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="apply-modal__header">
              <div>
                <p className="apply-modal__eyebrow">Отклик на вакансию</p>
                <h2 id="apply-modal-title">{vacancy.title}</h2>
                <p>{vacancy.company_name}</p>
              </div>

              <button
                type="button"
                className="apply-modal__close"
                onClick={handleCloseApplyModal}
                disabled={applyMutation.isPending}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {myResumesQuery.isLoading ? (
              <div className="apply-modal__state">Загружаем ваши резюме...</div>
            ) : null}

            {myResumesQuery.isError ? (
              <div className="apply-modal__error">Не удалось загрузить резюме.</div>
            ) : null}

            {!myResumesQuery.isLoading && !myResumesQuery.isError && resumes.length === 0 ? (
              <div className="apply-modal__empty">
                <h3>У вас пока нет резюме</h3>
                <p>Создайте резюме, чтобы откликнуться на вакансию.</p>

                <button
                  type="button"
                  className="apply-modal__primary"
                  onClick={() => navigate('/applicant/resume/create')}
                >
                  Создать резюме
                </button>
              </div>
            ) : null}

            {resumes.length > 0 ? (
              <>
                <div className="apply-modal__section">
                  <div className="apply-modal__section-head apply-modal__section-head--resumes">
                    <div>
                      <h3>Выберите резюме</h3>
                      <p>
                        Показано {visibleResumeStart}–{visibleResumeEnd} из {resumes.length}
                      </p>
                    </div>

                    {resumeTotalPages > 1 ? (
                      <div className="apply-resume-pagination">
                        <button
                          type="button"
                          onClick={() => setResumePage((page) => Math.max(page - 1, 1))}
                          disabled={resumePage === 1}
                          aria-label="Предыдущая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                          </svg>
                        </button>

                        <span>
                          {resumePage}/{resumeTotalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setResumePage((page) => Math.min(page + 1, resumeTotalPages))
                          }
                          disabled={resumePage === resumeTotalPages}
                          aria-label="Следующая страница резюме"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 6L15 12L9 18" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="apply-resume-list">
                    {paginatedResumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        className={`apply-resume-card ${
                          selectedResumeId === resume.id ? 'is-selected' : ''
                        }`}
                        onClick={() => setSelectedResumeId(resume.id)}
                      >
                        <span className="apply-resume-card__title">{getResumeTitle(resume)}</span>

                        {resume.updated_at || resume.created_at ? (
                          <span className="apply-resume-card__meta">
                            Обновлено: {formatDate(resume.updated_at || resume.created_at)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="apply-modal__section">
                  <div className="apply-modal__section-head">
                    <h3>Сопроводительное письмо</h3>
                    <span>
                      {coverLetter.length}/{MAX_COVER_LETTER_LENGTH}
                    </span>
                  </div>

                  <textarea
                    className="apply-cover-letter"
                    value={coverLetter}
                    maxLength={MAX_COVER_LETTER_LENGTH}
                    onChange={(event) => setCoverLetter(event.target.value)}
                    placeholder="Можно оставить пустым. Например: Здравствуйте! Меня заинтересовала ваша вакансия, готов обсудить опыт и условия."
                  />
                </div>

                {actionError ? <div className="apply-modal__error">{actionError}</div> : null}

                <div className="apply-modal__footer">
                  <button
                    type="button"
                    className="apply-modal__secondary"
                    onClick={handleCloseApplyModal}
                    disabled={applyMutation.isPending}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="apply-modal__primary"
                    onClick={handleSubmitApplication}
                    disabled={applyMutation.isPending || !selectedResumeId}
                  >
                    {applyMutation.isPending
                      ? 'Отправляем...'
                      : selectedResume
                        ? `Откликнуться с «${getResumeTitle(selectedResume)}»`
                        : 'Откликнуться'}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      <Footer />
    </div>
  )
}