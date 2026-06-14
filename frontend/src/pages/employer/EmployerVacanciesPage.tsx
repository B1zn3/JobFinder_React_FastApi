import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './employer-vacancies.css'

type CatalogItem = {
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

type NamedEntity = {
  id: number
  name: string
  full_name?: string | null
  region_name?: string | null
  district_name?: string | null
  settlement_type_name?: string | null
}

type VacancyListItem = {
  id: number
  title: string
  description?: string | null

  profession_id?: number | null
  city_id?: number | null
  employment_type_id?: number | null
  work_schedule_id?: number | null
  currency_id?: number | null
  experience_id?: number | null
  status_id?: number | null
  company_id?: number | null

  profession?: NamedEntity | null
  city?: NamedEntity | null
  employment_type?: NamedEntity | null
  work_schedule?: NamedEntity | null
  currency?: NamedEntity | null
  experience?: NamedEntity | null
  status?: NamedEntity | null

  profession_name?: string | null
  city_name?: string | null
  currency_name?: string | null
  status_name?: string | null

  salary_min?: number | null
  salary_max?: number | null

  created_at?: string | null
  updated_at?: string | null
}

type CompanyProfile = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies?: VacancyListItem[]
}

type VacancyStatusFilter = 'all' | 'active' | 'archived' | 'other'

type SalaryFilter = 'all' | 'with-salary' | 'without-salary'

type SortMode = 'updated-desc' | 'updated-asc' | 'title-asc' | 'salary-desc'

type FilterOption = {
  value: string | number
  label: string
}

const PAGE_SIZE_OPTIONS = [3, 4, 8, 12]

const getDefaultPageSize = () => {
  if (typeof window === 'undefined') return 4
  if (window.innerWidth <= 560) return 3
  return 4
}

const toArray = <T,>(value: unknown): T[] => {
  return Array.isArray(value) ? value : []
}

const fetchCompanyProfile = async (): Promise<CompanyProfile | null> => {
  const { data } = await http.get('/companies/me')
  return data || null
}

