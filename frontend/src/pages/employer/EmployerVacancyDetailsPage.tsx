import type { AxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './employer-vacancy-details.css'

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

type SkillItem = {
  id: number
  name: string
}

type NamedEntity = {
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

type VacancyResponse = {
  id: number
  title: string
  description: string

  profession_id: number
  city_id: number
  employment_type_id: number
  work_schedule_id: number
  currency_id: number
  experience_id: number
  status_id: number

  salary_min: number
  salary_max: number

  profession?: NamedEntity | null
  city?: NamedEntity | null
  employment_type?: NamedEntity | null
  work_schedule?: NamedEntity | null
  currency?: NamedEntity | null
  experience?: NamedEntity | null
  status?: NamedEntity | null
  skills?: SkillItem[]

  created_at?: string | null
  updated_at?: string | null
}

type CompanyProfile = {
  id: number
  name: string
  logo?: string | null
}

type ComboOption = {
  value: number
  label: string
}

type NoticeState = {
  type: 'success' | 'error'
  text: string
} | null

type NoticeSection = 'actions' | 'main' | 'conditions' | 'description' | 'skills'

type SectionNotices = Partial<Record<NoticeSection, NoticeState>>

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

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const fetchCompanyProfile = async (): Promise<CompanyProfile> => {
  const { data } = await http.get('/companies/me')
  return data
}

const fetchVacancy = async (vacancyId: number): Promise<VacancyResponse> => {
  const { data } = await http.get(`/companies/me/vacancies/${vacancyId}`)
  return data
}

const fetchCatalog = async <T,>(catalogName: string): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit: catalogName === 'cities' ? 1000 : 100 },
  })

  return toArray<T>(data)
}

const fetchProfessions = async (): Promise<CatalogItem[]> => {
  const { data } = await http.get('/public/professions', {
    params: { skip: 0, limit: 100 },
  })

  return toArray<CatalogItem>(data)
}

const updateVacancy = async (vacancyId: number, payload: Record<string, unknown>) => {
  const { data } = await http.put(`/companies/me/vacancies/${vacancyId}`, payload)
  return data
}

const deleteVacancy = async (vacancyId: number) => {
  await http.delete(`/companies/me/vacancies/${vacancyId}`)
}

const addSkillToVacancy = async (vacancyId: number, name: string) => {
  const { data } = await http.post(`/companies/me/vacancies/${vacancyId}/skills`, {
    name,
  })

  return data
}

const removeSkillFromVacancy = async (vacancyId: number, skillId: number) => {
  await http.delete(`/companies/me/vacancies/${vacancyId}/skills/${skillId}`)
}

const uniqueMessages = (messages: string[]) => Array.from(new Set(messages.filter(Boolean)))

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('profession') || lower.includes('професс')) {
    return 'Выберите профессию из списка.'
  }

  if (lower.includes('city') || lower.includes('город')) {
    return 'Выберите город из списка.'
  }

  if (lower.includes('employment') || lower.includes('занятост')) {
    return 'Выберите тип занятости.'
  }

  if (lower.includes('schedule') || lower.includes('график')) {
    return 'Выберите график работы.'
  }

  if (lower.includes('currency') || lower.includes('валют')) {
    return 'Выберите валюту.'
  }

  if (lower.includes('experience') || lower.includes('опыт')) {
    return 'Выберите требуемый опыт.'
  }

  if (lower.includes('salary') || lower.includes('зарплат')) {
    return 'Проверьте зарплату.'
  }

  if (lower.includes('field required')) {
    return 'Заполните обязательные поля.'
  }

  if (lower.includes('unauthorized') || lower.includes('not authenticated')) {
    return 'Сессия истекла. Войдите заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ запрещ')) {
    return 'Недостаточно прав.'
  }

  if (status === 400) return message || 'Некорректные данные.'
  if (status === 401) return 'Сессия истекла. Войдите заново.'
  if (status === 403) return 'Недостаточно прав.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return message || 'Такие данные уже используются.'
  if (status === 422) return message || 'Проверьте корректность данных.'
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError.response?.status
  const data = axiosError.response?.data

  if (!axiosError.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (Array.isArray(data?.detail)) {
    const messages = uniqueMessages(
      data.detail.map((item) => translateApiErrorMessage(item.msg || '', status)),
    )

    return messages[0] || fallback
  }

  if (typeof data?.detail === 'string') {
    return translateApiErrorMessage(data.detail, status)
  }

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error

    if (message) return translateApiErrorMessage(message, status)
  }

  if (data?.message) return translateApiErrorMessage(data.message, status)
  if (data?.error) return translateApiErrorMessage(data.error, status)

  return fallback
}

const parseSalaryInput = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) return 0

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < 0) return null

  return parsed
}

