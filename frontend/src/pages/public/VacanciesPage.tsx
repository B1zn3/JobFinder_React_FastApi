import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './vacancies.css'

type NamedEntity = {
  id: number
  name: string
}

type RegionItem = NamedEntity

type DistrictItem = NamedEntity & {
  region_id?: number | null
  region_name?: string | null
}

type CityItem = NamedEntity & {
  full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
}

type CurrencyItem = NamedEntity

type Skill = {
  id: number
  name: string
}

type Vacancy = {
  id: number
  title: string
  description?: string | null
  salary_min?: number | null
  salary_max?: number | null

  company_name?: string | null
  city_name?: string | null
  city_full_name?: string | null
  profession_name?: string | null

  company?: NamedEntity & { description?: string; logo?: string }
  city?: CityItem
  profession?: NamedEntity
  employment_type?: NamedEntity | string | null
  work_schedule?: NamedEntity | string | null
  experience?: NamedEntity | string | null
  currency?: string | null

  skills?: Skill[] | string[]
}

const PAGE_SIZE = 12

const formatCompactCount = (value?: number | null) => {
  const num = Number(value ?? 0)

  if (!Number.isFinite(num) || num <= 0) return '0'
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}m+`
  if (num >= 10_000) return `${Math.floor(num / 1_000)}k+`

  return num.toLocaleString('ru-RU')
}

const fetchVacancies = async (params: Record<string, unknown>): Promise<Vacancy[]> => {
  const { data } = await http.get('/public/vacancies', { params })
  return Array.isArray(data) ? data : []
}

const fetchRegions = async (): Promise<RegionItem[]> => {
  const { data } = await http.get('/public/catalogs/regions', {
    params: { skip: 0, limit: 100 },
  })

  return Array.isArray(data) ? data : []
}

const fetchDistricts = async (): Promise<DistrictItem[]> => {
  const { data } = await http.get('/public/catalogs/districts', {
    params: { skip: 0, limit: 1000 },
  })

  return Array.isArray(data) ? data : []
}

const fetchCities = async (): Promise<CityItem[]> => {
  const { data } = await http.get('/public/catalogs/cities', {
    params: { skip: 0, limit: 1000 },
  })

  return Array.isArray(data) ? data : []
}

const fetchProfessions = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/professions', {
    params: { skip: 0, limit: 500 },
  })

  return Array.isArray(data) ? data : []
}

const fetchEmploymentTypes = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/employment-types', {
    params: { skip: 0, limit: 500 },
  })

  return Array.isArray(data) ? data : []
}

const fetchExperiences = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/experiences', {
    params: { skip: 0, limit: 500 },
  })

  return Array.isArray(data) ? data : []
}

const fetchWorkSchedules = async (): Promise<NamedEntity[]> => {
  const { data } = await http.get('/public/catalogs/work-schedules', {
    params: { skip: 0, limit: 500 },
  })

  return Array.isArray(data) ? data : []
}

const fetchCurrencies = async (): Promise<CurrencyItem[]> => {
  const { data } = await http.get('/public/catalogs/currencies', {
    params: { skip: 0, limit: 100 },
  })

  return Array.isArray(data) ? data : []
}

const fetchVacanciesCount = async (params: Record<string, unknown>): Promise<number> => {
  const limitFromParams = typeof params.limit === 'number' ? params.limit : 100

  const { data } = await http.get('/public/vacancies', {
    params: {
      ...params,
      skip: 0,
      limit: limitFromParams,
    },
  })

  return Array.isArray(data) ? data.length : 0
}

const getEntityName = (value?: NamedEntity | string | null) => {
  if (!value) return ''
  return typeof value === 'string' ? value : value.name
}

const getSkills = (skills?: Skill[] | string[]) => {
  if (!skills?.length) return []
  if (typeof skills[0] === 'string') return skills as string[]
  return (skills as Skill[]).map((skill) => skill.name)
}

const getCityDisplayName = (city?: CityItem | null) => {
  if (!city) return ''

  if (city.full_name?.trim()) {
    return city.full_name.trim()
  }

  const title = [city.settlement_type_name, city.name].filter(Boolean).join(' ')
  const parts = [title, city.district_name, city.region_name].filter(Boolean)

  return parts.join(', ')
}

const getDistrictDisplayName = (district?: DistrictItem | null) => {
  if (!district) return ''
  return district.region_name ? `${district.name}, ${district.region_name}` : district.name
}

const formatSalary = (
  salaryMin?: number | null,
  salaryMax?: number | null,
  currency = 'BYN',
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

type CustomSelectProps = {
  selectKey: string
  label: string
  placeholder: string
  value?: number
  options: NamedEntity[]
  openSelect: string | null
  setOpenSelect: Dispatch<SetStateAction<string | null>>
  disabled?: boolean
  emptyText?: string
  onChange: (value?: number) => void
}

function CustomSelect({
  selectKey,
  label,
  placeholder,
  value,
  options,
  openSelect,
  setOpenSelect,
  disabled = false,
  emptyText = 'Нет вариантов',
  onChange,
}: CustomSelectProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const open = !disabled && openSelect === selectKey

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenSelect((prev) => (prev === selectKey ? null : prev))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectKey, setOpenSelect])

  const selected = options.find((item) => item.id === value)

  return (
    <div
      className={`custom-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      ref={ref}
    >
      {label ? <label className="filter-label">{label}</label> : null}

      <button
        type="button"
        className={`custom-select__trigger ${open ? 'is-open' : ''}`}
        onClick={() => {
          if (disabled) return
          setOpenSelect((prev) => (prev === selectKey ? null : selectKey))
        }}
        disabled={disabled}
      >
        <span>{selected?.name || placeholder}</span>
        <span className="custom-select__arrow">▾</span>
      </button>

      {open ? (
        <div className="custom-select__dropdown">
          <button
            type="button"
            className={`custom-select__option ${!value ? 'is-selected' : ''}`}
            onClick={() => {
              onChange(undefined)
              setOpenSelect(null)
            }}
          >
            {placeholder}
          </button>

          {options.length > 0 ? (
            options.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`custom-select__option ${value === item.id ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(item.id)
                  setOpenSelect(null)
                }}
              >
                {item.name}
              </button>
            ))
          ) : (
            <div className="custom-select__empty">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export const VacanciesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const initialPage = Number(searchParams.get('page') || '1')
  const [page, setPage] = useState(Number.isNaN(initialPage) || initialPage < 1 ? 1 : initialPage)

  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const [regionId, setRegionId] = useState<number | undefined>(
    searchParams.get('region_id') ? Number(searchParams.get('region_id')) : undefined,
  )
  const [districtId, setDistrictId] = useState<number | undefined>(
    searchParams.get('district_id') ? Number(searchParams.get('district_id')) : undefined,
  )
  const [cityId, setCityId] = useState<number | undefined>(
    searchParams.get('city_id') ? Number(searchParams.get('city_id')) : undefined,
  )
  const [professionId, setProfessionId] = useState<number | undefined>(
    searchParams.get('profession_id') ? Number(searchParams.get('profession_id')) : undefined,
  )
  const [employmentTypeId, setEmploymentTypeId] = useState<number | undefined>(
    searchParams.get('employment_type_id')
      ? Number(searchParams.get('employment_type_id'))
      : undefined,
  )
  const [experienceId, setExperienceId] = useState<number | undefined>(
    searchParams.get('experience_id') ? Number(searchParams.get('experience_id')) : undefined,
  )
  const [workScheduleId, setWorkScheduleId] = useState<number | undefined>(
    searchParams.get('work_schedule_id') ? Number(searchParams.get('work_schedule_id')) : undefined,
  )
  const [salaryFrom, setSalaryFrom] = useState<number | undefined>(
    searchParams.get('salary_from') ? Number(searchParams.get('salary_from')) : undefined,
  )
  const [salaryTo, setSalaryTo] = useState<number | undefined>(
    searchParams.get('salary_to') ? Number(searchParams.get('salary_to')) : undefined,
  )
  const [currencyId, setCurrencyId] = useState<number | undefined>(
    searchParams.get('currency_id') ? Number(searchParams.get('currency_id')) : undefined,
  )

  const regionsQuery = useQuery({ queryKey: ['regions'], queryFn: fetchRegions })
  const districtsQuery = useQuery({ queryKey: ['districts'], queryFn: fetchDistricts })
  const citiesQuery = useQuery({ queryKey: ['cities'], queryFn: fetchCities })
  const professionsQuery = useQuery({ queryKey: ['professions'], queryFn: fetchProfessions })

  const employmentTypesQuery = useQuery({
    queryKey: ['employment-types'],
    queryFn: fetchEmploymentTypes,
  })

  const experiencesQuery = useQuery({
    queryKey: ['experiences'],
    queryFn: fetchExperiences,
  })

  const workSchedulesQuery = useQuery({
    queryKey: ['work-schedules'],
    queryFn: fetchWorkSchedules,
  })

  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: fetchCurrencies,
  })

  const filterParams = useMemo(
    () => ({
      search: search || undefined,
      region_id: regionId,
      district_id: districtId,
      city_id: cityId,
      profession_id: professionId,
      employment_type_id: employmentTypeId,
      experience_id: experienceId,
      work_schedule_id: workScheduleId,
      salary_from: salaryFrom,
      salary_to: salaryTo,
      currency_id: currencyId,
    }),
    [
      search,
      regionId,
      districtId,
      cityId,
      professionId,
      employmentTypeId,
      experienceId,
      workScheduleId,
      salaryFrom,
      salaryTo,
      currencyId,
    ],
  )

  const vacanciesQuery = useQuery({
    queryKey: ['vacancies', filterParams, page],
    queryFn: () =>
      fetchVacancies({
        ...filterParams,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
  })

  const vacanciesCountQuery = useQuery({
    queryKey: ['vacancies-count', filterParams],
    queryFn: () => fetchVacanciesCount({ ...filterParams, limit: 100 }),
  })

  const totalSiteVacanciesQuery = useQuery({
    queryKey: ['vacancies-count-total-site'],
    queryFn: () =>
      fetchVacanciesCount({
        skip: 0,
        limit: 100,
      }),
  })

  const totalSiteVacancies = totalSiteVacanciesQuery.data ?? 0
  const filteredVacanciesCount = vacanciesCountQuery.data ?? 0
  const totalPages = Math.max(1, Math.ceil(filteredVacanciesCount / PAGE_SIZE))

  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []
  const cities = citiesQuery.data || []

  const filteredDistricts = useMemo(() => {
    if (!regionId) return districts
    return districts.filter((item) => item.region_id === regionId)
  }, [districts, regionId])

  const filteredCities = useMemo(() => {
    return cities.filter((item) => {
      const matchesRegion = !regionId || item.region_id === regionId
      const matchesDistrict = !districtId || item.district_id === districtId

      return matchesRegion && matchesDistrict
    })
  }, [cities, regionId, districtId])

  const regionOptions = useMemo<NamedEntity[]>(() => {
    return regions.map((item) => ({
      id: item.id,
      name: item.name,
    }))
  }, [regions])

  const districtOptions = useMemo<NamedEntity[]>(() => {
    return filteredDistricts.map((item) => ({
      id: item.id,
      name: getDistrictDisplayName(item),
    }))
  }, [filteredDistricts])

  const cityOptions = useMemo<NamedEntity[]>(() => {
    return filteredCities.map((item) => ({
      id: item.id,
      name: getCityDisplayName(item),
    }))
  }, [filteredCities])

  const selectedCurrencyName =
    currenciesQuery.data?.find((item) => item.id === currencyId)?.name || ''

  useEffect(() => {
    const params: Record<string, string> = {}

    if (search) params.search = search
    if (regionId) params.region_id = String(regionId)
    if (districtId) params.district_id = String(districtId)
    if (cityId) params.city_id = String(cityId)
    if (professionId) params.profession_id = String(professionId)
    if (employmentTypeId) params.employment_type_id = String(employmentTypeId)
    if (experienceId) params.experience_id = String(experienceId)
    if (workScheduleId) params.work_schedule_id = String(workScheduleId)
    if (salaryFrom) params.salary_from = String(salaryFrom)
    if (salaryTo) params.salary_to = String(salaryTo)
    if (currencyId) params.currency_id = String(currencyId)
    if (page > 1) params.page = String(page)

    setSearchParams(params)
  }, [
    search,
    regionId,
    districtId,
    cityId,
    professionId,
    employmentTypeId,
    experienceId,
    workScheduleId,
    salaryFrom,
    salaryTo,
    currencyId,
    page,
    setSearchParams,
  ])

  useEffect(() => {
    if (districtId && regionId) {
      const district = districts.find((item) => item.id === districtId)

      if (district && district.region_id !== regionId) {
        setDistrictId(undefined)
        setCityId(undefined)
      }
    }

    if (cityId) {
      const city = cities.find((item) => item.id === cityId)

      if (
        city &&
        ((regionId && city.region_id !== regionId) ||
          (districtId && city.district_id !== districtId))
      ) {
        setCityId(undefined)
      }
    }
  }, [cities, districts, regionId, districtId, cityId])

  const activeFiltersCount = useMemo(() => {
    return [
      search,
      regionId,
      districtId,
      cityId,
      professionId,
      employmentTypeId,
      experienceId,
      workScheduleId,
      salaryFrom,
      salaryTo,
      currencyId,
    ].filter(Boolean).length
  }, [
    search,
    regionId,
    districtId,
    cityId,
    professionId,
    employmentTypeId,
    experienceId,
    workScheduleId,
    salaryFrom,
    salaryTo,
    currencyId,
  ])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
    setOpenSelect(null)
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setRegionId(undefined)
    setDistrictId(undefined)
    setCityId(undefined)
    setProfessionId(undefined)
    setEmploymentTypeId(undefined)
    setExperienceId(undefined)
    setWorkScheduleId(undefined)
    setSalaryFrom(undefined)
    setSalaryTo(undefined)
    setCurrencyId(undefined)
    setPage(1)
    setOpenSelect(null)
  }

  const openVacancy = (id: number) => {
    window.open(`/vacancies/${id}`, '_blank', 'noopener,noreferrer')
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, id: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openVacancy(id)
    }
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (page > totalPages) {
      setPage(1)
    }
  }, [page, totalPages])

  return (
    <div className="vacancies-page">
      <Header />

      <main className="vacancies-page__main">
        <section className="vacancies-hero">
          <div className="container">
            <div className="vacancies-hero__content">
              <h1 className="vacancies-hero__title">
                Вакансии
              </h1>
              <form className="vacancies-hero__search" onSubmit={handleSearchSubmit}>
                <input
                  className="vacancies-hero__input"
                  type="text"
                  placeholder="Должность, компания, навык"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />

                <button className="btn btn--primary btn--large" type="submit">
                  Найти вакансии
                </button>
              </form>

              <div className="vacancies-hero__stats">
                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {totalSiteVacanciesQuery.isLoading
                      ? '...'
                      : formatCompactCount(totalSiteVacancies)}
                  </span>
                  <span className="vacancies-stat__label">вакансий</span>
                </div>

                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {formatCompactCount(cities.length)}
                  </span>
                  <span className="vacancies-stat__label">городов</span>
                </div>

                <div className="vacancies-stat">
                  <span className="vacancies-stat__value">
                    {formatCompactCount(professionsQuery.data?.length ?? 0)}
                  </span>
                  <span className="vacancies-stat__label">профессий</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vacancies-catalog">
          <div className="container">
            <div className="section-header vacancies-section-header">
              <div>
                <h2 className="section-title">Каталог вакансий</h2>
              </div>

              <div className="vacancies-result-badge">
                Найдено: <strong>{formatCompactCount(filteredVacanciesCount)}</strong>
              </div>
            </div>

            {activeFiltersCount > 0 ? (
              <div className="active-filters">
                <span className="active-filters__label">Фильтры:</span>

                {search ? <span className="active-filter-chip">Поиск: {search}</span> : null}

                {regionId ? (
                  <span className="active-filter-chip">
                    {regions.find((item) => item.id === regionId)?.name}
                  </span>
                ) : null}

                {districtId ? (
                  <span className="active-filter-chip">
                    {getDistrictDisplayName(districts.find((item) => item.id === districtId))}
                  </span>
                ) : null}

                {cityId ? (
                  <span className="active-filter-chip">
                    {getCityDisplayName(cities.find((item) => item.id === cityId))}
                  </span>
                ) : null}

                {professionId ? (
                  <span className="active-filter-chip">
                    {professionsQuery.data?.find((item) => item.id === professionId)?.name}
                  </span>
                ) : null}

                {employmentTypeId ? (
                  <span className="active-filter-chip">
                    {employmentTypesQuery.data?.find((item) => item.id === employmentTypeId)?.name}
                  </span>
                ) : null}

                {experienceId ? (
                  <span className="active-filter-chip">
                    {experiencesQuery.data?.find((item) => item.id === experienceId)?.name}
                  </span>
                ) : null}

                {workScheduleId ? (
                  <span className="active-filter-chip">
                    {workSchedulesQuery.data?.find((item) => item.id === workScheduleId)?.name}
                  </span>
                ) : null}

                {salaryFrom || salaryTo ? (
                  <span className="active-filter-chip">
                    Зарплата:{' '}
                    {salaryFrom ? `от ${salaryFrom.toLocaleString('ru-RU')}` : ''}
                    {salaryFrom && salaryTo ? ' ' : ''}
                    {salaryTo ? `до ${salaryTo.toLocaleString('ru-RU')}` : ''}
                  </span>
                ) : null}

                {currencyId ? (
                  <span className="active-filter-chip">
                    Валюта: {selectedCurrencyName || currencyId}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="vacancies-layout">
              <aside className="vacancies-sidebar">
                <div className="filters-card">
                  <div className="filters-card__header">
                    <div>
                      <h3>Фильтры</h3>
                      <p>Настрой подбор под свои условия</p>
                    </div>

                    <button type="button" className="btn btn--text" onClick={resetFilters}>
                      Сбросить
                    </button>
                  </div>

                  <CustomSelect
                    selectKey="region"
                    label="Область"
                    placeholder="Все области"
                    value={regionId}
                    options={regionOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    emptyText={
                      regionsQuery.isLoading ? 'Загружаем области...' : 'Области не найдены'
                    }
                    onChange={(value) => {
                      setPage(1)
                      setRegionId(value)
                      setDistrictId(undefined)
                      setCityId(undefined)
                    }}
                  />

                  <CustomSelect
                    selectKey="district"
                    label="Район"
                    placeholder="Все районы"
                    value={districtId}
                    options={districtOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    disabled={!regionId}
                    emptyText={
                      !regionId
                        ? 'Сначала выберите область'
                        : districtsQuery.isLoading
                          ? 'Загружаем районы...'
                          : 'Районы не найдены'
                    }
                    onChange={(value) => {
                      setPage(1)
                      setDistrictId(value)
                      setCityId(undefined)
                    }}
                  />

                  <CustomSelect
                    selectKey="city"
                    label="Населённый пункт"
                    placeholder="Все города"
                    value={cityId}
                    options={cityOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    disabled={!regionId || !districtId}
                    emptyText={
                      !regionId
                        ? 'Сначала выберите область'
                        : !districtId
                          ? 'Сначала выберите район'
                          : citiesQuery.isLoading
                            ? 'Загружаем города...'
                            : 'Города не найдены'
                    }
                    onChange={(value) => {
                      setPage(1)
                      setCityId(value)
                    }}
                  />

                  <CustomSelect
                    selectKey="profession"
                    label="Профессия"
                    placeholder="Все профессии"
                    value={professionId}
                    options={professionsQuery.data || []}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setPage(1)
                      setProfessionId(value)
                    }}
                  />

                  <CustomSelect
                    selectKey="employmentType"
                    label="Формат работы"
                    placeholder="Любой тип"
                    value={employmentTypeId}
                    options={employmentTypesQuery.data || []}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setPage(1)
                      setEmploymentTypeId(value)
                    }}
                  />

                  <CustomSelect
                    selectKey="experience"
                    label="Опыт"
                    placeholder="Любой опыт"
                    value={experienceId}
                    options={experiencesQuery.data || []}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setPage(1)
                      setExperienceId(value)
                    }}
                  />

                  <CustomSelect
                    selectKey="workSchedule"
                    label="График работы"
                    placeholder="Любой график"
                    value={workScheduleId}
                    options={workSchedulesQuery.data || []}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => {
                      setPage(1)
                      setWorkScheduleId(value)
                    }}
                  />

                  <div className="filter-group filter-group--salary">
  <label className="filter-label">Зарплата</label>

  <div className="salary-filter">
    <div className="salary-filter__amounts">
      <label className="salary-filter__field">
        <span>от</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder=""
          value={salaryFrom ?? ''}
          onChange={(event) => {
            setPage(1)
            setSalaryFrom(event.target.value ? Number(event.target.value) : undefined)
          }}
        />
      </label>

      <label className="salary-filter__field">
        <span>до</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder=""
          value={salaryTo ?? ''}
          onChange={(event) => {
            setPage(1)
            setSalaryTo(event.target.value ? Number(event.target.value) : undefined)
          }}
        />
      </label>
    </div>

    <div className="salary-filter__currency">
      <CustomSelect
        selectKey="currency"
        label=""
        placeholder="Любая валюта"
        value={currencyId}
        options={currenciesQuery.data || []}
        openSelect={openSelect}
        setOpenSelect={setOpenSelect}
        emptyText={
          currenciesQuery.isLoading
            ? 'Загружаем валюты...'
            : 'Валюты не найдены'
        }
        onChange={(value) => {
          setPage(1)
          setCurrencyId(value)
        }}
      />
    </div>
  </div>
</div>
                </div>
              </aside>

              <div className="vacancies-content">
                {vacanciesQuery.isLoading ? (
                  <div className="vacancies-grid">
                    {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <div key={index} className="vacancy-card vacancy-card--skeleton" />
                    ))}
                  </div>
                ) : null}

                {vacanciesQuery.isSuccess && vacanciesQuery.data?.length === 0 ? (
                  <div className="vacancies-empty">
                    <h3>Ничего не найдено</h3>
                    <p>Попробуй изменить фильтры или сбросить параметры поиска.</p>

                    <button type="button" className="btn btn--outline" onClick={resetFilters}>
                      Сбросить фильтры
                    </button>
                  </div>
                ) : null}

                {vacanciesQuery.isSuccess && vacanciesQuery.data?.length > 0 ? (
                  <>
                    <div className="vacancies-grid">
                      {vacanciesQuery.data.map((vacancy) => {
                        const city =
                          getCityDisplayName(vacancy.city) ||
                          vacancy.city_full_name ||
                          vacancy.city_name

                        const profession = vacancy.profession?.name || vacancy.profession_name
                        const company = vacancy.company?.name || vacancy.company_name
                        const employmentType = getEntityName(vacancy.employment_type)
                        const workSchedule = getEntityName(vacancy.work_schedule)
                        const experience = getEntityName(vacancy.experience)
                        const currency = vacancy.currency || 'BYN'
                        const skills = getSkills(vacancy.skills)

                        return (
                          <article
                            key={vacancy.id}
                            className="vacancy-card"
                            onClick={() => openVacancy(vacancy.id)}
                            onKeyDown={(event) => handleCardKeyDown(event, vacancy.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="vacancy-card__top">
                              <div className="vacancy-card__main">
                                <h3 className="vacancy-card__title">{vacancy.title}</h3>

                                <div className="vacancy-card__company">
                                  {company || 'Компания не указана'}
                                </div>
                              </div>

                              <div className="vacancy-card__salary">
                                {formatSalary(vacancy.salary_min, vacancy.salary_max, currency)}
                              </div>
                            </div>

                            <div className="vacancy-card__meta">
                              {city ? <span className="vacancy-pill">{city}</span> : null}
                              {profession ? (
                                <span className="vacancy-pill">{profession}</span>
                              ) : null}
                              {employmentType ? (
                                <span className="vacancy-pill">{employmentType}</span>
                              ) : null}
                              {workSchedule ? (
                                <span className="vacancy-pill">{workSchedule}</span>
                              ) : null}
                              {experience ? (
                                <span className="vacancy-pill">{experience}</span>
                              ) : null}
                            </div>

                            {vacancy.description ? (
                              <p className="vacancy-card__description">
                                {vacancy.description.length > 150
                                  ? `${vacancy.description.slice(0, 150)}...`
                                  : vacancy.description}
                              </p>
                            ) : null}

                            {skills.length > 0 ? (
                              <div className="vacancy-card__skills">
                                {skills.slice(0, 6).map((skill) => (
                                  <span className="skill-tag" key={skill}>
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="vacancy-card__bottom">
                              <span className="vacancy-card__link">Подробнее о вакансии</span>

                              <button
                                type="button"
                                className="btn btn--primary"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openVacancy(vacancy.id)
                                }}
                              >
                                Открыть
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>

                    {totalPages > 1 ? (
                      <div className="vacancies-pagination">
                        <button
                          type="button"
                          className="vacancies-pagination__btn"
                          onClick={() => goToPage(page - 1)}
                          disabled={page === 1}
                        >
                          Назад
                        </button>

                        <div className="vacancies-pagination__pages">
                          {Array.from({ length: totalPages }).map((_, index) => {
                            const pageNumber = index + 1

                            return (
                              <button
                                key={pageNumber}
                                type="button"
                                className={`vacancies-pagination__page ${
                                  page === pageNumber ? 'is-active' : ''
                                }`}
                                onClick={() => goToPage(pageNumber)}
                              >
                                {pageNumber}
                              </button>
                            )
                          })}
                        </div>

                        <button
                          type="button"
                          className="vacancies-pagination__btn"
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