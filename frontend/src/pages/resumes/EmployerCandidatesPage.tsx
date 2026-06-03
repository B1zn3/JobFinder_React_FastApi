import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './employer-candidates.css'

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

type StaticFilterItem = {
  id: string
  name: string
}

type EducationFilterValue = 'any' | 'yes' | 'no'

type CandidateResumeWorkExperience = {
  id: number
  company_name: string
  position: string
  start_date?: string | null
  end_date?: string | null
  description?: string | null
}

type CandidateResume = {
  id: number
  applicant_id: number
  applicant_full_name: string
  applicant_city_name?: string | null
  applicant_photo?: string | null
  applicant_age?: number | null
  applicant_gender?: string | null
  profession_id?: number | null
  profession_name?: string | null
  skills: string[]
  work_experiences: CandidateResumeWorkExperience[]
  work_experiences_count: number
  applications_count: number
  latest_position?: string | null
  latest_company?: string | null
  experience_years: number
  created_at?: string | null
  updated_at?: string | null
}

type CandidateResumesResponse = {
  items: CandidateResume[]
  total: number
}

type SelectProps = {
  label: string
  placeholder: string
  selectKey: string
  value?: number
  options: CatalogItem[]
  isLoading?: boolean
  disabled?: boolean
  openSelect: string | null
  setOpenSelect: Dispatch<SetStateAction<string | null>>
  onChange: (value?: number) => void
}

type StaticSelectProps = {
  label: string
  selectKey: string
  value: string
  options: StaticFilterItem[]
  openSelect: string | null
  setOpenSelect: Dispatch<SetStateAction<string | null>>
  onChange: (value: string) => void
}

type MultiSelectProps = {
  label: string
  placeholder: string
  selectKey: string
  values: number[]
  options: CatalogItem[]
  isLoading?: boolean
  openSelect: string | null
  setOpenSelect: Dispatch<SetStateAction<string | null>>
  onChange: (values: number[]) => void
}

const PAGE_SIZE = 12

const educationFilterOptions: StaticFilterItem[] = [
  { id: 'any', name: 'Не важно' },
  { id: 'yes', name: 'Есть образование' },
  { id: 'no', name: 'Нет образования' },
]

const normalizeNumberParam = (value: string | null) => {
  if (!value) return undefined

  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const normalizeNumberListParam = (value: string | null) => {
  if (!value) return []

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  )
}

const getCatalogLabel = (item?: CatalogItem | null) => {
  if (!item) return ''

  return item.full_name || item.name
}

const getCityLabel = (city?: CatalogItem | null) => {
  if (!city) return ''

  if (city.full_name) return city.full_name

  const title = [city.settlement_type_name, city.name].filter(Boolean).join(' ').trim()

  return [title || city.name, city.district_name, city.region_name]
    .filter(Boolean)
    .join(', ')
}

