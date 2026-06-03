import axios from 'axios'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './applicant-favorites.css'

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

type FavoriteResumeInfo = {
  id: number
  profession_id?: number | null
  profession_name?: string | null
  title?: string | null
}

type GeoCity = {
  id?: number | null
  name?: string | null
  full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
}


type RegionItem = {
  id: number
  name: string
}

type DistrictItem = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
}

type CityCatalogItem = {
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

type FavoriteVacancyApiItem = {
  id?: number
  favorite_id?: number
  vacancy_id: number
  resume_id?: number | null
  resume_ids?: number[] | null
  resumes?: FavoriteResumeInfo[] | null

  title?: string | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null

  company_id?: number | null
  company_name?: string | null
  company_logo?: string | null

  city_id?: number | null
  city_name?: string | null
  city_full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
  city?: GeoCity | null

  profession_id?: number | null
  profession_name?: string | null

  employment_type?: string | null
  employment_type_name?: string | null
  work_schedule?: string | null
  work_schedule_name?: string | null
  experience?: string | null
  experience_name?: string | null

  skills?: Array<string | { id: number; name: string }> | null
  created_at?: string | null
  updated_at?: string | null

  vacancy?: {
    id?: number | null
    title?: string | null
    salary_min?: number | null
    salary_max?: number | null
    currency?: string | null
    currency_name?: string | null
    company_id?: number | null
    company_name?: string | null
    city_id?: number | null
    city_name?: string | null
    city_full_name?: string | null
    region_id?: number | null
    region_name?: string | null
    district_id?: number | null
    district_name?: string | null
    settlement_type_id?: number | null
    settlement_type_name?: string | null
    city?: GeoCity | null
    profession_name?: string | null
    employment_type?: string | null
    employment_type_name?: string | null
    work_schedule?: string | null
    work_schedule_name?: string | null
    experience?: string | null
    experience_name?: string | null
    skills?: Array<string | { id: number; name: string }> | null
    created_at?: string | null
    updated_at?: string | null
  } | null
}

type FavoriteVacancyCard = {
  key: string
  favoriteId: number | null
  vacancyId: number
  resumeId: number | null
  resumeTitle: string
  title: string
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  companyId: number | null
  companyName: string
  companyLogo: string | null
  cityName: string
  cityId: number | null
  regionId: number | null
  districtId: number | null
  professionName: string
  employmentType: string
  workSchedule: string
  experience: string
  skills: string[]
  createdAt: string | null
  updatedAt: string | null
}

type ComboOption = {
  value: string | number
  label: string
}

type ApiValidationItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

const normalizeArrayResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const objectData = data as {
      items?: unknown[]
      results?: unknown[]
      data?: unknown[]
      favorites?: unknown[]
      favorite_vacancies?: unknown[]
    }

    if (Array.isArray(objectData.items)) return objectData.items as T[]
    if (Array.isArray(objectData.results)) return objectData.results as T[]
    if (Array.isArray(objectData.data)) return objectData.data as T[]
    if (Array.isArray(objectData.favorites)) return objectData.favorites as T[]
    if (Array.isArray(objectData.favorite_vacancies)) return objectData.favorite_vacancies as T[]
  }

  return []
}

const fetchMyResumes = async (): Promise<ResumeItem[]> => {
  const { data } = await http.get('/applicants/me/resumes', {
    params: { skip: 0, limit: 100 },
  })

  return normalizeArrayResponse<ResumeItem>(data)
}

const fetchFavorites = async (): Promise<FavoriteVacancyApiItem[]> => {
  const { data } = await http.get('/applicants/me/favorite-vacancies', {
    params: { skip: 0, limit: 100 },
  })

  return normalizeArrayResponse<FavoriteVacancyApiItem>(data)
}


const fetchCatalog = async <T,>(catalogName: string, limit = 100): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit },
  })

  return normalizeArrayResponse<T>(data)
}

const removeFavoriteVacancy = async (payload: { vacancyId: number; resumeId: number }) => {
  await http.delete(`/applicants/me/favorite-vacancies/${payload.vacancyId}`, {
    params: {
      resume_id: payload.resumeId,
    },
  })
}

