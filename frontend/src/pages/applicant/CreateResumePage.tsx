import type { AxiosError } from 'axios'
import './create-resume.css'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'


type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  gender?: string | null
  phone?: string | null
  birth_date?: string | null
  city?: CityItem | null
}

type ProfessionItem = {
  id: number
  name: string
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

type CityItem = {
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

type SkillItem = {
  id: number
  name: string
}

type EducationInstitutionItem = {
  id: number
  name: string
}

type ApplicantEducationItem = {
  id: number
  institution_id?: number | null
  educational_institution_id?: number | null
  institution?: {
    id: number
    name: string
  } | null
  educational_institution?: {
    id: number
    name: string
  } | null
  institution_name?: string | null
  educational_institution_name?: string | null
  start_date?: string | null
  end_date?: string | null
}

type ResumeResponse = {
  id: number
  profession_id?: number | null
  profession?: {
    id: number
    name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
}

type EducationDraft = {
  id?: number
  localId: string
  institution_id?: number
  institution_name: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
}

type WorkExperienceDraft = {
  localId: string
  company_name: string
  position: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
  is_current: boolean
  description: string
}

type StepKey = 'profession' | 'profile' | 'education' | 'skills' | 'experience'

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

const STEPS: StepKey[] = ['profession', 'profile', 'education', 'skills', 'experience']

const STEP_TITLES: Record<StepKey, string> = {
  profession: 'Профессия',
  profile: 'Профиль',
  education: 'Образование',
  skills: 'Навыки',
  experience: 'Опыт',
}

const monthOptions: ComboOption[] = [
  { value: '01', label: 'Январь' },
  { value: '02', label: 'Февраль' },
  { value: '03', label: 'Март' },
  { value: '04', label: 'Апрель' },
  { value: '05', label: 'Май' },
  { value: '06', label: 'Июнь' },
  { value: '07', label: 'Июль' },
  { value: '08', label: 'Август' },
  { value: '09', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
]

const currentYear = new Date().getFullYear()

const birthYearOptions: ComboOption[] = Array.from({ length: 81 }, (_, index) => {
  const year = String(currentYear - index)
  return { value: year, label: year }
})

const resumeYearOptions: ComboOption[] = Array.from({ length: 61 }, (_, index) => {
  const year = String(currentYear - index)
  return { value: year, label: year }
})

const phoneRegex = /^\+?[1-9]\d{8,14}$/

const makeLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const normalizePhone = (value: string) => {
  return value.replace(/[()\-\s]/g, '').trim()
}

const uniqueMessages = (messages: string[]) => Array.from(new Set(messages.filter(Boolean)))

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (
    lower.includes('applicants_phone_key') ||
    lower.includes('key (phone)') ||
    lower.includes('phone already') ||
    lower.includes('phone exists') ||
    lower.includes('телефон уже') ||
    lower.includes('номер уже')
  ) {
    return 'Телефон уже используется другим аккаунтом.'
  }

  if (
    lower.includes('users_email_key') ||
    lower.includes('key (email)') ||
    lower.includes('email already') ||
    lower.includes('email exists') ||
    lower.includes('email уже') ||
    lower.includes('почта уже')
  ) {
    return 'Email уже используется другим аккаунтом.'
  }

  if (
    lower.includes('invalid profession') ||
    lower.includes('profession_id') ||
    lower.includes('профессия не найдена')
  ) {
    return 'Выберите профессию из списка.'
  }

  if (
    lower.includes('institution') ||
    lower.includes('учебное заведение')
  ) {
    return 'Выберите учебное заведение из списка.'
  }

  if (
    lower.includes('city') ||
    lower.includes('город')
  ) {
    return 'Выберите город из списка.'
  }

  if (
    lower.includes('phone') &&
    (lower.includes('invalid') || lower.includes('некоррект'))
  ) {
    return 'Введите телефон в формате +375291234567.'
  }

  if (lower.includes('field required')) {
    return 'Заполните обязательные поля.'
  }

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ запрещ')) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (status === 400) return message || 'Некорректные данные.'
  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return message || 'Такие данные уже используются.'
  if (status === 422) return message || 'Проверьте корректность введённых данных.'
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  if (message.length > 220) {
    return 'Не удалось сохранить данные. Проверьте форму и попробуйте снова.'
  }

  return message || 'Не удалось сохранить данные.'
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
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

  if (data?.message) {
    return translateApiErrorMessage(data.message, status)
  }

  if (data?.error) {
    return translateApiErrorMessage(data.error, status)
  }

  switch (status) {
    case 400:
      return 'Некорректные данные. Проверьте форму.'
    case 401:
      return 'Сессия истекла. Войдите в аккаунт заново.'
    case 403:
      return 'Недостаточно прав для выполнения действия.'
    case 404:
      return 'Данные не найдены.'
    case 409:
      return 'Такие данные уже используются.'
    case 422:
      return 'Проверьте корректность введённых данных.'
    case 429:
      return 'Слишком много попыток. Попробуйте позже.'
    default:
      return status && status >= 500 ? 'Ошибка сервера. Попробуйте позже.' : fallback
  }
}

const getDaysInMonth = (year: string, month: string) => {
  if (!month) return 31

  const parsedYear = year ? Number(year) : 2000
  const parsedMonth = Number(month)

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return 31

  return new Date(parsedYear, parsedMonth, 0).getDate()
}

const makeDayOptions = (year: string, month: string): ComboOption[] => {
  const daysCount = getDaysInMonth(year, month)

  return Array.from({ length: daysCount }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return { value: day, label: day }
  })
}

const isRealDate = (day: string, month: string, year: string) => {
  const parsedDay = Number(day)
  const parsedMonth = Number(month)
  const parsedYear = Number(year)

  if (
    !Number.isInteger(parsedDay) ||
    !Number.isInteger(parsedMonth) ||
    !Number.isInteger(parsedYear)
  ) {
    return false
  }

  const date = new Date(parsedYear, parsedMonth - 1, parsedDay)

  return (
    date.getFullYear() === parsedYear &&
    date.getMonth() === parsedMonth - 1 &&
    date.getDate() === parsedDay
  )
}

const getStartOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const validateBirthDate = (day: string, month: string, year: string) => {
  if (!day || !month || !year) {
    return 'Укажите дату рождения полностью.'
  }

  if (!isRealDate(day, month, year)) {
    return 'Такой даты рождения не существует.'
  }

  const today = getStartOfDay(new Date())
  const minDate = new Date(today)
  minDate.setFullYear(today.getFullYear() - 80)

  const birthDate = new Date(Number(year), Number(month) - 1, Number(day))

  if (birthDate > today) {
    return 'Дата рождения не может быть в будущем.'
  }

  if (birthDate < minDate) {
    return 'Дата рождения должна быть в пределах последних 80 лет.'
  }

  return ''
}

const formatBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) {
    return { day: '', month: '', year: '' }
  }

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (!match) {
    return { day: '', month: '', year: '' }
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  }
}