const fetchVacancies = async (): Promise<VacancyListItem[]> => {
  const { data } = await http.get('/companies/me/vacancies', {
    params: { skip: 0, limit: 100 },
  })

  return toArray<VacancyListItem>(data)
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/public/catalogs/${name}`, {
    params: { skip: 0, limit: name === 'cities' ? 1000 : 500 },
  })

  return toArray<Record<string, unknown>>(data).map((item) => ({
    id: Number(item.id || 0),
    name: String(item.name || 'Без названия'),
    full_name: typeof item.full_name === 'string' ? item.full_name : null,
    region_id: item.region_id ? Number(item.region_id) : null,
    region_name: typeof item.region_name === 'string' ? item.region_name : null,
    district_id: item.district_id ? Number(item.district_id) : null,
    district_name: typeof item.district_name === 'string' ? item.district_name : null,
    settlement_type_id: item.settlement_type_id ? Number(item.settlement_type_id) : null,
    settlement_type_name: typeof item.settlement_type_name === 'string' ? item.settlement_type_name : null,
  }))
}

const fetchProfessions = async (): Promise<CatalogItem[]> => {
  const { data } = await http.get('/public/professions', {
    params: { skip: 0, limit: 100 },
  })

  return toArray<CatalogItem>(data)
}

const deleteVacancy = async (vacancyId: number) => {
  await http.delete(`/companies/me/vacancies/${vacancyId}`)
}

const updateVacancyStatus = async (params: { vacancyId: number; statusId: number }) => {
  const { data } = await http.put(`/companies/me/vacancies/${params.vacancyId}`, {
    status_id: params.statusId,
  })

  return data
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Дата не указана'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Дата не указана'

  return date.toLocaleDateString('ru-RU')
}

const formatSalary = (
  min?: number | null,
  max?: number | null,
  currency = 'BYN',
) => {
  const salaryMin = Number(min || 0)
  const salaryMax = Number(max || 0)

  if (salaryMin <= 0 && salaryMax <= 0) return 'Зарплата не указана'

  if (salaryMin > 0 && salaryMax > 0 && salaryMin === salaryMax) {
    return `${salaryMin.toLocaleString('ru-RU')} ${currency}`
  }

  if (salaryMin > 0 && salaryMax > 0) {
    return `${salaryMin.toLocaleString('ru-RU')}–${salaryMax.toLocaleString('ru-RU')} ${currency}`
  }

  if (salaryMin > 0) return `от ${salaryMin.toLocaleString('ru-RU')} ${currency}`
  if (salaryMax > 0) return `до ${salaryMax.toLocaleString('ru-RU')} ${currency}`

  return 'Зарплата не указана'
}

const getCatalogDisplayName = (item?: CatalogItem | NamedEntity | null) => {
  if (!item) return ''

  if (item.full_name) return item.full_name

  const parts = [
    item.settlement_type_name ? `${item.settlement_type_name} ${item.name}` : item.name,
    item.district_name,
    item.region_name,
  ].filter(Boolean)

  return parts.join(', ')
}

const getNameFromCatalog = (
  id: number | null | undefined,
  catalog: CatalogItem[],
) => {
  if (!id) return ''
  const item = catalog.find((catalogItem) => catalogItem.id === id)
  return getCatalogDisplayName(item)
}

const getVacancyProfession = (
  vacancy: VacancyListItem,
  professions: CatalogItem[],
) => {
  return (
    vacancy.profession?.name ||
    vacancy.profession_name ||
    getNameFromCatalog(vacancy.profession_id, professions) ||
    'Профессия не указана'
  )
}

const getVacancyCityCatalogItem = (
  vacancy: VacancyListItem,
  cities: CatalogItem[],
) => {
  const cityId = vacancy.city_id || vacancy.city?.id

  if (!cityId) return null

  return cities.find((item) => item.id === cityId) || null
}

const getVacancyCity = (
  vacancy: VacancyListItem,
  cities: CatalogItem[],
) => {
  return (
    getCatalogDisplayName(vacancy.city) ||
    vacancy.city_name ||
    getCatalogDisplayName(getVacancyCityCatalogItem(vacancy, cities)) ||
    'Город не указан'
  )
}

const getVacancyRegion = (
  vacancy: VacancyListItem,
  cities: CatalogItem[],
) => {
  const city = getVacancyCityCatalogItem(vacancy, cities)

  return city?.region_name || vacancy.city?.region_name || ''
}

const getVacancyDistrict = (
  vacancy: VacancyListItem,
  cities: CatalogItem[],
) => {
  const city = getVacancyCityCatalogItem(vacancy, cities)

  return city?.district_name || vacancy.city?.district_name || ''
}

const getVacancyCurrency = (
  vacancy: VacancyListItem,
  currencies: CatalogItem[],
) => {
  return (
    vacancy.currency?.name ||
    vacancy.currency_name ||
    getNameFromCatalog(vacancy.currency_id, currencies) ||
    'BYN'
  )
}

const getVacancyStatus = (
  vacancy: VacancyListItem,
  statuses: CatalogItem[],
) => {
  return (
    vacancy.status?.name ||
    vacancy.status_name ||
    getNameFromCatalog(vacancy.status_id, statuses) ||
    'Активна'
  )
}

const getStatusModifier = (status: string) => {
  const value = status.toLowerCase()

  if (value.includes('архив') || value.includes('archive')) return 'archived'
  if (value.includes('чернов') || value.includes('draft')) return 'draft'
  if (value.includes('модера') || value.includes('review')) return 'review'
  if (value.includes('отклон') || value.includes('reject')) return 'rejected'

  return 'active'
}

const getStatusFilterValue = (status: string): VacancyStatusFilter => {
  const modifier = getStatusModifier(status)

  if (modifier === 'active' || modifier === 'review') return 'active'
  if (modifier === 'archived') return 'archived'

  return 'other'
}

const findActiveStatusId = (statuses: CatalogItem[]) => {
  return (
    statuses.find((item) => item.name.toLowerCase().includes('актив'))?.id ||
    statuses.find((item) => item.name.toLowerCase().includes('active'))?.id ||
    1
  )
}

const findArchivedStatusId = (statuses: CatalogItem[]) => {
  return (
    statuses.find((item) => item.name.toLowerCase().includes('архив'))?.id ||
    statuses.find((item) => item.name.toLowerCase().includes('archive'))?.id ||
    2
  )
}

const getCompanyInitials = (profile?: CompanyProfile | null) => {
  const name = profile?.name?.trim()

  if (!name) return 'C'

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const truncateText = (text?: string | null, limit = 150) => {
  const value = text?.trim()

  if (!value) return 'Описание не заполнено.'

  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value
}

const DotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
)

const FilterChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`employer-filter-select__chevron ${open ? 'is-open' : ''}`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type FilterSelectProps = {
  id: string
  value: string | number
  options: FilterOption[]
  isOpen: boolean
  placeholder?: string
  onToggle: (id: string) => void
  onChange: (value: string | number) => void
}

const FilterSelect = ({
  id,
  value,
  options,
  isOpen,
  placeholder = 'Выберите',
  onToggle,
  onChange,
}: FilterSelectProps) => {
  const selectedOption = options.find((option) => String(option.value) === String(value))

  return (
    <div className={`employer-filter-select ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`employer-filter-select__button ${isOpen ? 'is-open' : ''}`}
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span
          className={
            selectedOption
              ? 'employer-filter-select__value'
              : 'employer-filter-select__placeholder'
          }
        >
          {selectedOption?.label || placeholder}
        </span>

        <FilterChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="employer-filter-select__dropdown">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`employer-filter-select__option ${
                String(option.value) === String(value) ? 'is-active' : ''
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value)
                onToggle('')
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const EmployerVacanciesPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [openFilterId, setOpenFilterId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(getDefaultPageSize)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VacancyStatusFilter>('all')
  const [professionFilter, setProfessionFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [salaryFilter, setSalaryFilter] = useState<SalaryFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc')
  const [notice, setNotice] = useState('')

  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleResize = () => {
      setPageSize(getDefaultPageSize())
      setCurrentPage(1)
      setOpenMenuId(null)
      setOpenFilterId(null)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return

      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleClickOutsideFilter = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.employer-filter-select')) {
        setOpenFilterId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutsideFilter)
    return () => document.removeEventListener('mousedown', handleClickOutsideFilter)
  }, [])

  const profileQuery = useQuery({
    queryKey: ['employer-profile'],
    queryFn: fetchCompanyProfile,
    retry: false,
  })

  const vacanciesQuery = useQuery({
    queryKey: ['employer-vacancies'],
    queryFn: fetchVacancies,
    retry: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['employer-professions'],
    queryFn: fetchProfessions,
    retry: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['employer-cities'],
    queryFn: () => fetchCatalog('cities'),
    retry: false,
  })

  const currenciesQuery = useQuery({
    queryKey: ['employer-currencies'],
    queryFn: () => fetchCatalog('currencies'),
    retry: false,
  })

  const statusesQuery = useQuery({
    queryKey: ['employer-statuses'],
    queryFn: () => fetchCatalog('statuses'),
    retry: false,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVacancy,
    onSuccess: async () => {
      setOpenMenuId(null)
      setNotice('Вакансия удалена.')

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
      ])
    },
    onError: () => {
      setNotice('Не удалось удалить вакансию.')
    },
  })

  const statusMutation = useMutation({
    mutationFn: updateVacancyStatus,
    onSuccess: async () => {
      setOpenMenuId(null)
      setNotice('Статус вакансии обновлён.')

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
      ])
    },
    onError: () => {
      setNotice('Не удалось изменить статус вакансии. Проверьте статус “Архив” в справочнике.')
    },
  })

  const profile = profileQuery.data
  const rawVacancies = vacanciesQuery.data || profileQuery.data?.vacancies || []
  const professions = professionsQuery.data || []
  const cities = citiesQuery.data || []
  const currencies = currenciesQuery.data || []
  const statuses = statusesQuery.data || []

  const vacancies = useMemo(() => {
    return rawVacancies.filter((vacancy) => {
      const vacancyStatus = getVacancyStatus(vacancy, statuses).toLowerCase()

      return (
        !vacancyStatus.includes('удален') &&
        !vacancyStatus.includes('удалена') &&
        !vacancyStatus.includes('deleted')
      )
    })
  }, [rawVacancies, statuses])

  const professionOptions = useMemo(() => {
    const map = new Map<string, string>()

    vacancies.forEach((vacancy) => {
      const name = getVacancyProfession(vacancy, professions)
      if (name && name !== 'Профессия не указана') map.set(name, name)
    })

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [vacancies, professions])

  const regionOptions = useMemo(() => {
    const map = new Map<string, string>()

    vacancies.forEach((vacancy) => {
      const name = getVacancyRegion(vacancy, cities)
      if (name) map.set(name, name)
    })

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [vacancies, cities])

  const districtOptions = useMemo(() => {
    const map = new Map<string, string>()

    vacancies.forEach((vacancy) => {
      const region = getVacancyRegion(vacancy, cities)
      const district = getVacancyDistrict(vacancy, cities)

      if (regionFilter !== 'all' && region !== regionFilter) return
      if (district) map.set(district, district)
    })

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [vacancies, cities, regionFilter])

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>()

    vacancies.forEach((vacancy) => {
      const region = getVacancyRegion(vacancy, cities)
      const district = getVacancyDistrict(vacancy, cities)
      const name = getVacancyCity(vacancy, cities)

      if (regionFilter !== 'all' && region !== regionFilter) return
      if (districtFilter !== 'all' && district !== districtFilter) return
      if (name && name !== 'Город не указан') map.set(name, name)
    })

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [vacancies, cities, regionFilter, districtFilter])

  const filteredVacancies = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    const result = vacancies.filter((vacancy) => {
      const profession = getVacancyProfession(vacancy, professions)
      const city = getVacancyCity(vacancy, cities)
      const region = getVacancyRegion(vacancy, cities)
      const district = getVacancyDistrict(vacancy, cities)
      const status = getVacancyStatus(vacancy, statuses)
      const salaryMin = Number(vacancy.salary_min || 0)
      const salaryMax = Number(vacancy.salary_max || 0)
      const hasSalary = salaryMin > 0 || salaryMax > 0

      const searchableText = [
        vacancy.title,
        vacancy.description,
        profession,
        city,
        region,
        district,
        status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (searchValue && !searchableText.includes(searchValue)) return false

      if (statusFilter !== 'all' && getStatusFilterValue(status) !== statusFilter) {
        return false
      }

      if (professionFilter !== 'all' && profession !== professionFilter) {
        return false
      }

      if (regionFilter !== 'all' && region !== regionFilter) {
        return false
      }

      if (districtFilter !== 'all' && district !== districtFilter) {
        return false
      }

      if (cityFilter !== 'all' && city !== cityFilter) {
        return false
      }

      if (salaryFilter === 'with-salary' && !hasSalary) return false
      if (salaryFilter === 'without-salary' && hasSalary) return false

      return true
    })

    result.sort((a, b) => {
      if (sortMode === 'title-asc') {
        return a.title.localeCompare(b.title, 'ru')
      }

      if (sortMode === 'salary-desc') {
        const aSalary = Math.max(Number(a.salary_min || 0), Number(a.salary_max || 0))
        const bSalary = Math.max(Number(b.salary_min || 0), Number(b.salary_max || 0))
        return bSalary - aSalary
      }

      const aDate = new Date(a.updated_at || a.created_at || 0).getTime()
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime()

      if (sortMode === 'updated-asc') return aDate - bDate

      return bDate - aDate
    })

    return result
  }, [
    vacancies,
    professions,
    cities,
    statuses,
    search,
    statusFilter,
    professionFilter,
    regionFilter,
    districtFilter,
    cityFilter,
    salaryFilter,
    sortMode,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, professionFilter, regionFilter, districtFilter, cityFilter, salaryFilter, sortMode, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredVacancies.length / pageSize))

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const paginatedVacancies = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredVacancies.slice(start, start + pageSize)
  }, [filteredVacancies, currentPage, pageSize])

  const paginationPages = useMemo(() => {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }, [totalPages])

  const hasPagination = filteredVacancies.length > pageSize

  const activeCount = useMemo(() => {
    return vacancies.filter((vacancy) => {
      const status = getVacancyStatus(vacancy, statuses)
      return getStatusFilterValue(status) === 'active'
    }).length
  }, [vacancies, statuses])

  const archivedCount = useMemo(() => {
    return vacancies.filter((vacancy) => {
      const status = getVacancyStatus(vacancy, statuses)
      return getStatusFilterValue(status) === 'archived'
    }).length
  }, [vacancies, statuses])

  const toggleFilter = (id: string) => {
    setOpenFilterId((prev) => (prev === id || !id ? null : id))
  }

  useEffect(() => {
    setDistrictFilter('all')
    setCityFilter('all')
  }, [regionFilter])

  useEffect(() => {
    setCityFilter('all')
  }, [districtFilter])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setProfessionFilter('all')
    setRegionFilter('all')
    setDistrictFilter('all')
    setCityFilter('all')
    setSalaryFilter('all')
    setSortMode('updated-desc')
    setCurrentPage(1)
    setOpenFilterId(null)
  }

  const handleArchiveToggle = (vacancy: VacancyListItem) => {
    const status = getVacancyStatus(vacancy, statuses)
    const isArchived = getStatusFilterValue(status) === 'archived'
    const statusId = isArchived ? findActiveStatusId(statuses) : findArchivedStatusId(statuses)

    statusMutation.mutate({
      vacancyId: vacancy.id,
      statusId,
    })
  }

  const statusFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все' },
    { value: 'active', label: 'Активные' },
    { value: 'archived', label: 'Архив' },
  ]

  const professionFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все профессии' },
    ...professionOptions.map((item) => ({
      value: item,
      label: item,
    })),
  ]

  const regionFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все области' },
    ...regionOptions.map((item) => ({
      value: item,
      label: item,
    })),
  ]

  const districtFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все районы' },
    ...districtOptions.map((item) => ({
      value: item,
      label: item,
    })),
  ]

  const cityFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все города' },
    ...cityOptions.map((item) => ({
      value: item,
      label: item,
    })),
  ]

  const salaryFilterOptions: FilterOption[] = [
    { value: 'all', label: 'Все' },
    { value: 'with-salary', label: 'С зарплатой' },
    { value: 'without-salary', label: 'Без зарплаты' },
  ]

  const sortModeOptions: FilterOption[] = [
    { value: 'updated-desc', label: 'Сначала новые' },
    { value: 'updated-asc', label: 'Сначала старые' },
    { value: 'title-asc', label: 'По названию' },
    { value: 'salary-desc', label: 'По зарплате' },
  ]

  const pageSizeOptions: FilterOption[] = PAGE_SIZE_OPTIONS.map((item) => ({
    value: item,
    label: String(item),
  }))

  return (
    <div className="employer-page">
      <Header />

      <main className="employer-page__main">
        <section className="employer-dashboard">
          <div className="container">
            <div className="employer-dashboard__layout">
              <section className="employer-dashboard__main-column">
                <div className="employer-card employer-card--main">
                  <div className="employer-card__head">
                    <div>
                      <h1 className="employer-card__title">Мои вакансии</h1>

                    </div>

                    <button
                      type="button"
                      className="btn btn--primary employer-card__create-btn"
                      onClick={() => navigate('/employer/vacancies/create')}
                    >
                      Создать вакансию
                    </button>
                  </div>

                  <div className="employer-stats">
                    <article className="employer-stat">
                      <span>Всего вакансий</span>
                      <strong>{vacancies.length}</strong>
                    </article>

                    <article className="employer-stat">
                      <span>Активные</span>
                      <strong>{activeCount}</strong>
                    </article>

                    <article className="employer-stat">
                      <span>В архиве</span>
                      <strong>{archivedCount}</strong>
                    </article>
                  </div>

                  {notice ? <div className="employer-notice">{notice}</div> : null}

                  <div className="employer-toolbar">
                    <div className="employer-toolbar__header">
                      <div>
                        <h3 className="employer-toolbar__title">Поиск и фильтры</h3>
                      </div>
                    </div>

                    <div className="employer-toolbar__grid">
                      <label className="employer-filter-field employer-filter-field--search">
                        <span>Поиск</span>

                        <div className="employer-filter-search">
                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Название, профессия, область, район, город или описание"
                          />
                        </div>
                      </label>

                      <label className="employer-filter-field">
                        <span>Статус</span>

                        <FilterSelect
                          id="status"
                          value={statusFilter}
                          options={statusFilterOptions}
                          isOpen={openFilterId === 'status'}
                          onToggle={toggleFilter}
                          onChange={(value) => setStatusFilter(value as VacancyStatusFilter)}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Профессия</span>

                        <FilterSelect
                          id="profession"
                          value={professionFilter}
                          options={professionFilterOptions}
                          isOpen={openFilterId === 'profession'}
                          onToggle={toggleFilter}
                          onChange={(value) => setProfessionFilter(String(value))}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Область</span>

                        <FilterSelect
                          id="region"
                          value={regionFilter}
                          options={regionFilterOptions}
                          isOpen={openFilterId === 'region'}
                          onToggle={toggleFilter}
                          onChange={(value) => setRegionFilter(String(value))}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Район</span>

                        <FilterSelect
                          id="district"
                          value={districtFilter}
                          options={districtFilterOptions}
                          isOpen={openFilterId === 'district'}
                          onToggle={toggleFilter}
                          onChange={(value) => setDistrictFilter(String(value))}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Город</span>

                        <FilterSelect
                          id="city"
                          value={cityFilter}
                          options={cityFilterOptions}
                          isOpen={openFilterId === 'city'}
                          onToggle={toggleFilter}
                          onChange={(value) => setCityFilter(String(value))}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Зарплата</span>

                        <FilterSelect
                          id="salary"
                          value={salaryFilter}
                          options={salaryFilterOptions}
                          isOpen={openFilterId === 'salary'}
                          onToggle={toggleFilter}
                          onChange={(value) => setSalaryFilter(value as SalaryFilter)}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>Сортировка</span>

                        <FilterSelect
                          id="sort"
                          value={sortMode}
                          options={sortModeOptions}
                          isOpen={openFilterId === 'sort'}
                          onToggle={toggleFilter}
                          onChange={(value) => setSortMode(value as SortMode)}
                        />
                      </label>

                      <label className="employer-filter-field">
                        <span>На странице</span>

                        <FilterSelect
                          id="pageSize"
                          value={pageSize}
                          options={pageSizeOptions}
                          isOpen={openFilterId === 'pageSize'}
                          onToggle={toggleFilter}
                          onChange={(value) => setPageSize(Number(value))}
                        />
                      </label>
                    </div>

                    <div className="employer-toolbar__footer">
                      <div className="employer-toolbar__result">
                        <span className="employer-toolbar__result-label">Найдено</span>
                        <strong>{filteredVacancies.length}</strong>
                      </div>

                      <button
                        type="button"
                        className="employer-reset-btn"
                        onClick={resetFilters}
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  </div>

                  {vacanciesQuery.isLoading && (
                    <div className="vacancy-list">
                      <div className="vacancy-item vacancy-item--skeleton" />
                      <div className="vacancy-item vacancy-item--skeleton" />
                      <div className="vacancy-item vacancy-item--skeleton" />
                      <div className="vacancy-item vacancy-item--skeleton" />
                    </div>
                  )}

                  {vacanciesQuery.isError && (
                    <div className="employer-empty">
                      Не удалось загрузить список вакансий.
                    </div>
                  )}

                  {!vacanciesQuery.isLoading &&
                    !vacanciesQuery.isError &&
                    vacancies.length === 0 && (
                      <div className="employer-empty">
                        <h3>У компании пока нет вакансий</h3>
                        <p>Создайте первую вакансию, чтобы начать получать отклики.</p>
                      </div>
                    )}

                  {!vacanciesQuery.isLoading &&
                    !vacanciesQuery.isError &&
                    vacancies.length > 0 &&
                    filteredVacancies.length === 0 && (
                      <div className="employer-empty">
                        <h3>Ничего не найдено</h3>
                        <p>Измените поисковый запрос или сбросьте фильтры.</p>
                      </div>
                    )}

                  {!vacanciesQuery.isLoading &&
                    !vacanciesQuery.isError &&
                    filteredVacancies.length > 0 && (
                      <>
                        <div className="vacancy-list">
                          {paginatedVacancies.map((vacancy) => {
                            const profession = getVacancyProfession(vacancy, professions)
                            const city = getVacancyCity(vacancy, cities)
                            const currency = getVacancyCurrency(vacancy, currencies)
                            const status = getVacancyStatus(vacancy, statuses)
                            const statusModifier = getStatusModifier(status)
                            const isArchived = getStatusFilterValue(status) === 'archived'

                            return (
                              <article key={vacancy.id} className="vacancy-item">
                                <div className="vacancy-item__top">
                                  <div className="vacancy-item__title-wrap">
                                    <div
                                      className={`vacancy-item__status vacancy-item__status--${statusModifier}`}
                                    >
                                      {status}
                                    </div>

                                    <h2>{vacancy.title}</h2>

                                    <div className="vacancy-item__meta">
                                      {profession} · {city}
                                    </div>
                                  </div>

                                  <div
                                    className="vacancy-item__menu-wrap"
                                    ref={openMenuId === vacancy.id ? menuRef : null}
                                  >
                                    <button
                                      type="button"
                                      className="vacancy-item__menu-trigger"
                                      aria-label="Открыть меню вакансии"
                                      onClick={() =>
                                        setOpenMenuId((prev) =>
                                          prev === vacancy.id ? null : vacancy.id,
                                        )
                                      }
                                    >
                                      <DotsIcon />
                                    </button>

                                    {openMenuId === vacancy.id && (
                                      <div className="vacancy-item__menu">
                                        <button
                                          type="button"
                                          className="vacancy-item__menu-btn"
                                          onClick={() => handleArchiveToggle(vacancy)}
                                          disabled={statusMutation.isPending}
                                        >
                                          {isArchived ? 'Вернуть из архива' : 'В архив'}
                                        </button>

                                        <button
                                          type="button"
                                          className="vacancy-item__menu-btn vacancy-item__menu-btn--danger"
                                          onClick={() => deleteMutation.mutate(vacancy.id)}
                                          disabled={deleteMutation.isPending}
                                        >
                                          {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <p className="vacancy-item__description">
                                  {truncateText(vacancy.description)}
                                </p>

                                <div className="vacancy-item__bottom">
                                  <div className="vacancy-item__salary">
                                    {formatSalary(vacancy.salary_min, vacancy.salary_max, currency)}
                                  </div>

                                  <div className="vacancy-item__date">
                                    Обновлено {formatDate(vacancy.updated_at || vacancy.created_at)}
                                  </div>
                                </div>

                                <div className="vacancy-item__actions">
                                  <button
                                    type="button"
                                    className="btn btn--outline vacancy-item__action-btn"
                                    onClick={() => navigate(`/employer/vacancies/${vacancy.id}`)}
                                  >
                                    Открыть
                                  </button>
                                </div>
                              </article>
                            )
                          })}
                        </div>

                        {hasPagination && (
                          <div className="employer-pagination" aria-label="Пагинация вакансий">
                            <button
                              type="button"
                              className="employer-pagination__arrow"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            >
                              Назад
                            </button>

                            <div className="employer-pagination__pages">
                              {paginationPages.map((page) => (
                                <button
                                  key={page}
                                  type="button"
                                  className={
                                    page === currentPage
                                      ? 'employer-pagination__page employer-pagination__page--active'
                                      : 'employer-pagination__page'
                                  }
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="employer-pagination__arrow"
                              disabled={currentPage === totalPages}
                              onClick={() =>
                                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                              }
                            >
                              Вперёд
                            </button>
                          </div>
                        )}
                      </>
                    )}
                </div>
              </section>

              <aside className="employer-dashboard__sidebar">
                <div className="employer-card employer-card--sidebar">
                  <div className="company-mini">
                    {profile?.logo ? (
                      <img
                        src={profile.logo}
                        alt={profile.name}
                        className="company-mini__avatar-img"
                      />
                    ) : (
                      <div className="company-mini__avatar">
                        {getCompanyInitials(profile)}
                      </div>
                    )}

                    <div className="company-mini__content">
                      <h2>{profile?.name || 'Профиль компании'}</h2>

                      <p>
                        Заполните профиль компании, чтобы вакансии выглядели доверительно для кандидатов.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--outline company-mini__button"
                    onClick={() => navigate('/employer/company-profile')}
                  >
                    Перейти в профиль
                  </button>

                  <button
                    type="button"
                    className="btn btn--primary company-mini__button"
                    onClick={() => navigate('/employer/vacancies/create')}
                  >
                    Новая вакансия
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}