const getResumeTitle = (resume?: ResumeItem | FavoriteResumeInfo | null) => {
  if (!resume) return 'Без резюме'

  if ('title' in resume && resume.title) return resume.title
  if ('profession_name' in resume && resume.profession_name) return resume.profession_name
  if ('profession' in resume && resume.profession?.name) return resume.profession.name

  return `Резюме #${resume.id}`
}

const getSkillName = (skill: string | { id: number; name: string }) => {
  return typeof skill === 'string' ? skill : skill.name
}

const normalizeSkills = (skills?: Array<string | { id: number; name: string }> | null) => {
  return Array.from(new Set((skills || []).map(getSkillName).filter(Boolean)))
}

const getCityDisplayName = (city?: GeoCity | null) => {
  if (!city) return ''

  if (city.full_name?.trim()) return city.full_name.trim()

  const title = [city.settlement_type_name, city.name].filter(Boolean).join(' ').trim()
  const parts = [title, city.district_name, city.region_name].filter(Boolean)

  return parts.join(', ')
}


const getDistrictDisplayName = (district?: DistrictItem | null) => {
  if (!district) return ''
  return district.region_name ? `${district.name}, ${district.region_name}` : district.name
}

const getGeoIdsFromItem = (item: FavoriteVacancyApiItem) => {
  const vacancy = item.vacancy || {}
  const city = item.city || vacancy.city || null

  return {
    cityId: item.city_id ?? vacancy.city_id ?? city?.id ?? null,
    regionId: item.region_id ?? vacancy.region_id ?? city?.region_id ?? null,
    districtId: item.district_id ?? vacancy.district_id ?? city?.district_id ?? null,
  }
}

const getVacancyCityName = (item: FavoriteVacancyApiItem) => {
  const vacancy = item.vacancy || {}

  return (
    getCityDisplayName(item.city) ||
    item.city_full_name ||
    getCityDisplayName(vacancy.city) ||
    vacancy.city_full_name ||
    getCityDisplayName({
      name: item.city_name || vacancy.city_name,
      region_name: item.region_name || vacancy.region_name,
      district_name: item.district_name || vacancy.district_name,
      settlement_type_name: item.settlement_type_name || vacancy.settlement_type_name,
      full_name: item.city_full_name || vacancy.city_full_name,
    }) ||
    item.city_name ||
    vacancy.city_name ||
    'Город не указан'
  )
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

const formatDate = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ru-RU')
}

const translateApiMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('favorite') || lower.includes('избран')) return 'Не удалось изменить избранное.'
  if (lower.includes('resume') || lower.includes('резюме')) return 'Выберите доступное резюме.'
  if (lower.includes('vacancy') || lower.includes('вакан')) return 'Вакансия не найдена.'
  if (lower.includes('unauthorized') || lower.includes('not authenticated')) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (lower.includes('forbidden') || lower.includes('доступ запрещ')) return 'Недостаточно прав для выполнения действия.'

  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 422) return 'Проверьте корректность данных.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback

  const status = error.response?.status
  const data = error.response?.data

  if (!error.response) return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'

  if (Array.isArray(data?.detail)) {
    const messages = data.detail.map((item) => translateApiMessage(item.msg || '', status)).filter(Boolean)
    return messages[0] || fallback
  }

  if (typeof data?.detail === 'string') return translateApiMessage(data.detail, status)

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error
    if (message) return translateApiMessage(message, status)
  }

  if (data?.message) return translateApiMessage(data.message, status)
  if (data?.error) return translateApiMessage(data.error, status)

  return fallback
}