const formatMonthYearParts = (value?: string | null) => {
  if (!value) {
    return { month: '', year: '' }
  }

  const match = value.match(/^(\d{4})-(\d{2})-\d{2}/)

  if (!match) {
    return { month: '', year: '' }
  }

  return {
    year: match[1],
    month: match[2],
  }
}

const buildBirthDate = (day: string, month: string, year: string) => {
  if (!day || !month || !year) return null
  return `${year}-${month}-${day}`
}

const buildMonthYearDate = (month: string, year: string) => {
  if (!month || !year) return null
  return `${year}-${month}-01`
}

const monthYearToNumber = (month: string, year: string) => {
  if (!month || !year) return null

  const parsed = Number(`${year}${month}`)
  return Number.isFinite(parsed) ? parsed : null
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

const isMonthYearInFuture = (month: string, year: string) => {
  const value = monthYearToNumber(month, year)
  if (!value) return false

  const now = new Date()
  const currentValue = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`)

  return value > currentValue
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile | null> => {
  const { data } = await http.get('/applicants/me')
  return data || null
}

const fetchApplicantEducations = async (): Promise<ApplicantEducationItem[]> => {
  const { data } = await http.get('/applicants/me/education')

  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data

  return []
}

const fetchCatalog = async <T,>(catalogName: string, limit = 100): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit },
  })

  return Array.isArray(data) ? data : []
}

const fetchProfessions = async (): Promise<ProfessionItem[]> => {
  const { data } = await http.get('/public/professions', {
    params: { skip: 0, limit: 100 },
  })

  return Array.isArray(data) ? data : []
}

const updateApplicantProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/applicants/me', payload)
  return data
}

const createResume = async (payload: Record<string, unknown>): Promise<ResumeResponse> => {
  const { data } = await http.post('/applicants/me/resumes', payload)
  return data
}

const addEducation = async (payload: Record<string, unknown>) => {
  const { data } = await http.post('/applicants/me/education', payload)
  return data
}

const addSkillsBatch = async (resumeId: number, payload: { skills: string[] }) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/skills/batch`, payload)
  return data
}

const addWorkExperience = async (resumeId: number, payload: Record<string, unknown>) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/work-experiences`, payload)
  return data
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`combo-field__chevron ${open ? 'is-open' : ''}`}
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

type SearchComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: string | number | null
  emptyText?: string
  onFocus: () => void
  onChange: (value: string) => void
  onSelect: (option: ComboOption) => void
}

const SearchCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = 'Ничего не найдено',
  onFocus,
  onChange,
  onSelect,
}: SearchComboProps) => {
  return (
    <div className={`combo ${isOpen ? 'is-open' : ''}`}>
      <input
        className={`combo-input ${isOpen ? 'is-open' : ''}`}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />

      {isOpen && (
        <div className="combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`combo__option ${
                  String(activeValue) === String(option.value) ? 'is-active' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  )
}

type SelectComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: string | number | null
  disabled?: boolean
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
  disabled = false,
  emptyText = 'Нет вариантов',
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`combo ${disabled ? 'is-disabled' : ''} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`combo-field ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <span className={value ? 'combo-field__value' : 'combo-field__placeholder'}>
          {value || placeholder}
        </span>

        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && !disabled && (
        <div className="combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`combo__option ${
                  String(activeValue) === String(option.value) ? 'is-active' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  )
}