const getRegionOptionsFromCities = (cities: CatalogItem[]) => {
  const byId = new Map<number, CatalogItem>()

  cities.forEach((city) => {
    if (!city.region_id || !city.region_name) return

    byId.set(city.region_id, {
      id: city.region_id,
      name: city.region_name,
    })
  })

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

const getDistrictOptionsFromCities = (cities: CatalogItem[], regionId?: number) => {
  const byId = new Map<number, CatalogItem>()

  cities.forEach((city) => {
    if (!city.district_id || !city.district_name) return
    if (regionId !== undefined && city.region_id !== regionId) return

    byId.set(city.district_id, {
      id: city.district_id,
      name: city.region_name ? `${city.district_name}, ${city.region_name}` : city.district_name,
      region_id: city.region_id,
      region_name: city.region_name,
    })
  })

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

const normalizePositivePage = (value: string | null) => {
  const parsed = Number(value || '1')

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

const normalizeEducationParam = (value: string | null): EducationFilterValue => {
  if (value === 'true') return 'yes'
  if (value === 'false') return 'no'

  return 'any'
}

const educationFilterToApiValue = (value: EducationFilterValue) => {
  if (value === 'yes') return 'true'
  if (value === 'no') return 'false'

  return undefined
}

const formatCompactNumber = (value?: number | null) => {
  const number = Number(value ?? 0)

  if (!Number.isFinite(number) || number <= 0) return '0'
  if (number >= 1_000_000) return `${Math.floor(number / 1_000_000)}M+`
  if (number >= 10_000) return `${Math.floor(number / 1000)}k+`

  return number.toLocaleString('ru-RU')
}

const formatExperience = (value?: number | null) => {
  const years = Number(value ?? 0)

  if (!Number.isFinite(years) || years <= 0) return 'Без опыта'
  if (years < 1) return 'Менее года'

  return `${years.toLocaleString('ru-RU')}+ лет`
}

const getInitials = (name: string) => {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'К'
  )
}

const getGenderLabel = (value?: string | null) => {
  if (!value) return ''

  const normalized = value.toLowerCase()

  if (normalized === 'м' || normalized.includes('муж')) return 'Мужской'
  if (normalized === 'ж' || normalized.includes('жен')) return 'Женский'

  return value
}

const getVisiblePages = (current: number, total: number) => {
  const pages: Array<number | 'dots'> = []

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  pages.push(1)

  if (current > 4) pages.push('dots')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (current < total - 3) pages.push('dots')

  pages.push(total)

  return pages
}

const getApiErrorMessage = (error: unknown) => {
  const maybeError = error as {
    response?: {
      status?: number
      data?: {
        detail?: unknown
        message?: string
        error?: string
      }
    }
  }

  const status = maybeError.response?.status
  const data = maybeError.response?.data

  if (!maybeError.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (typeof data?.detail === 'string') {
    const lower = data.detail.toLowerCase()

    if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
      return 'Сессия истекла. Войдите в аккаунт заново.'
    }

    if (lower.includes('forbidden') || lower.includes('доступ')) {
      return 'Недостаточно прав. Эта страница доступна работодателю.'
    }

    return data.detail
  }

  if (data?.message) return data.message
  if (data?.error) return data.error

  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав. Эта страница доступна работодателю.'
  if (status === 404) return 'Резюме не найдены.'
  if (status === 422) return 'Проверьте корректность фильтров.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return 'Не удалось загрузить резюме.'
}

const fetchCandidateResumes = async (
  params: Record<string, string | number | undefined>,
): Promise<CandidateResumesResponse> => {
  const { data } = await http.get('/companies/resumes', { params })

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total ?? 0),
  }
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/public/catalogs/${name}`, {
    params: { skip: 0, limit: name === 'cities' || name === 'skills' ? 1000 : 500 },
  })

  return Array.isArray(data) ? data : []
}

const fetchProfessions = async (): Promise<CatalogItem[]> => {
  try {
    const { data } = await http.get('/public/professions', {
      params: { skip: 0, limit: 500 },
    })

    return Array.isArray(data) ? data : []
  } catch {
    return fetchCatalog('professions')
  }
}

const fetchEducationInstitutions = async (): Promise<CatalogItem[]> => {
  try {
    return await fetchCatalog('educational-institutions')
  } catch {
    return fetchCatalog('education_institutions')
  }
}

const CandidateSelect = ({
  label,
  placeholder,
  selectKey,
  value,
  options,
  isLoading,
  disabled = false,
  openSelect,
  setOpenSelect,
  onChange,
}: SelectProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const isOpen = !disabled && openSelect === selectKey
  const selected = options.find((item) => item.id === value)

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenSelect((prev) => (prev === selectKey ? null : prev))
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [selectKey, setOpenSelect])

  return (
    <div
      ref={ref}
      className={`candidate-select ${isOpen ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
    >
      <span className="candidate-filter-label">{label}</span>

      <button
        type="button"
        className={`candidate-select__trigger ${isOpen ? 'is-open' : ''}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpenSelect((prev) => (prev === selectKey ? null : selectKey))
        }}
        aria-expanded={isOpen}
      >
        <span>{getCatalogLabel(selected) || placeholder}</span>

        <svg className="candidate-select__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9L12 15L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="candidate-select__dropdown">
          <button
            type="button"
            className={`candidate-select__option ${value === undefined ? 'is-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(undefined)
              setOpenSelect(null)
            }}
          >
            {placeholder}
          </button>

          {isLoading ? <div className="candidate-select__empty">Загружаем...</div> : null}

          {!isLoading && options.length === 0 ? (
            <div className="candidate-select__empty">Нет вариантов</div>
          ) : null}

          {!isLoading
            ? options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`candidate-select__option ${item.id === value ? 'is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item.id)
                    setOpenSelect(null)
                  }}
                >
                  {getCatalogLabel(item)}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}

const CandidateStaticSelect = ({
  label,
  selectKey,
  value,
  options,
  openSelect,
  setOpenSelect,
  onChange,
}: StaticSelectProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const isOpen = openSelect === selectKey
  const selected = options.find((item) => item.id === value)

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenSelect((prev) => (prev === selectKey ? null : prev))
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [selectKey, setOpenSelect])

  return (
    <div ref={ref} className={`candidate-select ${isOpen ? 'is-open' : ''}`}>
      <span className="candidate-filter-label">{label}</span>

      <button
        type="button"
        className={`candidate-select__trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setOpenSelect((prev) => (prev === selectKey ? null : selectKey))}
        aria-expanded={isOpen}
      >
        <span>{selected?.name || 'Не важно'}</span>

        <svg className="candidate-select__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9L12 15L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="candidate-select__dropdown">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`candidate-select__option ${item.id === value ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(item.id)
                setOpenSelect(null)
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}


const CandidateMultiSelect = ({
  label,
  placeholder,
  selectKey,
  values,
  options,
  isLoading,
  openSelect,
  setOpenSelect,
  onChange,
}: MultiSelectProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const isOpen = openSelect === selectKey
  const selectedOptions = options.filter((item) => values.includes(item.id))
  const selectedIds = new Set(values)

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenSelect((prev) => (prev === selectKey ? null : prev))
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [selectKey, setOpenSelect])

  const toggleValue = (id: number) => {
    const nextValues = selectedIds.has(id)
      ? values.filter((item) => item !== id)
      : [...values, id]

    onChange(nextValues)
  }

  return (
    <div ref={ref} className={`candidate-select candidate-select--multi ${isOpen ? 'is-open' : ''}`}>
      <span className="candidate-filter-label">{label}</span>

      <button
        type="button"
        className={`candidate-select__trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setOpenSelect((prev) => (prev === selectKey ? null : selectKey))}
        aria-expanded={isOpen}
      >
        <span>
          {selectedOptions.length > 0
            ? selectedOptions.length === 1
              ? getCatalogLabel(selectedOptions[0])
              : `Выбрано: ${selectedOptions.length}`
            : placeholder}
        </span>

        <svg className="candidate-select__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9L12 15L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {selectedOptions.length > 0 ? (
        <div className="candidate-multi-selected">
          {selectedOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleValue(item.id)}
              title="Убрать из фильтра"
            >
              {getCatalogLabel(item)} ×
            </button>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="candidate-select__dropdown candidate-select__dropdown--multi">
          <button
            type="button"
            className={`candidate-select__option ${values.length === 0 ? 'is-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange([])}
          >
            {placeholder}
          </button>

          {isLoading ? <div className="candidate-select__empty">Загружаем...</div> : null}

          {!isLoading && options.length === 0 ? (
            <div className="candidate-select__empty">Нет вариантов</div>
          ) : null}

          {!isLoading
            ? options.map((item) => {
                const selected = selectedIds.has(item.id)

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`candidate-select__option candidate-select__option--check ${selected ? 'is-active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleValue(item.id)}
                  >
                    <span className="candidate-select__check">{selected ? '✓' : ''}</span>
                    <span>{getCatalogLabel(item)}</span>
                  </button>
                )
              })
            : null}
        </div>
      ) : null}
    </div>
  )
}

const CandidateCard = ({
  resume,
  onOpen,
}: {
  resume: CandidateResume
  onOpen: () => void
}) => {
  const genderLabel = getGenderLabel(resume.applicant_gender)

  return (
    <article className="candidate-card">
      <div className="candidate-card__top">
        <div className="candidate-card__person">
          {resume.applicant_photo ? (
            <img
              src={resume.applicant_photo}
              alt={resume.applicant_full_name}
              className="candidate-card__avatar"
            />
          ) : (
            <div className="candidate-card__avatar candidate-card__avatar--placeholder">
              {getInitials(resume.applicant_full_name)}
            </div>
          )}

          <div className="candidate-card__title-wrap">
            <h3>{resume.applicant_full_name}</h3>
            <p>{resume.profession_name || 'Профессия не указана'}</p>
          </div>
        </div>

        <div className="candidate-card__experience">
          <strong>{formatExperience(resume.experience_years)}</strong>
          <span>опыт</span>
        </div>
      </div>

      <div className="candidate-card__meta">
        {resume.applicant_city_name ? (
          <span className="candidate-pill">{resume.applicant_city_name}</span>
        ) : null}

        {typeof resume.applicant_age === 'number' ? (
          <span className="candidate-pill">{resume.applicant_age} лет</span>
        ) : null}

        {genderLabel ? <span className="candidate-pill">{genderLabel}</span> : null}

        {resume.latest_position ? (
          <span className="candidate-pill">{resume.latest_position}</span>
        ) : null}

        {resume.latest_company ? (
          <span className="candidate-pill">{resume.latest_company}</span>
        ) : null}
      </div>

      {resume.skills.length > 0 ? (
        <div className="candidate-card__skills">
          {resume.skills.slice(0, 8).map((skill) => (
            <span key={skill} className="candidate-skill">
              {skill}
            </span>
          ))}

          {resume.skills.length > 8 ? (
            <span className="candidate-skill candidate-skill--more">
              +{resume.skills.length - 8}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="candidate-card__empty-text">Навыки не указаны</p>
      )}

      <div className="candidate-card__bottom">
        <span>
          {resume.work_experiences_count > 0
            ? `${resume.work_experiences_count} мест работы`
            : 'Без опыта в резюме'}
        </span>

        <button type="button" onClick={onOpen}>
          Подробнее
        </button>
      </div>
    </article>
  )
}

export const EmployerCandidatesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(() => normalizePositivePage(searchParams.get('page')))
  const [openSelect, setOpenSelect] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const [regionId, setRegionId] = useState(() => normalizeNumberParam(searchParams.get('region_id')))
  const [districtId, setDistrictId] = useState(() =>
    normalizeNumberParam(searchParams.get('district_id')),
  )
  const [cityId, setCityId] = useState(() => normalizeNumberParam(searchParams.get('city_id')))
  const [professionId, setProfessionId] = useState(() =>
    normalizeNumberParam(searchParams.get('profession_id')),
  )
  const [skillIds, setSkillIds] = useState(() => {
    const values = normalizeNumberListParam(searchParams.get('skill_ids'))
    const legacySkillId = normalizeNumberParam(searchParams.get('skill_id'))

    return values.length > 0 ? values : legacySkillId ? [legacySkillId] : []
  })

  const [experienceFrom, setExperienceFrom] = useState(() =>
    normalizeNumberParam(searchParams.get('experience_from')),
  )
  const [experienceTo, setExperienceTo] = useState(() =>
    normalizeNumberParam(searchParams.get('experience_to')),
  )

  const [educationFilter, setEducationFilter] = useState<EducationFilterValue>(() =>
    normalizeEducationParam(searchParams.get('has_education')),
  )

  const [educationInstitutionId, setEducationInstitutionId] = useState(() =>
    normalizeNumberParam(searchParams.get('education_institution_id')),
  )

  const [ageFrom, setAgeFrom] = useState(() => normalizeNumberParam(searchParams.get('age_from')))
  const [ageTo, setAgeTo] = useState(() => normalizeNumberParam(searchParams.get('age_to')))

  const citiesQuery = useQuery({
    queryKey: ['candidate-cities'],
    queryFn: () => fetchCatalog('cities'),
    retry: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['candidate-professions'],
    queryFn: fetchProfessions,
    retry: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['candidate-skills'],
    queryFn: () => fetchCatalog('skills'),
    retry: false,
  })

  const educationInstitutionsQuery = useQuery({
    queryKey: ['candidate-education-institutions'],
    queryFn: fetchEducationInstitutions,
    retry: false,
  })

  const isExperienceRangeInvalid =
    experienceFrom !== undefined &&
    experienceTo !== undefined &&
    experienceFrom > experienceTo

  const isAgeRangeInvalid =
    ageFrom !== undefined &&
    ageTo !== undefined &&
    ageFrom > ageTo

  const hasEducationApiValue = educationFilterToApiValue(educationFilter)

  const cities = citiesQuery.data ?? []
  const regions = useMemo(() => getRegionOptionsFromCities(cities), [cities])
  const districts = useMemo(
    () => getDistrictOptionsFromCities(cities, regionId),
    [cities, regionId],
  )
  const filteredCities = useMemo(() => {
    return cities
      .filter((city) => {
        if (regionId !== undefined && city.region_id !== regionId) return false
        if (districtId !== undefined && city.district_id !== districtId) return false

        return true
      })
      .sort((a, b) => getCityLabel(a).localeCompare(getCityLabel(b), 'ru'))
  }, [cities, regionId, districtId])

  const filterParams = useMemo(
    () => ({
      search: search || undefined,
      region_id: regionId,
      district_id: districtId,
      city_id: cityId,
      profession_id: professionId,
      skill_id: skillIds.length === 1 ? skillIds[0] : undefined,
      skill_ids: skillIds.length > 0 ? skillIds.join(',') : undefined,
      experience_from: experienceFrom,
      experience_to: experienceTo,
      has_education: hasEducationApiValue,
      education_institution_id: educationInstitutionId,
      age_from: ageFrom,
      age_to: ageTo,
    }),
    [
      search,
      regionId,
      districtId,
      cityId,
      professionId,
      skillIds,
      experienceFrom,
      experienceTo,
      hasEducationApiValue,
      educationInstitutionId,
      ageFrom,
      ageTo,
    ],
  )

  const candidatesQuery = useQuery({
    queryKey: ['candidate-resumes', filterParams, page],
    queryFn: () =>
      fetchCandidateResumes({
        ...filterParams,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    retry: false,
    enabled: !isExperienceRangeInvalid && !isAgeRangeInvalid,
  })

  const totalCandidatesQuery = useQuery({
    queryKey: ['candidate-resumes-total'],
    queryFn: () => fetchCandidateResumes({ skip: 0, limit: 1 }),
    retry: false,
  })

  const resumes = candidatesQuery.data?.items ?? []
  const filteredCount = candidatesQuery.data?.total ?? 0
  const totalCandidates = totalCandidatesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  const selectedRegion = regions.find((item) => item.id === regionId)
  const selectedDistrict = districts.find((item) => item.id === districtId)
  const selectedCity = cities.find((item) => item.id === cityId)
  const selectedProfession = professionsQuery.data?.find((item) => item.id === professionId)
  const selectedSkills = (skillsQuery.data ?? []).filter((item) => skillIds.includes(item.id))
  const selectedEducationInstitution = educationInstitutionsQuery.data?.find(
    (item) => item.id === educationInstitutionId,
  )
  const selectedEducationFilter = educationFilterOptions.find((item) => item.id === educationFilter)

  const activeFiltersCount = [
    search,
    regionId,
    districtId,
    cityId,
    professionId,
    skillIds.length > 0 ? skillIds.join(',') : undefined,
    experienceFrom,
    experienceTo,
    educationFilter !== 'any' ? educationFilter : undefined,
    educationInstitutionId,
    ageFrom,
    ageTo,
  ].filter((value) => value !== undefined && value !== '').length

  const visiblePages = getVisiblePages(page, totalPages)

  useEffect(() => {
    if (!selectedCity) return

    if (selectedCity.region_id && regionId === undefined) {
      setRegionId(selectedCity.region_id)
    }

    if (selectedCity.district_id && districtId === undefined) {
      setDistrictId(selectedCity.district_id)
    }
  }, [selectedCity, regionId, districtId])

  useEffect(() => {
    const nextParams: Record<string, string> = {}

    if (search) nextParams.search = search
    if (regionId !== undefined) nextParams.region_id = String(regionId)
    if (districtId !== undefined) nextParams.district_id = String(districtId)
    if (cityId !== undefined) nextParams.city_id = String(cityId)
    if (professionId !== undefined) nextParams.profession_id = String(professionId)
    if (skillIds.length > 0) nextParams.skill_ids = skillIds.join(',')
    if (experienceFrom !== undefined) nextParams.experience_from = String(experienceFrom)
    if (experienceTo !== undefined) nextParams.experience_to = String(experienceTo)
    if (hasEducationApiValue !== undefined) nextParams.has_education = hasEducationApiValue
    if (educationInstitutionId !== undefined) {
      nextParams.education_institution_id = String(educationInstitutionId)
    }
    if (ageFrom !== undefined) nextParams.age_from = String(ageFrom)
    if (ageTo !== undefined) nextParams.age_to = String(ageTo)
    if (page > 1) nextParams.page = String(page)

    setSearchParams(nextParams)
  }, [
    search,
    regionId,
    districtId,
    cityId,
    professionId,
    skillIds.length > 0 ? skillIds.join(',') : undefined,
    experienceFrom,
    experienceTo,
    hasEducationApiValue,
    educationInstitutionId,
    ageFrom,
    ageTo,
    page,
    setSearchParams,
  ])

  useEffect(() => {
    if (page > totalPages) {
      setPage(1)
    }
  }, [page, totalPages])

  const openResumeDetails = (resumeId: number) => {
    window.open(`/employer/candidates/resumes/${resumeId}`, '_blank', 'noopener,noreferrer')
  }

  const resetFilters = () => {
    setSearch('')
    setSearchInput('')
    setRegionId(undefined)
    setDistrictId(undefined)
    setCityId(undefined)
    setProfessionId(undefined)
    setSkillIds([])
    setExperienceFrom(undefined)
    setExperienceTo(undefined)
    setEducationFilter('any')
    setEducationInstitutionId(undefined)
    setAgeFrom(undefined)
    setAgeTo(undefined)
    setPage(1)
    setOpenSelect(null)
  }

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()

    setSearch(searchInput.trim())
    setPage(1)
    setOpenSelect(null)
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return

    setPage(nextPage)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <div className="candidates-page">
      <Header />

      <main className="candidates-page__main">
        <section className="candidates-hero">
          <div className="candidates-container">
            <div className="candidates-hero__content">
              <div>
                <span className="candidates-eyebrow">База кандидатов</span>

                <h1>Резюме соискателей</h1>

                <p>
                  Ищите кандидатов по профессии, области, району, городу, нескольким навыкам, образованию, возрасту и опыту.
                  В карточке видно всё главное: специализация, город, навыки и последний опыт
                  работы.
                </p>
              </div>

              <form className="candidates-search" onSubmit={handleSearchSubmit}>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Поиск по имени, профессии или навыку"
                />

                <button type="submit">Найти</button>
              </form>

              <div className="candidates-hero__stats">
                <div>
                  <strong>
                    {totalCandidatesQuery.isLoading ? '...' : formatCompactNumber(totalCandidates)}
                  </strong>
                  <span>резюме</span>
                </div>

                <div>
                  <strong>{formatCompactNumber(professionsQuery.data?.length ?? 0)}</strong>
                  <span>профессий</span>
                </div>

                <div>
                  <strong>{formatCompactNumber(skillsQuery.data?.length ?? 0)}</strong>
                  <span>навыков</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="candidates-catalog">
          <div className="candidates-container">
            <div className="candidates-catalog__header">
              <div>
                <span className="candidates-eyebrow">Каталог</span>
                <h2>Кандидаты</h2>
              </div>

              <div className="candidates-found">
                Найдено: <strong>{formatCompactNumber(filteredCount)}</strong>
              </div>
            </div>

            {activeFiltersCount > 0 ? (
              <div className="candidates-active-filters">
                <span className="candidates-active-filters__label">Фильтры:</span>

                {search ? <span>Поиск: {search}</span> : null}
                {selectedRegion ? <span>Область: {selectedRegion.name}</span> : null}
                {selectedDistrict ? <span>Район: {selectedDistrict.name}</span> : null}
                {selectedCity ? <span>{getCityLabel(selectedCity)}</span> : null}
                {selectedProfession ? <span>{selectedProfession.name}</span> : null}
                {selectedSkills.map((skill) => (
                  <span key={skill.id}>Навык: {skill.name}</span>
                ))}

                {educationFilter !== 'any' ? (
                  <span>{selectedEducationFilter?.name || 'Образование'}</span>
                ) : null}

                {selectedEducationInstitution ? (
                  <span>ВУЗ: {selectedEducationInstitution.name}</span>
                ) : null}

                {experienceFrom !== undefined ? (
                  <span>Опыт от {experienceFrom} лет</span>
                ) : null}

                {experienceTo !== undefined ? <span>Опыт до {experienceTo} лет</span> : null}

                {ageFrom !== undefined ? <span>Возраст от {ageFrom}</span> : null}
                {ageTo !== undefined ? <span>Возраст до {ageTo}</span> : null}

                <button type="button" onClick={resetFilters}>
                  Сбросить
                </button>
              </div>
            ) : null}

            <div className="candidates-layout">
              <aside className="candidates-sidebar">
                <div className="candidates-filter-card">
                  <div className="candidates-filter-card__header">
                    <div>
                      <h3>Фильтры</h3>
                      <p>Подбери кандидатов под вакансию</p>
                    </div>

                    {activeFiltersCount > 0 ? (
                      <button type="button" onClick={resetFilters}>
                        Сброс
                      </button>
                    ) : null}
                  </div>

                  <CandidateSelect
                    label="Область"
                    placeholder="Все области"
                    selectKey="region"
                    value={regionId}
                    options={regions}
                    isLoading={citiesQuery.isLoading}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setRegionId(value)
                      setDistrictId(undefined)
                      setCityId(undefined)
                      setPage(1)
                    }}
                  />

                  <CandidateSelect
                    label="Район"
                    placeholder="Все районы"
                    selectKey="district"
                    value={districtId}
                    options={districts}
                    isLoading={citiesQuery.isLoading}
                    disabled={regionId === undefined}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setDistrictId(value)
                      setCityId(undefined)
                      setPage(1)
                    }}
                  />

                  <CandidateSelect
                    label="Город / населённый пункт"
                    placeholder="Все города"
                    selectKey="city"
                    value={cityId}
                    options={filteredCities}
                    isLoading={citiesQuery.isLoading}
                    disabled={regionId === undefined && districtId === undefined}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setCityId(value)
                      setPage(1)
                    }}
                  />

                  <CandidateSelect
                    label="Профессия"
                    placeholder="Все профессии"
                    selectKey="profession"
                    value={professionId}
                    options={professionsQuery.data ?? []}
                    isLoading={professionsQuery.isLoading}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setProfessionId(value)
                      setPage(1)
                    }}
                  />

                  <CandidateMultiSelect
                    label="Навыки"
                    placeholder="Любые навыки"
                    selectKey="skills"
                    values={skillIds}
                    options={skillsQuery.data ?? []}
                    isLoading={skillsQuery.isLoading}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(values) => {
                      setSkillIds(values)
                      setPage(1)
                    }}
                  />

                  <CandidateStaticSelect
                    label="Образование"
                    selectKey="education"
                    value={educationFilter}
                    options={educationFilterOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      const nextValue = value as EducationFilterValue

                      setEducationFilter(nextValue)
                      setPage(1)

                      if (nextValue === 'no') {
                        setEducationInstitutionId(undefined)
                      }
                    }}
                  />

                  <CandidateSelect
                    label="Учебное заведение"
                    placeholder="Все учебные заведения"
                    selectKey="educationInstitution"
                    value={educationInstitutionId}
                    options={educationInstitutionsQuery.data ?? []}
                    isLoading={educationInstitutionsQuery.isLoading}
                    disabled={educationFilter === 'no'}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setEducationInstitutionId(value)
                      setPage(1)

                      if (value !== undefined && educationFilter === 'any') {
                        setEducationFilter('yes')
                      }
                    }}
                  />

                  <div className="candidates-filter-group">
                    <span className="candidate-filter-label">Возраст</span>

                    <div className="candidates-range">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={ageFrom ?? ''}
                        onChange={(event) => {
                          setAgeFrom(event.target.value ? Number(event.target.value) : undefined)
                          setPage(1)
                        }}
                        placeholder="от"
                      />

                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={ageTo ?? ''}
                        onChange={(event) => {
                          setAgeTo(event.target.value ? Number(event.target.value) : undefined)
                          setPage(1)
                        }}
                        placeholder="до"
                      />
                    </div>

                    {isAgeRangeInvalid ? (
                      <span className="candidates-filter-error">
                        Минимальный возраст не должен быть больше максимального.
                      </span>
                    ) : null}
                  </div>

                  <div className="candidates-filter-group">
                    <span className="candidate-filter-label">Опыт работы</span>

                    <div className="candidates-range">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={experienceFrom ?? ''}
                        onChange={(event) => {
                          setExperienceFrom(
                            event.target.value ? Number(event.target.value) : undefined,
                          )
                          setPage(1)
                        }}
                        placeholder="от"
                      />

                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={experienceTo ?? ''}
                        onChange={(event) => {
                          setExperienceTo(
                            event.target.value ? Number(event.target.value) : undefined,
                          )
                          setPage(1)
                        }}
                        placeholder="до"
                      />
                    </div>

                    {isExperienceRangeInvalid ? (
                      <span className="candidates-filter-error">
                        Минимальный опыт не должен быть больше максимального.
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>

              <div className="candidates-content">
                {isExperienceRangeInvalid || isAgeRangeInvalid ? (
                  <div className="candidates-empty candidates-empty--error">
                    <h3>Проверьте фильтры</h3>
                    <p>
                      Значение «от» не должно быть больше значения «до».
                    </p>
                  </div>
                ) : null}

                {!isExperienceRangeInvalid && !isAgeRangeInvalid && candidatesQuery.isLoading ? (
                  <div className="candidates-grid">
                    {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <div key={index} className="candidate-card candidate-card--skeleton" />
                    ))}
                  </div>
                ) : null}

                {!isExperienceRangeInvalid && !isAgeRangeInvalid && candidatesQuery.isError ? (
                  <div className="candidates-empty candidates-empty--error">
                    <h3>Не удалось загрузить резюме</h3>
                    <p>{getApiErrorMessage(candidatesQuery.error)}</p>
                  </div>
                ) : null}

                {!isExperienceRangeInvalid &&
                !isAgeRangeInvalid &&
                candidatesQuery.isSuccess &&
                resumes.length === 0 ? (
                  <div className="candidates-empty">
                    <h3>Кандидаты не найдены</h3>
                    <p>Попробуйте изменить поиск или сбросить фильтры.</p>

                    <button type="button" onClick={resetFilters}>
                      Сбросить фильтры
                    </button>
                  </div>
                ) : null}

                {!isExperienceRangeInvalid &&
                !isAgeRangeInvalid &&
                candidatesQuery.isSuccess &&
                resumes.length > 0 ? (
                  <>
                    <div className="candidates-grid">
                      {resumes.map((resume) => (
                        <CandidateCard
                          key={resume.id}
                          resume={resume}
                          onOpen={() => openResumeDetails(resume.id)}
                        />
                      ))}
                    </div>

                    {totalPages > 1 ? (
                      <div className="candidates-pagination">
                        <button
                          type="button"
                          onClick={() => goToPage(page - 1)}
                          disabled={page === 1}
                        >
                          Назад
                        </button>

                        <div className="candidates-pagination__pages">
                          {visiblePages.map((item, index) =>
                            item === 'dots' ? (
                              <span key={`dots-${index}`}>...</span>
                            ) : (
                              <button
                                key={item}
                                type="button"
                                className={item === page ? 'is-active' : ''}
                                onClick={() => goToPage(item)}
                              >
                                {item}
                              </button>
                            ),
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => goToPage(page + 1)}
                          disabled={page === totalPages}
                        >
                          Вперёд
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}