const mapFavoriteItem = (
  item: FavoriteVacancyApiItem,
  resumesById: Map<number, ResumeItem>,
): FavoriteVacancyCard[] => {
  const vacancy = item.vacancy || {}

  const favoriteId = item.id ?? item.favorite_id ?? null
  const vacancyId = Number(item.vacancy_id ?? vacancy.id)

  if (!Number.isFinite(vacancyId) || vacancyId <= 0) return []

  const resumeInfos = Array.isArray(item.resumes) ? item.resumes : []
  const resumeIds = Array.isArray(item.resume_ids) ? item.resume_ids : []
  const directResumeId = item.resume_id ? [item.resume_id] : []

  const normalizedResumeIds = Array.from(
    new Set(
      [...resumeInfos.map((resume) => resume.id), ...resumeIds, ...directResumeId]
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  const geoIds = getGeoIdsFromItem(item)

  const cardBase = {
    favoriteId,
    vacancyId,
    title: item.title || vacancy.title || 'Вакансия',
    salaryMin: item.salary_min ?? vacancy.salary_min ?? null,
    salaryMax: item.salary_max ?? vacancy.salary_max ?? null,
    currency: item.currency || vacancy.currency || vacancy.currency_name || 'BYN',
    companyId: item.company_id ?? vacancy.company_id ?? null,
    companyName: item.company_name || vacancy.company_name || 'Компания',
    companyLogo: item.company_logo || null,
    cityName: getVacancyCityName(item),
    cityId: geoIds.cityId,
    regionId: geoIds.regionId,
    districtId: geoIds.districtId,
    professionName: item.profession_name || vacancy.profession_name || 'Профессия не указана',
    employmentType:
      item.employment_type ||
      item.employment_type_name ||
      vacancy.employment_type ||
      vacancy.employment_type_name ||
      'Тип занятости не указан',
    workSchedule:
      item.work_schedule ||
      item.work_schedule_name ||
      vacancy.work_schedule ||
      vacancy.work_schedule_name ||
      'График не указан',
    experience:
      item.experience ||
      item.experience_name ||
      vacancy.experience ||
      vacancy.experience_name ||
      'Опыт не указан',
    skills: normalizeSkills(item.skills || vacancy.skills),
    createdAt: item.created_at || vacancy.created_at || null,
    updatedAt: item.updated_at || vacancy.updated_at || null,
  }

  if (normalizedResumeIds.length === 0) {
    return [
      {
        ...cardBase,
        key: `${vacancyId}-no-resume-${favoriteId || 'x'}`,
        resumeId: null,
        resumeTitle: 'Резюме не указано',
      },
    ]
  }

  return normalizedResumeIds.map((resumeId) => {
    const resumeInfo = resumeInfos.find((resume) => resume.id === resumeId)
    const resumeFromList = resumesById.get(resumeId)

    return {
      ...cardBase,
      key: `${vacancyId}-${resumeId}`,
      resumeId,
      resumeTitle: getResumeTitle(resumeInfo || resumeFromList),
    }
  })
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`favorites-select__icon ${open ? 'is-open' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9L12 15L18 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type SelectProps = {
  label: string
  value: string
  placeholder: string
  options: ComboOption[]
  open: boolean
  onToggle: () => void
  onSelect: (option: ComboOption) => void
}

const Select = ({ label, value, placeholder, options, open, onToggle, onSelect }: SelectProps) => (
  <div className={`favorites-select ${open ? 'is-open' : ''}`}>
    <span className="favorites-filter-label">{label}</span>

    <button type="button" className={`favorites-select__trigger ${open ? 'is-open' : ''}`} onClick={onToggle} aria-expanded={open}>
      <span className={value ? 'has-value' : ''}>{value || placeholder}</span>
      <ChevronIcon open={open} />
    </button>

    {open ? (
      <div className="favorites-select__dropdown">
        {options.length > 0 ? (
          options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`favorites-select__option ${String(option.label) === value ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
            >
              {option.label}
            </button>
          ))
        ) : (
          <div className="favorites-select__empty">Нет вариантов</div>
        )}
      </div>
    ) : null}
  </div>
)