export const CreateResumePage = () => {
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [openCombo, setOpenCombo] = useState<string | null>(null)
  const [profileInitialized, setProfileInitialized] = useState(false)
  const [educationInitialized, setEducationInitialized] = useState(false)

  const [professionSearch, setProfessionSearch] = useState('')
  const [selectedProfessionId, setSelectedProfessionId] = useState<number | null>(null)
  const [selectedProfessionName, setSelectedProfessionName] = useState('')

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [gender, setGender] = useState<'Мужской' | 'Женский' | ''>('')

  const [regionId, setRegionId] = useState<number | null>(null)
  const [regionName, setRegionName] = useState('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [districtName, setDistrictName] = useState('')
  const [cityId, setCityId] = useState<number | null>(null)
  const [cityName, setCityName] = useState('')

  const [phone, setPhone] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [educations, setEducations] = useState<EducationDraft[]>([
    {
      localId: makeLocalId(),
      institution_name: '',
      start_month: '',
      start_year: '',
      end_month: '',
      end_year: '',
    },
  ])

  const [skillSearch, setSkillSearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<SkillItem[]>([])

  const [experiences, setExperiences] = useState<WorkExperienceDraft[]>([
    {
      localId: makeLocalId(),
      company_name: '',
      position: '',
      start_month: '',
      start_year: '',
      end_month: '',
      end_year: '',
      is_current: false,
      description: '',
    },
  ])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.combo')) {
        setOpenCombo(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    if (!birthDay) return

    const maxDay = getDaysInMonth(birthYear, birthMonth)

    if (Number(birthDay) > maxDay) {
      setBirthDay('')
    }
  }, [birthDay, birthMonth, birthYear])

    const profileQuery = useQuery({
    queryKey: ['applicant-profile', 'create-resume'],
    queryFn: fetchApplicantProfile,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const applicantEducationsQuery = useQuery({
    queryKey: ['applicant-educations', 'create-resume'],
    queryFn: fetchApplicantEducations,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['public-professions', 'create-resume'],
    queryFn: fetchProfessions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const regionsQuery = useQuery({
    queryKey: ['public-regions', 'create-resume'],
    queryFn: () => fetchCatalog<RegionItem>('regions', 100),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const districtsQuery = useQuery({
    queryKey: ['public-districts', 'create-resume'],
    queryFn: () => fetchCatalog<DistrictItem>('districts', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['public-cities', 'create-resume'],
    queryFn: () => fetchCatalog<CityItem>('cities', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['public-skills', 'create-resume'],
    queryFn: () => fetchCatalog<SkillItem>('skills'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const educationInstitutionsQuery = useQuery({
    queryKey: ['public-education-institutions', 'create-resume'],
    queryFn: () => fetchCatalog<EducationInstitutionItem>('educational-institutions'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professions = professionsQuery.data || []
  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []
  const cities = citiesQuery.data || []
  const skills = skillsQuery.data || []
  const educationInstitutions = educationInstitutionsQuery.data || []

  useEffect(() => {
    const profile = profileQuery.data

    if (!profile || profileInitialized) return

    const birth = formatBirthDateParts(profile.birth_date)

    setLastName(profile.last_name || '')
    setFirstName(profile.first_name || '')
    setMiddleName(profile.middle_name || '')
    setPhone(profile.phone || '')
    setBirthDay(birth.day)
    setBirthMonth(birth.month)
    setBirthYear(birth.year)

    const profileCity = profile.city || null

    if (profileCity) {
      const fullCity = cities.find((item) => item.id === profileCity.id) || profileCity
      const fullDistrict = districts.find((item) => item.id === fullCity.district_id)
      const fullRegion = regions.find(
        (item) => item.id === (fullCity.region_id ?? fullDistrict?.region_id),
      )

      setRegionId(fullCity.region_id ?? fullDistrict?.region_id ?? null)
      setRegionName(fullCity.region_name || fullDistrict?.region_name || fullRegion?.name || '')

      setDistrictId(fullCity.district_id ?? null)
      setDistrictName(fullCity.district_name || fullDistrict?.name || '')

      setCityId(fullCity.id)
      setCityName(getCityDisplayName(fullCity))
    } else {
      setRegionId(null)
      setRegionName('')
      setDistrictId(null)
      setDistrictName('')
      setCityId(null)
      setCityName('')
    }

    if (profile.gender === 'м' || profile.gender === 'Мужской') {
      setGender('Мужской')
    } else if (profile.gender === 'ж' || profile.gender === 'Женский') {
      setGender('Женский')
    }

    setProfileInitialized(true)
  }, [profileQuery.data, profileInitialized, cities, districts, regions])

  useEffect(() => {
    const items = applicantEducationsQuery.data

    if (!items || educationInitialized) return

    if (items.length === 0) {
      setEducationInitialized(true)
      return
    }

    setEducations(
      items.map((item) => {
        const institutionId =
          item.institution_id ||
          item.educational_institution_id ||
          item.institution?.id ||
          item.educational_institution?.id ||
          undefined

        const institutionFromCatalog = institutionId
          ? educationInstitutions.find((institution) => institution.id === institutionId)
          : null

        const start = formatMonthYearParts(item.start_date)
        const end = formatMonthYearParts(item.end_date)

        return {
          id: item.id,
          localId: `education-${item.id}-${makeLocalId()}`,
          institution_id: institutionId,
          institution_name:
            item.institution?.name ||
            item.educational_institution?.name ||
            item.institution_name ||
            item.educational_institution_name ||
            institutionFromCatalog?.name ||
            '',
          start_month: start.month,
          start_year: start.year,
          end_month: end.month,
          end_year: end.year,
        }
      }),
    )

    setEducationInitialized(true)
  }, [applicantEducationsQuery.data, educationInitialized, educationInstitutions])

  useEffect(() => {
    if (!cityId || cityName) return

    const selectedCity = cities.find((item) => item.id === cityId)
    if (!selectedCity) return

    const selectedDistrict = districts.find((item) => item.id === selectedCity.district_id)
    const selectedRegion = regions.find(
      (item) => item.id === (selectedCity.region_id ?? selectedDistrict?.region_id),
    )

    setRegionId(selectedCity.region_id ?? selectedDistrict?.region_id ?? null)
    setRegionName(
      selectedCity.region_name || selectedDistrict?.region_name || selectedRegion?.name || '',
    )

    setDistrictId(selectedCity.district_id ?? null)
    setDistrictName(selectedCity.district_name || selectedDistrict?.name || '')

    setCityName(getCityDisplayName(selectedCity))
  }, [cities, districts, regions, cityId, cityName])

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
  })

  const createResumeMutation = useMutation({
    mutationFn: createResume,
  })

  const addEducationMutation = useMutation({
    mutationFn: addEducation,
  })

  const addSkillsBatchMutation = useMutation({
    mutationFn: ({
      resumeId,
      payload,
    }: {
      resumeId: number
      payload: { skills: string[] }
    }) => addSkillsBatch(resumeId, payload),
  })

  const addWorkExperienceMutation = useMutation({
    mutationFn: ({
      resumeId,
      payload,
    }: {
      resumeId: number
      payload: Record<string, unknown>
    }) => addWorkExperience(resumeId, payload),
  })

  const filteredProfessions: ComboOption[] = useMemo(() => {
    const value = professionSearch.trim().toLowerCase()
    const base = value
      ? professions.filter((item) => item.name.toLowerCase().includes(value))
      : professions

    return base.slice(0, 30).map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [professionSearch, professions])

  const regionOptions: ComboOption[] = useMemo(() => {
    return regions.map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [regions])

  const filteredDistricts = useMemo(() => {
    if (!regionId) return districts

    return districts.filter((item) => item.region_id === regionId)
  }, [districts, regionId])

  const districtOptions: ComboOption[] = useMemo(() => {
    return filteredDistricts.map((item) => ({
      value: item.id,
      label: getDistrictDisplayName(item),
    }))
  }, [filteredDistricts])

  const filteredCities = useMemo(() => {
    return cities.filter((item) => {
      const matchesRegion = !regionId || item.region_id === regionId
      const matchesDistrict = !districtId || item.district_id === districtId

      return matchesRegion && matchesDistrict
    })
  }, [cities, regionId, districtId])

  const cityOptions: ComboOption[] = useMemo(() => {
    return filteredCities.map((item) => ({
      value: item.id,
      label: getCityDisplayName(item),
    }))
  }, [filteredCities])

  const filteredSkills: ComboOption[] = useMemo(() => {
    const value = skillSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const base = value
      ? skills.filter((item) => item.name.toLowerCase().includes(value))
      : skills

    return base
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 30)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
  }, [skillSearch, skills, selectedSkills])

  const birthDayOptions = useMemo(() => {
    return makeDayOptions(birthYear, birthMonth)
  }, [birthMonth, birthYear])

  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100)

  const isSaving =
    profileMutation.isPending ||
    createResumeMutation.isPending ||
    addEducationMutation.isPending ||
    addSkillsBatchMutation.isPending ||
    addWorkExperienceMutation.isPending

  const currentStepKey = STEPS[currentStep]

  const selectedBirthMonthLabel =
    monthOptions.find((item) => item.value === birthMonth)?.label || ''

  const validatePhone = () => {
    const normalized = normalizePhone(phone)

    if (!normalized) return 'Укажите номер телефона.'
    if (!phoneRegex.test(normalized)) return 'Введите телефон в формате +375291234567.'

    return ''
  }

  const validateProfessionStep = () => {
    if (!selectedProfessionId || !selectedProfessionName.trim()) {
      return 'Выберите профессию из списка.'
    }

    return ''
  }

  const validateProfileStep = () => {
    if (!lastName.trim()) return 'Укажите фамилию.'
    if (!firstName.trim()) return 'Укажите имя.'
    if (!gender) return 'Укажите пол.'
    if (!cityId) return 'Выберите город проживания из списка.'

    const phoneError = validatePhone()
    if (phoneError) return phoneError

    const birthError = validateBirthDate(birthDay, birthMonth, birthYear)
    if (birthError) return birthError

    return ''
  }

  const validateEducationStep = () => {
    const hasAnyFilled = educations.some(
      (item) =>
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year,
    )

    if (!hasAnyFilled) return ''

    for (const item of educations) {
      const touched =
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year

      if (!touched) continue

      if (!item.institution_id) {
        return 'Выберите учебное заведение из списка.'
      }

      if (!item.start_month || !item.start_year) {
        return 'Укажите дату начала обучения.'
      }

      if (!item.end_month || !item.end_year) {
        return 'Укажите дату окончания обучения.'
      }

      if (isMonthYearInFuture(item.start_month, item.start_year)) {
        return 'Дата начала обучения не может быть в будущем.'
      }

      if (isMonthYearInFuture(item.end_month, item.end_year)) {
        return 'Дата окончания обучения не может быть в будущем.'
      }

      const start = monthYearToNumber(item.start_month, item.start_year)
      const end = monthYearToNumber(item.end_month, item.end_year)

      if (start && end && start > end) {
        return 'Дата окончания обучения не может быть раньше даты начала.'
      }
    }

    return ''
  }

  const validateSkillsStep = () => {
    if (selectedSkills.length === 0) {
      return 'Добавьте хотя бы один навык.'
    }

    return ''
  }

  const validateExperienceStep = () => {
    const hasAnyFilled = experiences.some(
      (item) =>
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim(),
    )

    if (!hasAnyFilled) return ''

    for (const item of experiences) {
      const touched =
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim()

      if (!touched) continue

      if (!item.company_name.trim()) {
        return 'Укажите компанию в опыте работы.'
      }

      if (!item.position.trim()) {
        return 'Укажите должность или профессию в опыте работы.'
      }

      if (!item.start_month || !item.start_year) {
        return 'Укажите дату начала работы.'
      }

      if (isMonthYearInFuture(item.start_month, item.start_year)) {
        return 'Дата начала работы не может быть в будущем.'
      }

      if (!item.is_current && (!item.end_month || !item.end_year)) {
        return 'Укажите дату окончания работы или отметьте “Работаю сейчас”.'
      }

      if (!item.description.trim()) {
        return 'Укажите обязанности и достижения.'
      }

      if (item.description.trim().length < 10) {
        return 'Описание опыта работы слишком короткое.'
      }

      if (!item.is_current) {
        if (isMonthYearInFuture(item.end_month, item.end_year)) {
          return 'Дата окончания работы не может быть в будущем.'
        }

        const start = monthYearToNumber(item.start_month, item.start_year)
        const end = monthYearToNumber(item.end_month, item.end_year)

        if (start && end && start > end) {
          return 'Дата окончания работы не может быть раньше даты начала.'
        }
      }
    }

    return ''
  }

  const validateStep = (step: StepKey) => {
    if (step === 'profession') return validateProfessionStep()
    if (step === 'profile') return validateProfileStep()
    if (step === 'education') return validateEducationStep()
    if (step === 'skills') return validateSkillsStep()
    if (step === 'experience') return validateExperienceStep()

    return ''
  }

  const validateAllSteps = () => {
    for (const step of STEPS) {
      const error = validateStep(step)

      if (error) {
        return error
      }
    }

    return ''
  }

  const getValidEducations = () => {
    return educations.filter(
      (item) =>
        !item.id &&
        item.institution_id &&
        item.start_month &&
        item.start_year &&
        item.end_month &&
        item.end_year,
    )
  }

  const getValidExperiences = () => {
    return experiences.filter(
      (item) =>
        item.company_name.trim() &&
        item.position.trim() &&
        item.start_month &&
        item.start_year &&
        item.description.trim(),
    )
  }

  const finishResumeCreation = async () => {
    const error = validateAllSteps()

    if (error) {
      setSaveError(error)
      return
    }

    setSaveError('')
    setSaveSuccess('')

    try {
      await profileMutation.mutateAsync({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        gender: gender === 'Мужской' ? 'м' : 'ж',
        city_id: cityId,
        phone: normalizePhone(phone),
        birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
      })

      const createdResume = await createResumeMutation.mutateAsync({
        profession_id: selectedProfessionId,
      })

      const validEducations = getValidEducations()

      for (const education of validEducations) {
        await addEducationMutation.mutateAsync({
          institution_id: education.institution_id,
          start_date: buildMonthYearDate(education.start_month, education.start_year),
          end_date: buildMonthYearDate(education.end_month, education.end_year),
        })
      }

      await addSkillsBatchMutation.mutateAsync({
        resumeId: createdResume.id,
        payload: {
          skills: selectedSkills.map((item) => item.name),
        },
      })

      const validExperiences = getValidExperiences()

      for (const experience of validExperiences) {
        await addWorkExperienceMutation.mutateAsync({
          resumeId: createdResume.id,
          payload: {
            company_name: experience.company_name.trim(),
            position: experience.position.trim(),
            start_date: buildMonthYearDate(experience.start_month, experience.start_year),
            end_date: experience.is_current
              ? null
              : buildMonthYearDate(experience.end_month, experience.end_year),
            description: experience.description.trim(),
          },
        })
      }

      setSaveSuccess('Резюме успешно создано.')
      navigate(`/applicant/resume/${createdResume.id}`)
    } catch (requestError) {
      setSaveError(
        getApiErrorMessage(
          requestError,
          'Не удалось сохранить резюме. Проверьте данные и попробуйте снова.',
        ),
      )
    }
  }

  const goBack = () => {
    if (currentStep === 0) {
      navigate('/applicant')
      return
    }

    setSaveError('')
    setSaveSuccess('')
    setCurrentStep((prev) => prev - 1)
  }

  const goNext = async () => {
    setSaveError('')
    setSaveSuccess('')

    const error = validateStep(currentStepKey)

    if (error) {
      setSaveError(error)
      return
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
      return
    }

    await finishResumeCreation()
  }

  const addEducationRow = () => {
    setEducations((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        institution_name: '',
        start_month: '',
        start_year: '',
        end_month: '',
        end_year: '',
      },
    ])
  }

  const removeEducationRow = (localId: string) => {
    setEducations((prev) => prev.filter((item) => item.localId !== localId))
  }

  const updateEducationRow = (localId: string, patch: Partial<EducationDraft>) => {
    setEducations((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const addExperienceRow = () => {
    setExperiences((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        company_name: '',
        position: '',
        start_month: '',
        start_year: '',
        end_month: '',
        end_year: '',
        is_current: false,
        description: '',
      },
    ])
  }

  const removeExperienceRow = (localId: string) => {
    setExperiences((prev) => prev.filter((item) => item.localId !== localId))
  }

  const updateExperienceRow = (localId: string, patch: Partial<WorkExperienceDraft>) => {
    setExperiences((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const addSkill = (skillId: number) => {
    const skill = skills.find((item) => item.id === skillId)

    if (!skill) return

    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev
      return [...prev, skill]
    })

    setSkillSearch('')
    setOpenCombo(null)
  }

  const removeSkill = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId))
  }

  return (
    <div className="create-resume-page">
      <Header />

      <main className="create-resume-page__main">
        <div className="container create-resume-page__container">
          <section className="create-resume-card">
            <div className="create-resume-card__top">
              <div>
                <div className="create-resume-card__progress-label">
                  Шаг {currentStep + 1} из {STEPS.length} · {progressPercent}%
                </div>

                <div className="create-resume-card__step-name">
                  {STEP_TITLES[currentStepKey]}
                </div>
              </div>

              <button
                type="button"
                className="create-resume-card__cancel"
                onClick={() => navigate('/applicant')}
              >
                Выйти
              </button>
            </div>

            {profileQuery.isError ||
            applicantEducationsQuery.isError ||
            professionsQuery.isError ||
            regionsQuery.isError ||
            districtsQuery.isError ||
            citiesQuery.isError ||
            skillsQuery.isError ||
            educationInstitutionsQuery.isError ? (
              <div className="form-error">
                Не удалось загрузить часть справочников. Обновите страницу.
              </div>
            ) : null}

            {currentStepKey === 'profession' && (
              <>
                <h1 className="create-resume-card__title">Выберите профессию</h1>

                <p className="create-resume-card__subtitle">
                  Начните вводить название и выберите вариант из списка.
                </p>

                <SearchCombo
                  value={professionSearch}
                  placeholder="Например: Frontend-разработчик"
                  isOpen={openCombo === 'profession'}
                  options={filteredProfessions}
                  activeValue={selectedProfessionId}
                  emptyText={
                    professionsQuery.isLoading ? 'Загружаем профессии...' : 'Профессия не найдена'
                  }
                  onFocus={() => setOpenCombo('profession')}
                  onChange={(value) => {
                    setProfessionSearch(value)
                    setSelectedProfessionId(null)
                    setSelectedProfessionName('')
                    setOpenCombo('profession')
                  }}
                  onSelect={(option) => {
                    setSelectedProfessionId(Number(option.value))
                    setSelectedProfessionName(option.label)
                    setProfessionSearch(option.label)
                    setOpenCombo(null)
                    setSaveError('')
                  }}
                />

                {selectedProfessionName ? (
                  <div className="picked-value">Выбрано: {selectedProfessionName}</div>
                ) : null}
              </>
            )}

            {currentStepKey === 'profile' && (
              <>
                <h1 className="create-resume-card__title">Основная информация</h1>

                <p className="create-resume-card__subtitle">
                  Эти данные попадут в профиль и будут использоваться в резюме.
                </p>

                <div className="form-grid form-grid--two">
                  <label className="field">
                    <span>Фамилия</span>

                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Например: Иванов"
                    />
                  </label>

                  <label className="field">
                    <span>Имя</span>

                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Например: Иван"
                    />
                  </label>

                  <label className="field field--full">
                    <span>Отчество</span>

                    <input
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      placeholder="Например: Иванович"
                    />
                  </label>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Пол</span>

                  <div className="segmented">
                    <button
                      type="button"
                      className={gender === 'Мужской' ? 'is-active' : ''}
                      onClick={() => setGender('Мужской')}
                    >
                      Мужской
                    </button>

                    <button
                      type="button"
                      className={gender === 'Женский' ? 'is-active' : ''}
                      onClick={() => setGender('Женский')}
                    >
                      Женский
                    </button>
                  </div>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Контакты</span>

                  <div className="form-grid form-grid--two">
                    <label className="field">
                      <span>Область</span>

                      <SelectCombo
                        value={regionName}
                        placeholder="Выберите область"
                        isOpen={openCombo === 'region'}
                        options={regionOptions}
                        activeValue={regionId}
                        emptyText={
                          regionsQuery.isLoading ? 'Загружаем области...' : 'Области не найдены'
                        }
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'region' ? null : 'region'))
                        }
                        onSelect={(option) => {
                          setRegionId(Number(option.value))
                          setRegionName(option.label)
                          setDistrictId(null)
                          setDistrictName('')
                          setCityId(null)
                          setCityName('')
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Район</span>

                      <SelectCombo
                        value={districtName}
                        placeholder="Выберите район"
                        isOpen={openCombo === 'district'}
                        options={districtOptions}
                        activeValue={districtId}
                        disabled={!regionId}
                        emptyText={
                          !regionId
                            ? 'Сначала выберите область'
                            : districtsQuery.isLoading
                              ? 'Загружаем районы...'
                              : 'Районы не найдены'
                        }
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'district' ? null : 'district'))
                        }
                        onSelect={(option) => {
                          const district = districts.find((item) => item.id === Number(option.value))

                          setDistrictId(Number(option.value))
                          setDistrictName(district?.name || option.label)
                          setCityId(null)
                          setCityName('')
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Город / населённый пункт</span>

                      <SelectCombo
                        value={cityName}
                        placeholder="Выберите город"
                        isOpen={openCombo === 'city'}
                        options={cityOptions}
                        activeValue={cityId}
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
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'city' ? null : 'city'))
                        }
                        onSelect={(option) => {
                          const city = cities.find((item) => item.id === Number(option.value))

                          setCityId(Number(option.value))
                          setCityName(option.label)
                          setRegionId(city?.region_id ?? regionId)
                          setRegionName(city?.region_name || regionName)
                          setDistrictId(city?.district_id ?? districtId)
                          setDistrictName(city?.district_name || districtName)
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Номер телефона</span>

                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        onBlur={() => setPhone(normalizePhone(phone))}
                        placeholder="+375 (29) 123-45-67"
                      />
                    </label>
                  </div>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Дата рождения</span>

                  <div className="date-grid date-grid--three">
                    <label className="field">
                      <span>День</span>

                      <SelectCombo
                        value={birthDay}
                        placeholder="День"
                        isOpen={openCombo === 'birthDay'}
                        options={birthDayOptions}
                        activeValue={birthDay}
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'birthDay' ? null : 'birthDay'))
                        }
                        onSelect={(option) => {
                          setBirthDay(String(option.value))
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Месяц</span>

                      <SelectCombo
                        value={selectedBirthMonthLabel}
                        placeholder="Месяц"
                        isOpen={openCombo === 'birthMonth'}
                        options={monthOptions}
                        activeValue={birthMonth}
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'birthMonth' ? null : 'birthMonth'))
                        }
                        onSelect={(option) => {
                          setBirthMonth(String(option.value))
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>

                    <label className="field">
                      <span>Год</span>

                      <SelectCombo
                        value={birthYear}
                        placeholder="Год"
                        isOpen={openCombo === 'birthYear'}
                        options={birthYearOptions}
                        activeValue={birthYear}
                        onToggle={() =>
                          setOpenCombo((prev) => (prev === 'birthYear' ? null : 'birthYear'))
                        }
                        onSelect={(option) => {
                          setBirthYear(String(option.value))
                          setOpenCombo(null)
                          setSaveError('')
                        }}
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {currentStepKey === 'education' && (
              <>
                <h1 className="create-resume-card__title">Образование</h1>

                <p className="create-resume-card__subtitle">
                  Этот шаг можно оставить пустым, если образование не нужно указывать.
                </p>

                {educations.map((education) => {
                  const educationSearch = education.institution_name.trim().toLowerCase()

                  const educationOptions: ComboOption[] = (
                    educationSearch
                      ? educationInstitutions.filter((item) =>
                          item.name.toLowerCase().includes(educationSearch),
                        )
                      : educationInstitutions
                  )
                    .slice(0, 30)
                    .map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))

                  const startMonthLabel =
                    monthOptions.find((item) => item.value === education.start_month)?.label || ''

                  const endMonthLabel =
                    monthOptions.find((item) => item.value === education.end_month)?.label || ''

                  return (
                    <div key={education.localId} className="education-card">
                      <div className="education-card__head">

                        {educations.length > 1 ? (
                          <button
                            type="button"
                            className="link-danger"
                            onClick={() => removeEducationRow(education.localId)}
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>

                      <label className="field">
                        <span>Учебное заведение</span>

                        <SearchCombo
                          value={education.institution_name}
                          placeholder="Начните вводить название"
                          isOpen={openCombo === `education-${education.localId}`}
                          options={educationOptions}
                          activeValue={education.institution_id}
                          emptyText={
                            educationInstitutionsQuery.isLoading
                              ? 'Загружаем учебные заведения...'
                              : 'Учебное заведение не найдено'
                          }
                          onFocus={() => setOpenCombo(`education-${education.localId}`)}
                          onChange={(value) => {
                            updateEducationRow(education.localId, {
                              institution_name: value,
                              institution_id: undefined,
                            })
                            setOpenCombo(`education-${education.localId}`)
                          }}
                          onSelect={(option) => {
                            updateEducationRow(education.localId, {
                              institution_id: Number(option.value),
                              institution_name: option.label,
                            })
                            setOpenCombo(null)
                            setSaveError('')
                          }}
                        />
                      </label>

                      <div className="education-card__dates">
                        <div className="education-card__date-group">
                          <span className="section-block__label">Дата начала</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>

                              <SelectCombo
                                value={startMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `education-start-month-${education.localId}`}
                                options={monthOptions}
                                activeValue={education.start_month}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-start-month-${education.localId}`
                                      ? null
                                      : `education-start-month-${education.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    start_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>

                              <SelectCombo
                                value={education.start_year}
                                placeholder="Год"
                                isOpen={openCombo === `education-start-year-${education.localId}`}
                                options={resumeYearOptions}
                                activeValue={education.start_year}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-start-year-${education.localId}`
                                      ? null
                                      : `education-start-year-${education.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    start_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="education-card__date-group">
                          <span className="section-block__label">Дата окончания</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>

                              <SelectCombo
                                value={endMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `education-end-month-${education.localId}`}
                                options={monthOptions}
                                activeValue={education.end_month}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-end-month-${education.localId}`
                                      ? null
                                      : `education-end-month-${education.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    end_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>

                              <SelectCombo
                                value={education.end_year}
                                placeholder="Год"
                                isOpen={openCombo === `education-end-year-${education.localId}`}
                                options={resumeYearOptions}
                                activeValue={education.end_year}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-end-year-${education.localId}`
                                      ? null
                                      : `education-end-year-${education.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    end_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <button type="button" className="ghost-add-btn" onClick={addEducationRow}>
                  Добавить ещё образование
                </button>
              </>
            )}

            {currentStepKey === 'skills' && (
              <>
                <h1 className="create-resume-card__title">Навыки</h1>

                <p className="create-resume-card__subtitle">
                  Выберите навыки из списка. Минимум один навык обязателен.
                </p>

                <label className="field">
                  <span>Навыки</span>

                  <SearchCombo
                    value={skillSearch}
                    placeholder="Например: React"
                    isOpen={openCombo === 'skills'}
                    options={filteredSkills}
                    emptyText={skillsQuery.isLoading ? 'Загружаем навыки...' : 'Навыки не найдены'}
                    onFocus={() => setOpenCombo('skills')}
                    onChange={(value) => {
                      setSkillSearch(value)
                      setOpenCombo('skills')
                    }}
                    onSelect={(option) => addSkill(Number(option.value))}
                  />
                </label>

                {selectedSkills.length > 0 ? (
                  <div className="chip-list chip-list--selected">
                    {selectedSkills.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="chip chip--selected"
                        onClick={() => removeSkill(item.id)}
                      >
                        {item.name} ×
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="section-block">
                  <span className="section-block__label">Рекомендованные навыки</span>

                  <div className="chip-list">
                    {filteredSkills.slice(0, 18).map((item) => (
                      <button
                        key={String(item.value)}
                        type="button"
                        className="chip"
                        onClick={() => addSkill(Number(item.value))}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {currentStepKey === 'experience' && (
              <>
                <h1 className="create-resume-card__title">Опыт работы</h1>

                <p className="create-resume-card__subtitle">
                  Можно пропустить, если опыта пока нет. Если начали заполнять блок, заполните его
                  полностью.
                </p>

                {experiences.map((experience, index) => {
                  const startMonthLabel =
                    monthOptions.find((item) => item.value === experience.start_month)?.label || ''

                  const endMonthLabel =
                    monthOptions.find((item) => item.value === experience.end_month)?.label || ''

                  return (
                    <div key={experience.localId} className="experience-card">
                      <div className="experience-card__head">
                        <h3>Опыт работы {index + 1}</h3>

                        {experiences.length > 1 ? (
                          <button
                            type="button"
                            className="link-danger"
                            onClick={() => removeExperienceRow(experience.localId)}
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>

                      <div className="form-grid form-grid--two">
                        <label className="field">
                          <span>Компания</span>

                          <input
                            placeholder="Например: БелСофт"
                            value={experience.company_name}
                            onChange={(event) =>
                              updateExperienceRow(experience.localId, {
                                company_name: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label className="field">
                          <span>Должность</span>

                          <input
                            placeholder="Например: Frontend-разработчик"
                            value={experience.position}
                            onChange={(event) =>
                              updateExperienceRow(experience.localId, {
                                position: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="experience-card__dates">
                        <div className="experience-card__date-group">
                          <span className="section-block__label">Начало работы</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>

                              <SelectCombo
                                value={startMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `exp-start-month-${experience.localId}`}
                                options={monthOptions}
                                activeValue={experience.start_month}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `exp-start-month-${experience.localId}`
                                      ? null
                                      : `exp-start-month-${experience.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    start_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>

                              <SelectCombo
                                value={experience.start_year}
                                placeholder="Год"
                                isOpen={openCombo === `exp-start-year-${experience.localId}`}
                                options={resumeYearOptions}
                                activeValue={experience.start_year}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `exp-start-year-${experience.localId}`
                                      ? null
                                      : `exp-start-year-${experience.localId}`,
                                  )
                                }
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    start_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="experience-card__date-group">
                          <div className="experience-card__end-head">
                            <span className="section-block__label">Окончание</span>

                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={experience.is_current}
                                onChange={(event) =>
                                  updateExperienceRow(experience.localId, {
                                    is_current: event.target.checked,
                                    end_month: event.target.checked ? '' : experience.end_month,
                                    end_year: event.target.checked ? '' : experience.end_year,
                                  })
                                }
                              />

                              <span>Работаю сейчас</span>
                            </label>
                          </div>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>

                              <SelectCombo
                                value={endMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `exp-end-month-${experience.localId}`}
                                options={monthOptions}
                                activeValue={experience.end_month}
                                disabled={experience.is_current}
                                onToggle={() => {
                                  if (experience.is_current) return

                                  setOpenCombo((prev) =>
                                    prev === `exp-end-month-${experience.localId}`
                                      ? null
                                      : `exp-end-month-${experience.localId}`,
                                  )
                                }}
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    end_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>

                              <SelectCombo
                                value={experience.end_year}
                                placeholder="Год"
                                isOpen={openCombo === `exp-end-year-${experience.localId}`}
                                options={resumeYearOptions}
                                activeValue={experience.end_year}
                                disabled={experience.is_current}
                                onToggle={() => {
                                  if (experience.is_current) return

                                  setOpenCombo((prev) =>
                                    prev === `exp-end-year-${experience.localId}`
                                      ? null
                                      : `exp-end-year-${experience.localId}`,
                                  )
                                }}
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    end_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                  setSaveError('')
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <label className="field">
                        <span>Обязанности и достижения</span>

                        <textarea
                          placeholder="Опишите, чем занимались, какие задачи решали и каких результатов достигли."
                          value={experience.description}
                          onChange={(event) =>
                            updateExperienceRow(experience.localId, {
                              description: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  )
                })}

                <button type="button" className="ghost-add-btn" onClick={addExperienceRow}>
                  Добавить опыт работы
                </button>
              </>
            )}

            {saveError ? <div className="form-error">{saveError}</div> : null}
            {saveSuccess ? <div className="form-success">{saveSuccess}</div> : null}
          </section>
        </div>
      </main>

      <div className="resume-stepper-footer">
        <div className="resume-stepper-footer__inner">
          <div className="resume-stepper-footer__progress">
            {STEPS.map((step, index) => (
              <span
                key={step}
                className={index <= currentStep ? 'is-active' : ''}
                title={STEP_TITLES[step]}
              />
            ))}
          </div>

          <div className="resume-stepper-footer__actions">
            <button type="button" className="btn btn--outline" onClick={goBack} disabled={isSaving}>
              Назад
            </button>

            <button type="button" className="btn btn--primary" onClick={goNext} disabled={isSaving}>
              {isSaving
                ? 'Сохраняем...'
                : currentStep === STEPS.length - 1
                  ? 'Сохранить и завершить'
                  : 'Продолжить'}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}