const formatSalary = (min: number, max: number, currency: string) => {
  if (min <= 0 && max <= 0) return 'Зарплата не указана'

  if (min > 0 && max > 0 && min === max) {
    return `${min.toLocaleString('ru-RU')} ${currency}`
  }

  if (min > 0 && max > 0) {
    return `${min.toLocaleString('ru-RU')} — ${max.toLocaleString('ru-RU')} ${currency}`
  }

  if (min > 0) {
    return `от ${min.toLocaleString('ru-RU')} ${currency}`
  }

  return `до ${max.toLocaleString('ru-RU')} ${currency}`
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

const getStatusNameById = (statuses: CatalogItem[], id?: number | null) => {
  if (!id) return ''

  return statuses.find((item) => item.id === id)?.name || ''
}

const isArchivedStatus = (statusName?: string | null) => {
  const value = String(statusName || '').toLowerCase()

  return value.includes('архив') || value.includes('archive')
}

const getCatalogDisplayName = (item?: CatalogItem | NamedEntity | null) => {
  if (!item) return ''

  return item.full_name || item.name
}

const getCityDisplayName = (item?: CatalogItem | NamedEntity | null) => {
  if (!item) return ''

  if (item.full_name) return item.full_name

  const title = item.settlement_type_name
    ? `${item.settlement_type_name} ${item.name}`.trim()
    : item.name

  const parts = [
    title,
    item.district_name,
    item.region_name,
  ].filter(Boolean)

  return parts.join(', ')
}

const makeOptions = (items: CatalogItem[]): ComboOption[] => {
  return items.map((item) => ({
    value: item.id,
    label: getCatalogDisplayName(item),
  }))
}

const makeCityOptions = (items: CatalogItem[]): ComboOption[] => {
  return items.map((item) => ({
    value: item.id,
    label: getCityDisplayName(item),
  }))
}

const makeRegionOptions = (cities: CatalogItem[]): ComboOption[] => {
  const regions = new Map<number, string>()

  cities.forEach((city) => {
    if (city.region_id && city.region_name) {
      regions.set(city.region_id, city.region_name)
    }
  })

  return Array.from(regions.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

const makeDistrictOptions = (cities: CatalogItem[], regionId?: number | null): ComboOption[] => {
  const districts = new Map<number, string>()

  cities.forEach((city) => {
    if (regionId && city.region_id !== regionId) return

    if (city.district_id && city.district_name) {
      districts.set(city.district_id, city.region_name ? `${city.district_name}, ${city.region_name}` : city.district_name)
    }
  })

  return Array.from(districts.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`employer-vacancy-combo__chevron ${open ? 'is-open' : ''}`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type SelectComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: number | null
  emptyText?: string
  onToggle: () => void
  onSelect: (option: ComboOption) => void
}

const SelectCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = 'Нет вариантов',
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`employer-vacancy-combo ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`employer-vacancy-combo__control ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span
          className={
            value
              ? 'employer-vacancy-combo__value'
              : 'employer-vacancy-combo__placeholder'
          }
        >
          {value || placeholder}
        </span>

        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="employer-vacancy-combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`employer-vacancy-combo__option ${
                  activeValue === option.value ? 'is-active' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="employer-vacancy-combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  )
}

const Notice = ({ notice }: { notice: NoticeState }) => {
  if (!notice) return null

  return (
    <div
      className={
        notice.type === 'success'
          ? 'employer-vacancy-notice employer-vacancy-notice--success'
          : 'employer-vacancy-notice employer-vacancy-notice--error'
      }
    >
      {notice.text}
    </div>
  )
}

export const EmployerVacancyDetailsPage = () => {
  const { vacancyId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const numericVacancyId = Number(vacancyId)

  const [notices, setNotices] = useState<SectionNotices>({})
  const [openCombo, setOpenCombo] = useState<string | null>(null)
  const [skillSearch, setSkillSearch] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [professionId, setProfessionId] = useState<number | null>(null)
  const [regionId, setRegionId] = useState<number | null>(null)
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [cityId, setCityId] = useState<number | null>(null)
  const [employmentTypeId, setEmploymentTypeId] = useState<number | null>(null)
  const [workScheduleId, setWorkScheduleId] = useState<number | null>(null)
  const [currencyId, setCurrencyId] = useState<number | null>(null)
  const [experienceId, setExperienceId] = useState<number | null>(null)
  const [statusId, setStatusId] = useState<number | null>(null)

  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [noSalary, setNoSalary] = useState(false)

  const [selectedSkills, setSelectedSkills] = useState<SkillItem[]>([])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.employer-vacancy-combo')) {
        setOpenCombo(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  const companyQuery = useQuery({
    queryKey: ['employer-profile', 'vacancy-details'],
    queryFn: fetchCompanyProfile,
    enabled: Number.isFinite(numericVacancyId) && numericVacancyId > 0,
    retry: false,
  })

  const vacancyQuery = useQuery({
    queryKey: ['employer-vacancy', numericVacancyId],
    queryFn: () => fetchVacancy(numericVacancyId),
    enabled: Number.isFinite(numericVacancyId) && numericVacancyId > 0,
    retry: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['employer-vacancy-professions'],
    queryFn: fetchProfessions,
    retry: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['employer-vacancy-cities'],
    queryFn: () => fetchCatalog<CatalogItem>('cities'),
    retry: false,
  })

  const employmentTypesQuery = useQuery({
    queryKey: ['employer-vacancy-employment-types'],
    queryFn: () => fetchCatalog<CatalogItem>('employment-types'),
    retry: false,
  })

  const workSchedulesQuery = useQuery({
    queryKey: ['employer-vacancy-work-schedules'],
    queryFn: () => fetchCatalog<CatalogItem>('work-schedules'),
    retry: false,
  })

  const currenciesQuery = useQuery({
    queryKey: ['employer-vacancy-currencies'],
    queryFn: () => fetchCatalog<CatalogItem>('currencies'),
    retry: false,
  })

  const experiencesQuery = useQuery({
    queryKey: ['employer-vacancy-experiences'],
    queryFn: () => fetchCatalog<CatalogItem>('experiences'),
    retry: false,
  })

  const statusesQuery = useQuery({
    queryKey: ['employer-vacancy-statuses'],
    queryFn: () => fetchCatalog<CatalogItem>('statuses'),
    retry: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['employer-vacancy-skills-catalog'],
    queryFn: () => fetchCatalog<SkillItem>('skills'),
    retry: false,
  })

  useEffect(() => {
    const vacancy = vacancyQuery.data

    if (!vacancy) return

    const minSalary = Number(vacancy.salary_min || 0)
    const maxSalary = Number(vacancy.salary_max || 0)

    setTitle(vacancy.title || '')
    setDescription(vacancy.description || '')
    setProfessionId(vacancy.profession_id || null)
    setCityId(vacancy.city_id || null)
    setEmploymentTypeId(vacancy.employment_type_id || null)
    setWorkScheduleId(vacancy.work_schedule_id || null)
    setCurrencyId(vacancy.currency_id || null)
    setExperienceId(vacancy.experience_id || null)
    setStatusId(vacancy.status_id || null)

    setSalaryMin(minSalary > 0 ? String(minSalary) : '')
    setSalaryMax(maxSalary > 0 ? String(maxSalary) : '')
    setNoSalary(minSalary <= 0 && maxSalary <= 0)

    setSelectedSkills(toArray<SkillItem>(vacancy.skills))
  }, [vacancyQuery.data])

  const professions = professionsQuery.data || []
  const cities = citiesQuery.data || []
  const employmentTypes = employmentTypesQuery.data || []
  const workSchedules = workSchedulesQuery.data || []
  const currencies = currenciesQuery.data || []
  const experiences = experiencesQuery.data || []
  const statuses = statusesQuery.data || []
  const skillCatalog = skillsQuery.data || []

  const professionOptions = useMemo(() => makeOptions(professions), [professions])
  const regionOptions = useMemo(() => makeRegionOptions(cities), [cities])
  const districtOptions = useMemo(() => makeDistrictOptions(cities, regionId), [cities, regionId])
  const filteredCities = useMemo(() => {
    return cities
      .filter((city) => {
        if (regionId && city.region_id !== regionId) return false
        if (districtId && city.district_id !== districtId) return false
        return true
      })
      .sort((a, b) => getCityDisplayName(a).localeCompare(getCityDisplayName(b), 'ru'))
  }, [cities, regionId, districtId])
  const cityOptions = useMemo(() => makeCityOptions(filteredCities), [filteredCities])
  const employmentTypeOptions = useMemo(() => makeOptions(employmentTypes), [employmentTypes])
  const workScheduleOptions = useMemo(() => makeOptions(workSchedules), [workSchedules])
  const currencyOptions = useMemo(() => makeOptions(currencies), [currencies])
  const experienceOptions = useMemo(() => makeOptions(experiences), [experiences])

  const selectedProfession = professionOptions.find((item) => item.value === professionId)
  const selectedRegion = regionOptions.find((item) => item.value === regionId)
  const selectedDistrict = districtOptions.find((item) => item.value === districtId)
  const selectedCityItem = cities.find((item) => item.id === cityId)
  const selectedCity = selectedCityItem
    ? {
        value: selectedCityItem.id,
        label: getCityDisplayName(selectedCityItem),
      }
    : cityOptions.find((item) => item.value === cityId)
  const selectedEmploymentType = employmentTypeOptions.find(
    (item) => item.value === employmentTypeId,
  )
  const selectedWorkSchedule = workScheduleOptions.find((item) => item.value === workScheduleId)
  const selectedCurrency = currencyOptions.find((item) => item.value === currencyId)
  const selectedExperience = experienceOptions.find((item) => item.value === experienceId)

  useEffect(() => {
    if (!cityId || !cities.length) return

    const city = cities.find((item) => item.id === cityId)

    if (!city) return

    if (city.region_id && regionId !== city.region_id) {
      setRegionId(city.region_id)
    }

    if (city.district_id && districtId !== city.district_id) {
      setDistrictId(city.district_id)
    }
  }, [cityId, cities, regionId, districtId])

  const filteredSkills = useMemo(() => {
    const value = skillSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const base = value
      ? skillCatalog.filter((item) => item.name.toLowerCase().includes(value))
      : skillCatalog

    return base.filter((item) => !selectedIds.has(item.id)).slice(0, 20)
  }, [skillSearch, skillCatalog, selectedSkills])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateVacancy(numericVacancyId, payload),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteVacancy(numericVacancyId),
  })

  const addSkillMutation = useMutation({
    mutationFn: (name: string) => addSkillToVacancy(numericVacancyId, name),
  })

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: number) => removeSkillFromVacancy(numericVacancyId, skillId),
  })

  const clearNotice = (section: NoticeSection) => {
    setNotices((prev) => ({
      ...prev,
      [section]: null,
    }))
  }

  const setSectionNotice = (section: NoticeSection, notice: NoticeState) => {
    setNotices((prev) => ({
      ...prev,
      [section]: notice,
    }))
  }

  const validateMainSection = () => {
    const normalizedTitle = title.trim()

    if (!normalizedTitle) return 'Укажите название вакансии.'
    if (normalizedTitle.length < 3) return 'Название вакансии слишком короткое.'
    if (normalizedTitle.length > 120) {
      return 'Название вакансии должно быть не длиннее 120 символов.'
    }

    if (!professionId) return 'Выберите профессию.'
    if (!cityId) return 'Выберите город.'

    return ''
  }

  const validateConditionsSection = () => {
    if (!employmentTypeId) return 'Выберите тип занятости.'
    if (!workScheduleId) return 'Выберите график работы.'
    if (!experienceId) return 'Выберите опыт.'
    if (!currencyId) return 'Выберите валюту.'

    if (!noSalary) {
      const min = parseSalaryInput(salaryMin)
      const max = parseSalaryInput(salaryMax)

      if (min === null) return 'Зарплата от должна быть целым числом или пустой.'
      if (max === null) return 'Зарплата до должна быть целым числом или пустой.'
      if (min > 0 && max > 0 && min > max) {
        return 'Зарплата до не может быть меньше зарплаты от.'
      }
    }

    return ''
  }

  const validateDescriptionSection = () => {
    const normalizedDescription = description.trim()

    if (!normalizedDescription) return 'Добавьте описание вакансии.'
    if (normalizedDescription.length < 40) {
      return 'Описание слишком короткое. Минимум 40 символов.'
    }

    return ''
  }

  const validateSkillsSection = () => {
    if (selectedSkills.length === 0) return 'Добавьте хотя бы один ключевой навык.'
    return ''
  }

  const buildPayload = () => {
    const min = noSalary ? 0 : parseSalaryInput(salaryMin)
    const max = noSalary ? 0 : parseSalaryInput(salaryMax)

    return {
      title: title.trim(),
      description: description.trim(),
      profession_id: professionId,
      city_id: cityId,
      employment_type_id: employmentTypeId,
      work_schedule_id: workScheduleId,
      experience_id: experienceId,
      currency_id: currencyId,
      salary_min: min || 0,
      salary_max: max || 0,
    }
  }

  const validateSection = (section: NoticeSection) => {
    if (section === 'main') return validateMainSection()
    if (section === 'conditions') return validateConditionsSection()
    if (section === 'description') return validateDescriptionSection()
    if (section === 'skills') return validateSkillsSection()

    return ''
  }

  const handleSave = async (section: 'main' | 'conditions' | 'description') => {
    clearNotice(section)

    const error = validateSection(section)

    if (error) {
      setSectionNotice(section, { type: 'error', text: error })
      return
    }

    try {
      await updateMutation.mutateAsync(buildPayload())

      await queryClient.invalidateQueries({ queryKey: ['employer-vacancy', numericVacancyId] })
      await queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] })

      setSectionNotice(section, { type: 'success', text: 'Вакансия сохранена.' })
    } catch (error) {
      setSectionNotice(section, {
        type: 'error',
        text: getErrorMessage(error, 'Не удалось сохранить вакансию.'),
      })
    }
  }

  const handleArchiveToggle = async () => {
    clearNotice('actions')

    const currentStatusName =
      getStatusNameById(statuses, statusId) || vacancyQuery.data?.status?.name || ''

    const archivedNow = isArchivedStatus(currentStatusName)
    const nextStatusId = archivedNow ? findActiveStatusId(statuses) : findArchivedStatusId(statuses)

    try {
      await updateMutation.mutateAsync({ status_id: nextStatusId })

      setStatusId(nextStatusId)

      queryClient.setQueryData<VacancyResponse>(
        ['employer-vacancy', numericVacancyId],
        (old) => {
          if (!old) return old

          const nextStatus = statuses.find((item) => item.id === nextStatusId)

          return {
            ...old,
            status_id: nextStatusId,
            status: nextStatus
              ? {
                  id: nextStatus.id,
                  name: nextStatus.name,
                }
              : old.status,
          }
        },
      )

      await queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] })

      setSectionNotice('actions', {
        type: 'success',
        text: archivedNow ? 'Вакансия возвращена из архива.' : 'Вакансия отправлена в архив.',
      })
    } catch (error) {
      setSectionNotice('actions', {
        type: 'error',
        text: getErrorMessage(error, 'Не удалось изменить статус вакансии.'),
      })
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm('Удалить эту вакансию?')

    if (!confirmed) return

    clearNotice('actions')

    try {
      await deleteMutation.mutateAsync()

      await queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] })

      navigate('/employer/vacancies')
    } catch (error) {
      setSectionNotice('actions', {
        type: 'error',
        text: getErrorMessage(error, 'Не удалось удалить вакансию.'),
      })
    }
  }

  const handleOpenPublicVacancy = () => {
    const openedWindow = window.open(
      `/vacancies/${numericVacancyId}`,
      '_blank',
      'noopener,noreferrer',
    )

    if (openedWindow) {
      openedWindow.opener = null
    }
  }

  const addSkillLocal = (skill: SkillItem) => {
    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev

      return [...prev, skill]
    })

    setSkillSearch('')
  }

  const removeSkillLocal = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId))
  }

  const handleSaveSkills = async () => {
    clearNotice('skills')

    const error = validateSkillsSection()

    if (error) {
      setSectionNotice('skills', { type: 'error', text: error })
      return
    }

    const currentSkills = toArray<SkillItem>(vacancyQuery.data?.skills)
    const currentIds = new Set(currentSkills.map((item) => item.id))
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const toRemove = currentSkills.filter((item) => !selectedIds.has(item.id))
    const toAdd = selectedSkills.filter((item) => !currentIds.has(item.id))

    try {
      for (const skill of toRemove) {
        await removeSkillMutation.mutateAsync(skill.id)
      }

      for (const skill of toAdd) {
        await addSkillMutation.mutateAsync(skill.name)
      }

      await queryClient.invalidateQueries({ queryKey: ['employer-vacancy', numericVacancyId] })
      await queryClient.invalidateQueries({ queryKey: ['employer-vacancies'] })

      setSectionNotice('skills', { type: 'success', text: 'Навыки сохранены.' })
    } catch (error) {
      setSectionNotice('skills', {
        type: 'error',
        text: getErrorMessage(error, 'Не удалось сохранить навыки.'),
      })
    }
  }

  if (!vacancyId || Number.isNaN(numericVacancyId) || numericVacancyId <= 0) {
    return (
      <div className="employer-vacancy-page">
        <Header />

        <main className="employer-vacancy-page__main">
          <div className="employer-vacancy-container">
            <div className="employer-vacancy-empty">Некорректный идентификатор вакансии.</div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isLoading || companyQuery.isLoading) {
    return (
      <div className="employer-vacancy-page">
        <Header />

        <main className="employer-vacancy-page__main">
          <div className="employer-vacancy-container">
            <div className="employer-vacancy-empty">Загрузка вакансии...</div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  if (vacancyQuery.isError) {
    return (
      <div className="employer-vacancy-page">
        <Header />

        <main className="employer-vacancy-page__main">
          <div className="employer-vacancy-container">
            <div className="employer-vacancy-empty employer-vacancy-empty--error">
              {getErrorMessage(vacancyQuery.error, 'Не удалось загрузить вакансию.')}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  const vacancy = vacancyQuery.data
  const company = companyQuery.data

  const currentStatusName = getStatusNameById(statuses, statusId) || vacancy?.status?.name || ''
  const archived = isArchivedStatus(currentStatusName)

  const currencyName = selectedCurrency?.label || vacancy?.currency?.name || 'BYN'

  const previewSalaryMin = noSalary ? 0 : parseSalaryInput(salaryMin) || 0
  const previewSalaryMax = noSalary ? 0 : parseSalaryInput(salaryMax) || 0

  const previewProfession = selectedProfession?.label || vacancy?.profession?.name || 'Профессия'
  const previewCity = selectedCity?.label || getCityDisplayName(vacancy?.city) || 'Город'
  const previewCompany = company?.name || 'Компания'
  const companyHref = company?.id ? `/companies/${company.id}` : ''

  return (
    <div className="employer-vacancy-page">
      <Header />

      <main className="employer-vacancy-page__main">
        <div className="employer-vacancy-container">
          <section className="employer-vacancy-card employer-vacancy-hero">
            <div className="employer-vacancy-hero__actions">
              <button
                type="button"
                className="employer-vacancy-btn employer-vacancy-btn--outline"
                onClick={() => navigate('/employer/vacancies')}
              >
                ← Назад к вакансиям
              </button>

              <div className="employer-vacancy-hero__right-actions">
                <button
                  type="button"
                  className="employer-vacancy-btn employer-vacancy-btn--ghost"
                  onClick={handleOpenPublicVacancy}
                >
                  Открыть на сайте
                </button>

                <button
                  type="button"
                  className="employer-vacancy-btn employer-vacancy-btn--outline"
                  onClick={handleArchiveToggle}
                  disabled={updateMutation.isPending}
                >
                  {archived ? 'Вернуть из архива' : 'В архив'}
                </button>

                <button
                  type="button"
                  className="employer-vacancy-btn employer-vacancy-btn--danger"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  Удалить
                </button>
              </div>
            </div>

            <Notice notice={notices.actions || null} />
          </section>

          <section className="employer-vacancy-preview">
            <div className="vacancy-detail-hero__card">
              <div className="vacancy-detail-hero__breadcrumbs">
                <Link to="/vacancies">Вакансии</Link>
                <span>•</span>
                <span>{previewProfession}</span>
              </div>

              <div className="vacancy-detail-hero__top">
                <div className="vacancy-detail-hero__main">
                  <h1 className="vacancy-detail-hero__title">
                    {title.trim() || 'Название вакансии'}
                  </h1>

                  {companyHref ? (
                    <Link
                      to={companyHref}
                      className="vacancy-detail-hero__company vacancy-detail-hero__company--link"
                    >
                      {previewCompany}
                    </Link>
                  ) : (
                    <div className="vacancy-detail-hero__company">{previewCompany}</div>
                  )}

                  <div className="vacancy-detail-hero__location">{previewCity}</div>
                </div>

                <div className="vacancy-detail-hero__salary-box">
                  <strong className="vacancy-detail-hero__salary-value">
                    {formatSalary(previewSalaryMin, previewSalaryMax, currencyName)}
                  </strong>
                </div>
              </div>

              <div className="vacancy-detail-hero__meta">
                <span className="vacancy-detail-pill">{previewProfession}</span>

                <span className="vacancy-detail-pill">
                  {selectedEmploymentType?.label ||
                    vacancy?.employment_type?.name ||
                    'Тип занятости'}
                </span>

                <span className="vacancy-detail-pill">
                  {selectedWorkSchedule?.label || vacancy?.work_schedule?.name || 'График'}
                </span>

                <span className="vacancy-detail-pill">
                  {selectedExperience?.label || vacancy?.experience?.name || 'Опыт'}
                </span>
              </div>

              <div className="vacancy-detail-hero__actions">
                <button
                  type="button"
                  className="vacancy-detail-apply-btn"
                  disabled
                >
                  Откликнуться
                </button>
              </div>
            </div>

            <div className="employer-vacancy-preview__grid">
              <article className="employer-vacancy-preview__block">
                <h3>Описание вакансии</h3>

                <p>{description.trim() || 'Описание не заполнено.'}</p>
              </article>

              <article className="employer-vacancy-preview__block">
                <h3>Ключевые навыки</h3>

                {selectedSkills.length > 0 ? (
                  <div className="employer-vacancy-preview__skills">
                    {selectedSkills.map((skill) => (
                      <span key={skill.id}>{skill.name}</span>
                    ))}
                  </div>
                ) : (
                  <p>Навыки не указаны.</p>
                )}
              </article>
            </div>
          </section>

          <section className="employer-vacancy-card employer-vacancy-section">
            <div className="employer-vacancy-section__head">
              <div>
                <h2>Основные данные</h2>

                <p>Название, профессия и город вакансии.</p>
              </div>

              <button
                type="button"
                className="employer-vacancy-btn employer-vacancy-btn--primary"
                onClick={() => handleSave('main')}
                disabled={updateMutation.isPending}
              >
                Сохранить
              </button>
            </div>

            <Notice notice={notices.main || null} />

            <div className="employer-vacancy-form-grid employer-vacancy-form-grid--two">
              <label className="employer-vacancy-field employer-vacancy-field--full">
                <span>Название вакансии</span>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Например: Frontend-разработчик"
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Профессия</span>

                <SelectCombo
                  value={selectedProfession?.label || ''}
                  placeholder="Выберите профессию"
                  isOpen={openCombo === 'profession'}
                  options={professionOptions}
                  activeValue={professionId}
                  emptyText={
                    professionsQuery.isLoading ? 'Загружаем профессии...' : 'Профессии не найдены'
                  }
                  onToggle={() =>
                    setOpenCombo((prev) => (prev === 'profession' ? null : 'profession'))
                  }
                  onSelect={(option) => {
                    setProfessionId(option.value)
                    setOpenCombo(null)
                    clearNotice('main')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Область</span>

                <SelectCombo
                  value={selectedRegion?.label || ''}
                  placeholder="Выберите область"
                  isOpen={openCombo === 'region'}
                  options={regionOptions}
                  activeValue={regionId}
                  emptyText={citiesQuery.isLoading ? 'Загружаем области...' : 'Области не найдены'}
                  onToggle={() => setOpenCombo((prev) => (prev === 'region' ? null : 'region'))}
                  onSelect={(option) => {
                    setRegionId(option.value)
                    setDistrictId(null)
                    setCityId(null)
                    setOpenCombo(null)
                    clearNotice('main')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Район</span>

                <SelectCombo
                  value={selectedDistrict?.label || ''}
                  placeholder={regionId ? 'Выберите район' : 'Сначала выберите область'}
                  isOpen={openCombo === 'district'}
                  options={districtOptions}
                  activeValue={districtId}
                  emptyText={
                    citiesQuery.isLoading
                      ? 'Загружаем районы...'
                      : regionId
                        ? 'Районы не найдены'
                        : 'Сначала выберите область'
                  }
                  onToggle={() => setOpenCombo((prev) => (prev === 'district' ? null : 'district'))}
                  onSelect={(option) => {
                    setDistrictId(option.value)
                    setCityId(null)
                    setOpenCombo(null)
                    clearNotice('main')
                  }}
                />
              </label>

              <label className="employer-vacancy-field employer-vacancy-field--full">
                <span>Город / населённый пункт</span>

                <SelectCombo
                  value={selectedCity?.label || ''}
                  placeholder={districtId ? 'Выберите город' : 'Сначала выберите район'}
                  isOpen={openCombo === 'city'}
                  options={cityOptions}
                  activeValue={cityId}
                  emptyText={
                    citiesQuery.isLoading
                      ? 'Загружаем города...'
                      : districtId
                        ? 'Города не найдены'
                        : 'Сначала выберите район'
                  }
                  onToggle={() => setOpenCombo((prev) => (prev === 'city' ? null : 'city'))}
                  onSelect={(option) => {
                    const city = cities.find((item) => item.id === option.value)

                    if (city?.region_id) setRegionId(city.region_id)
                    if (city?.district_id) setDistrictId(city.district_id)

                    setCityId(option.value)
                    setOpenCombo(null)
                    clearNotice('main')
                  }}
                />
              </label>
            </div>
          </section>

          <section className="employer-vacancy-card employer-vacancy-section">
            <div className="employer-vacancy-section__head">
              <div>
                <h2>Условия работы</h2>

                <p>Формат занятости, график, опыт и зарплата.</p>
              </div>

              <button
                type="button"
                className="employer-vacancy-btn employer-vacancy-btn--primary"
                onClick={() => handleSave('conditions')}
                disabled={updateMutation.isPending}
              >
                Сохранить
              </button>
            </div>

            <Notice notice={notices.conditions || null} />

            <div className="employer-vacancy-form-grid employer-vacancy-form-grid--two">
              <label className="employer-vacancy-field">
                <span>Тип занятости</span>

                <SelectCombo
                  value={selectedEmploymentType?.label || ''}
                  placeholder="Выберите тип"
                  isOpen={openCombo === 'employmentType'}
                  options={employmentTypeOptions}
                  activeValue={employmentTypeId}
                  emptyText={
                    employmentTypesQuery.isLoading
                      ? 'Загружаем типы занятости...'
                      : 'Нет вариантов'
                  }
                  onToggle={() =>
                    setOpenCombo((prev) =>
                      prev === 'employmentType' ? null : 'employmentType',
                    )
                  }
                  onSelect={(option) => {
                    setEmploymentTypeId(option.value)
                    setOpenCombo(null)
                    clearNotice('conditions')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>График работы</span>

                <SelectCombo
                  value={selectedWorkSchedule?.label || ''}
                  placeholder="Выберите график"
                  isOpen={openCombo === 'workSchedule'}
                  options={workScheduleOptions}
                  activeValue={workScheduleId}
                  emptyText={
                    workSchedulesQuery.isLoading ? 'Загружаем графики...' : 'Нет вариантов'
                  }
                  onToggle={() =>
                    setOpenCombo((prev) =>
                      prev === 'workSchedule' ? null : 'workSchedule',
                    )
                  }
                  onSelect={(option) => {
                    setWorkScheduleId(option.value)
                    setOpenCombo(null)
                    clearNotice('conditions')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Опыт</span>

                <SelectCombo
                  value={selectedExperience?.label || ''}
                  placeholder="Выберите опыт"
                  isOpen={openCombo === 'experience'}
                  options={experienceOptions}
                  activeValue={experienceId}
                  emptyText={experiencesQuery.isLoading ? 'Загружаем опыт...' : 'Нет вариантов'}
                  onToggle={() =>
                    setOpenCombo((prev) => (prev === 'experience' ? null : 'experience'))
                  }
                  onSelect={(option) => {
                    setExperienceId(option.value)
                    setOpenCombo(null)
                    clearNotice('conditions')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Валюта</span>

                <SelectCombo
                  value={selectedCurrency?.label || ''}
                  placeholder="Выберите валюту"
                  isOpen={openCombo === 'currency'}
                  options={currencyOptions}
                  activeValue={currencyId}
                  emptyText={currenciesQuery.isLoading ? 'Загружаем валюты...' : 'Нет вариантов'}
                  onToggle={() =>
                    setOpenCombo((prev) => (prev === 'currency' ? null : 'currency'))
                  }
                  onSelect={(option) => {
                    setCurrencyId(option.value)
                    setOpenCombo(null)
                    clearNotice('conditions')
                  }}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Зарплата от</span>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={salaryMin}
                  disabled={noSalary}
                  onChange={(event) => {
                    setSalaryMin(event.target.value)
                    clearNotice('conditions')
                  }}
                  placeholder={noSalary ? 'Зарплата не указывается' : 'Зарплата от'}
                />
              </label>

              <label className="employer-vacancy-field">
                <span>Зарплата до</span>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={salaryMax}
                  disabled={noSalary}
                  onChange={(event) => {
                    setSalaryMax(event.target.value)
                    clearNotice('conditions')
                  }}
                  placeholder={noSalary ? 'Зарплата не указывается' : 'Зарплата до'}
                />
              </label>

              <label className="employer-vacancy-salary-toggle">
                <input
                  type="checkbox"
                  checked={noSalary}
                  onChange={(event) => {
                    const checked = event.target.checked

                    setNoSalary(checked)
                    clearNotice('conditions')

                    if (checked) {
                      setSalaryMin('')
                      setSalaryMax('')
                    }
                  }}
                />

                <span>
                  <strong>Не указывать зарплату</strong>
                </span>
              </label>
            </div>
          </section>

          <section className="employer-vacancy-card employer-vacancy-section">
            <div className="employer-vacancy-section__head">
              <div>
                <h2>Описание вакансии</h2>

                <p>Минимум 40 символов. Опишите задачи, требования и условия.</p>
              </div>

              <button
                type="button"
                className="employer-vacancy-btn employer-vacancy-btn--primary"
                onClick={() => handleSave('description')}
                disabled={updateMutation.isPending}
              >
                Сохранить
              </button>
            </div>

            <Notice notice={notices.description || null} />

            <label className="employer-vacancy-field">
              <span>Описание</span>

              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  clearNotice('description')
                }}
                maxLength={5000}
                placeholder="Расскажите, чем будет заниматься кандидат, какие навыки нужны и что предлагает компания."
              />
            </label>

            <div className="employer-vacancy-counter">{description.trim().length}/5000 символов</div>
          </section>

          <section className="employer-vacancy-card employer-vacancy-section">
            <div className="employer-vacancy-section__head">
              <div>
                <h2>Ключевые навыки</h2>

                <p>Навыки отображаются в карточке вакансии.</p>
              </div>

              <button
                type="button"
                className="employer-vacancy-btn employer-vacancy-btn--primary"
                onClick={handleSaveSkills}
                disabled={addSkillMutation.isPending || removeSkillMutation.isPending}
              >
                Сохранить навыки
              </button>
            </div>

            <Notice notice={notices.skills || null} />

            <label className="employer-vacancy-field">
              <span>Поиск навыка</span>

              <input
                value={skillSearch}
                onChange={(event) => {
                  setSkillSearch(event.target.value)
                  clearNotice('skills')
                }}
                placeholder="Например: React"
              />
            </label>

            {filteredSkills.length > 0 ? (
              <div className="employer-vacancy-chip-list">
                {filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className="employer-vacancy-chip"
                    onClick={() => {
                      addSkillLocal(skill)
                      clearNotice('skills')
                    }}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedSkills.length > 0 ? (
              <div className="employer-vacancy-chip-list employer-vacancy-chip-list--selected">
                {selectedSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className="employer-vacancy-chip employer-vacancy-chip--selected"
                    onClick={() => {
                      removeSkillLocal(skill.id)
                      clearNotice('skills')
                    }}
                  >
                    {skill.name} ×
                  </button>
                ))}
              </div>
            ) : (
              <div className="employer-vacancy-empty-inline">Навыки пока не выбраны.</div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}