export const ApplicantFavoritesPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [resumeFilter, setResumeFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [districtFilter, setDistrictFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'new' | 'salary-desc' | 'salary-asc'>('new')
  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const resumesQuery = useQuery({
    queryKey: ['applicant-favorites-resumes'],
    queryFn: fetchMyResumes,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const favoritesQuery = useQuery({
    queryKey: ['applicant-favorite-vacancies'],
    queryFn: fetchFavorites,
    retry: false,
    refetchOnWindowFocus: false,
  })


  const regionsQuery = useQuery({
    queryKey: ['applicant-favorites-regions'],
    queryFn: () => fetchCatalog<RegionItem>('regions', 100),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const districtsQuery = useQuery({
    queryKey: ['applicant-favorites-districts'],
    queryFn: () => fetchCatalog<DistrictItem>('districts', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['applicant-favorites-cities'],
    queryFn: () => fetchCatalog<CityCatalogItem>('cities', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const removeMutation = useMutation({
    mutationFn: removeFavoriteVacancy,
    onSuccess: async () => {
      setNotice({ type: 'success', text: 'Вакансия удалена из избранного.' })
      await queryClient.invalidateQueries({ queryKey: ['applicant-favorite-vacancies'] })
      await queryClient.invalidateQueries({ queryKey: ['favorite-vacancy-state'] })
    },
    onError: (error) => {
      setNotice({ type: 'error', text: getErrorMessage(error, 'Не удалось удалить вакансию из избранного.') })
    },
  })

  const resumes = resumesQuery.data || []
  const resumesById = useMemo(() => new Map(resumes.map((resume) => [resume.id, resume])), [resumes])

  const favoriteCards = useMemo(() => {
    return (favoritesQuery.data || []).flatMap((item) => mapFavoriteItem(item, resumesById))
  }, [favoritesQuery.data, resumesById])

  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []
  const cities = citiesQuery.data || []

  const resumeOptions: ComboOption[] = useMemo(() => {
    return [
      { value: 'all', label: 'Все резюме' },
      ...resumes.map((resume) => ({ value: resume.id, label: getResumeTitle(resume) })),
    ]
  }, [resumes])

  const regionOptions: ComboOption[] = useMemo(() => {
    return [{ value: 'all', label: 'Все области' }, ...regions.map((region) => ({ value: region.id, label: region.name }))]
  }, [regions])

  const filteredDistricts = useMemo(() => {
    if (regionFilter === 'all') return districts
    return districts.filter((district) => String(district.region_id) === String(regionFilter))
  }, [districts, regionFilter])

  const districtOptions: ComboOption[] = useMemo(() => {
    return [
      { value: 'all', label: 'Все районы' },
      ...filteredDistricts.map((district) => ({ value: district.id, label: getDistrictDisplayName(district) })),
    ]
  }, [filteredDistricts])

  const filteredCatalogCities = useMemo(() => {
    return cities.filter((city) => {
      const matchesRegion = regionFilter === 'all' || String(city.region_id) === String(regionFilter)
      const matchesDistrict = districtFilter === 'all' || String(city.district_id) === String(districtFilter)
      return matchesRegion && matchesDistrict
    })
  }, [cities, regionFilter, districtFilter])

  const cityOptions: ComboOption[] = useMemo(() => {
    const catalogOptions = filteredCatalogCities.map((city) => ({
      value: city.id,
      label: getCityDisplayName(city),
    }))

    const fallbackOptions = favoriteCards
      .filter((item) => item.cityName && !catalogOptions.some((option) => option.label === item.cityName))
      .map((item) => ({ value: item.cityName, label: item.cityName }))

    const uniqueOptions = Array.from(
      new Map([...catalogOptions, ...fallbackOptions].map((option) => [String(option.value), option])).values(),
    ).sort((a, b) => a.label.localeCompare(b.label, 'ru'))

    return [{ value: 'all', label: 'Все города' }, ...uniqueOptions]
  }, [favoriteCards, filteredCatalogCities])

  const sortOptions: ComboOption[] = [
    { value: 'new', label: 'Сначала новые' },
    { value: 'salary-desc', label: 'Зарплата по убыванию' },
    { value: 'salary-asc', label: 'Зарплата по возрастанию' },
  ]

  const selectedResumeLabel = resumeOptions.find((option) => String(option.value) === String(resumeFilter))?.label || ''
  const selectedRegionLabel = regionOptions.find((option) => String(option.value) === String(regionFilter))?.label || ''
  const selectedDistrictLabel = districtOptions.find((option) => String(option.value) === String(districtFilter))?.label || ''
  const selectedCityLabel = cityOptions.find((option) => String(option.value) === String(cityFilter))?.label || ''
  const selectedSortLabel = sortOptions.find((option) => option.value === sortBy)?.label || 'Сначала новые'

  const filteredFavorites = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    const filtered = favoriteCards.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [item.title, item.companyName, item.cityName, item.professionName, item.resumeTitle, ...item.skills]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      const matchesResume = resumeFilter === 'all' || String(item.resumeId) === String(resumeFilter)
      const matchesRegion = regionFilter === 'all' || String(item.regionId) === String(regionFilter)
      const matchesDistrict = districtFilter === 'all' || String(item.districtId) === String(districtFilter)
      const matchesCity =
        cityFilter === 'all' ||
        String(item.cityId) === String(cityFilter) ||
        item.cityName === cityFilter ||
        selectedCityLabel === item.cityName

      return matchesSearch && matchesResume && matchesRegion && matchesDistrict && matchesCity
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'salary-desc') return (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0)
      if (sortBy === 'salary-asc') return (a.salaryMin || a.salaryMax || 0) - (b.salaryMin || b.salaryMax || 0)

      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      return bTime - aTime
    })
  }, [cityFilter, districtFilter, favoriteCards, regionFilter, resumeFilter, search, selectedCityLabel, sortBy])

  const groupedFavorites = useMemo(() => {
    const groups = new Map<string, FavoriteVacancyCard[]>()

    filteredFavorites.forEach((item) => {
      const key = item.resumeTitle || 'Резюме не указано'
      const current = groups.get(key) || []
      groups.set(key, [...current, item])
    })

    return Array.from(groups.entries())
  }, [filteredFavorites])

  const isLoading = favoritesQuery.isLoading || resumesQuery.isLoading
  const isError = favoritesQuery.isError || resumesQuery.isError

  const handleResetFilters = () => {
    setSearch('')
    setResumeFilter('all')
    setRegionFilter('all')
    setDistrictFilter('all')
    setCityFilter('all')
    setSortBy('new')
    setOpenSelect(null)
  }

  const handleRemove = async (item: FavoriteVacancyCard) => {
    if (!item.resumeId) {
      setNotice({ type: 'error', text: 'У этой записи не найдено резюме. Обновите страницу или проверьте данные.' })
      return
    }

    await removeMutation.mutateAsync({ vacancyId: item.vacancyId, resumeId: item.resumeId })
  }

  return (
    <div className="favorites-page">
      <Header />

      <main className="favorites-page__main">
        <section className="favorites-catalog">
          <div className="favorites-container">
            <div className="favorites-layout">
              <aside className="favorites-sidebar">
                <div className="favorites-filter-card">
                  <div className="favorites-filter-card__header">
                    <div>
                      <h2>Фильтры</h2>
                      <p>Быстро найдите нужную вакансию среди сохранённых.</p>
                    </div>

                    <button type="button" onClick={handleResetFilters}>Сбросить</button>
                  </div>

                  <label className="favorites-search-field">
                    <span className="favorites-filter-label">Поиск</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Вакансия, компания, город, навык"
                    />
                  </label>

                  <Select
                    label="Резюме"
                    value={selectedResumeLabel}
                    placeholder="Все резюме"
                    options={resumeOptions}
                    open={openSelect === 'resume'}
                    onToggle={() => setOpenSelect((prev) => (prev === 'resume' ? null : 'resume'))}
                    onSelect={(option) => {
                      setResumeFilter(String(option.value))
                      setOpenSelect(null)
                    }}
                  />

                  <Select
                    label="Область"
                    value={selectedRegionLabel}
                    placeholder="Все области"
                    options={regionOptions}
                    open={openSelect === 'region'}
                    onToggle={() => setOpenSelect((prev) => (prev === 'region' ? null : 'region'))}
                    onSelect={(option) => {
                      setRegionFilter(String(option.value))
                      setDistrictFilter('all')
                      setCityFilter('all')
                      setOpenSelect(null)
                    }}
                  />

                  <Select
                    label="Район"
                    value={selectedDistrictLabel}
                    placeholder="Все районы"
                    options={districtOptions}
                    open={openSelect === 'district'}
                    onToggle={() => setOpenSelect((prev) => (prev === 'district' ? null : 'district'))}
                    onSelect={(option) => {
                      setDistrictFilter(String(option.value))
                      setCityFilter('all')
                      setOpenSelect(null)
                    }}
                  />

                  <Select
                    label="Город / населённый пункт"
                    value={selectedCityLabel}
                    placeholder="Все города"
                    options={cityOptions}
                    open={openSelect === 'city'}
                    onToggle={() => setOpenSelect((prev) => (prev === 'city' ? null : 'city'))}
                    onSelect={(option) => {
                      setCityFilter(String(option.value))
                      setOpenSelect(null)
                    }}
                  />

                  <Select
                    label="Сортировка"
                    value={selectedSortLabel}
                    placeholder="Сначала новые"
                    options={sortOptions}
                    open={openSelect === 'sort'}
                    onToggle={() => setOpenSelect((prev) => (prev === 'sort' ? null : 'sort'))}
                    onSelect={(option) => {
                      setSortBy(option.value as 'new' | 'salary-desc' | 'salary-asc')
                      setOpenSelect(null)
                    }}
                  />
                </div>
              </aside>

              <section className="favorites-content">
                <div className="favorites-content__head">
                  <div><h2>Избранное</h2></div>
                  <div className="favorites-found">Найдено: <strong>{filteredFavorites.length}</strong></div>
                </div>

                {notice ? (
                  <div className={`favorites-notice ${notice.type === 'success' ? 'favorites-notice--success' : 'favorites-notice--error'}`}>{notice.text}</div>
                ) : null}

                {isLoading ? (
                  <div className="favorites-grid">
                    {Array.from({ length: 4 }, (_, index) => <div key={index} className="favorite-card favorite-card--skeleton" />)}
                  </div>
                ) : null}

                {isError ? (
                  <div className="favorites-empty favorites-empty--error">
                    <h3>Не удалось загрузить избранное</h3>
                    <p>Проверьте соединение с сервером или попробуйте обновить страницу.</p>
                    <button type="button" onClick={() => favoritesQuery.refetch()}>Повторить</button>
                  </div>
                ) : null}

                {!isLoading && !isError && favoriteCards.length === 0 ? (
                  <div className="favorites-empty">
                    <h3>В избранном пока пусто</h3>
                    <p>Откройте карточку вакансии и нажмите на сердечко, чтобы сохранить предложение к нужному резюме.</p>
                    <button type="button" onClick={() => navigate('/vacancies')}>Смотреть вакансии</button>
                  </div>
                ) : null}

                {!isLoading && !isError && favoriteCards.length > 0 && filteredFavorites.length === 0 ? (
                  <div className="favorites-empty">
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить поисковый запрос или сбросить фильтры.</p>
                    <button type="button" onClick={handleResetFilters}>Сбросить фильтры</button>
                  </div>
                ) : null}

                {!isLoading && !isError && groupedFavorites.length > 0 ? (
                  <div className="favorites-groups">
                    {groupedFavorites.map(([resumeTitle, items]) => (
                      <section key={resumeTitle} className="favorites-group">
                        <div className="favorites-group__head"><h3>{resumeTitle}</h3></div>

                        <div className="favorites-grid">
                          {items.map((item) => (
                            <article key={item.key} className="favorite-card">
                              <div className="favorite-card__top">
                                <div className="favorite-card__company">
                                  {item.companyLogo ? <img src={item.companyLogo} alt={item.companyName} /> : <div className="favorite-card__logo-placeholder">{item.companyName.slice(0, 1).toUpperCase()}</div>}

                                  <div>
                                    <Link to={item.companyId ? `/companies/${item.companyId}` : `/vacancies/${item.vacancyId}`} className="favorite-card__company-name">
                                      {item.companyName}
                                    </Link>
                                    <span className="favorite-card__company-city" title={item.cityName}>{item.cityName}</span>
                                  </div>
                                </div>

                                <button type="button" className="favorite-card__remove" onClick={() => handleRemove(item)} disabled={removeMutation.isPending} title="Удалить из избранного" aria-label="Удалить из избранного">×</button>
                              </div>

                              <div className="favorite-card__body">
                                <Link to={`/vacancies/${item.vacancyId}`} className="favorite-card__title">{item.title}</Link>

                                <div className="favorite-card__salary">{formatSalary(item.salaryMin, item.salaryMax, item.currency)}</div>

                                <div className="favorite-card__meta">
                                  <span>{item.professionName}</span>
                                  <span>{item.employmentType}</span>
                                  <span>{item.workSchedule}</span>
                                  <span>{item.experience}</span>
                                </div>

                                {item.skills.length > 0 ? (
                                  <div className="favorite-card__skills">
                                    {item.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}
                                    {item.skills.length > 5 ? <span className="favorite-card__skill-more">+{item.skills.length - 5}</span> : null}
                                  </div>
                                ) : (
                                  <p className="favorite-card__empty-text">Навыки не указаны</p>
                                )}
                              </div>

                              <div className="favorite-card__bottom">
                                <span>Добавлено: {formatDate(item.createdAt || item.updatedAt)}</span>
                                <Link to={`/vacancies/${item.vacancyId}`}>Подробнее</Link>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
