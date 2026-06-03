import type { AxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './resume-details.css'

type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  gender?: string | null
  phone?: string | null
  birth_date?: string | null
  city?: CityItem | null
  educations?: EducationItem[]
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

type ResumeSkill = {
  id: number
  name: string
}

type WorkExperienceItem = {
  id: number
  resume_id: number
  company_name: string
  position: string
  start_date: string
  end_date?: string | null
  description?: string | null
}

type EducationItem = {
  id: number
  institution_id: number
  institution_name?: string | null
  institution?: {
    id: number
    name: string
  } | null
  start_date: string
  end_date?: string | null
}

type ResumeResponse = {
  id: number
  applicant_id: number
  profession_id: number
  profession?: {
    id: number
    name: string
  } | null
  skills?: ResumeSkill[]
  work_experiences?: WorkExperienceItem[]
  created_at?: string | null
  updated_at?: string | null
}

type ComboOption = {
  value: string | number
  label: string
}

type NoticeState = {
  type: 'success' | 'error'
  text: string
} | null

type NoticeSection = 'hero' | 'resume' | 'profile' | 'skills' | 'experience' | 'education'

type SectionNotices = Partial<Record<NoticeSection, NoticeState>>

type GenderValue = 'м' | 'ж' | ''

type EducationDraft = {
  localId: string
  id?: number
  institution_id?: number
  institution_name: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
}

type WorkExperienceDraft = {
  localId: string
  id?: number
  company_name: string
  position: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
  is_current: boolean
  description: string
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

const genderOptions: ComboOption[] = [
  { value: 'м', label: 'Мужской' },
  { value: 'ж', label: 'Женский' },
]

const phoneRegex = /^\+?[1-9]\d{8,14}$/

const makeLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

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
    lower.includes('профессия')
  ) {
    return 'Выберите профессию из списка.'
  }

  if (lower.includes('institution') || lower.includes('учебное заведение')) {
    return 'Выберите учебное заведение из списка.'
  }

  if (lower.includes('city') || lower.includes('город')) {
    return 'Выберите город из списка.'
  }

  if (lower.includes('phone') && (lower.includes('invalid') || lower.includes('некоррект'))) {
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
    return 'Не удалось выполнить действие. Проверьте данные и попробуйте снова.'
  }

  return message || 'Не удалось выполнить действие.'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError.response?.status
  const data = axiosError.response?.data

  if (axiosError.response) {
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

  if (axiosError.request) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (error instanceof Error && error.message) {
    return translateApiErrorMessage(error.message)
  }

  return fallback
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ru-RU')
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

const parseBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) return { day: '', month: '', year: '' }

  const match = String(birthDate).match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (!match) return { day: '', month: '', year: '' }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  }
}

const buildBirthDate = (day: string, month: string, year: string) => {
  if (!day || !month || !year) return null
  return `${year}-${month}-${day}`
}

const parseMonthYear = (value?: string | null) => {
  if (!value) return { month: '', year: '' }

  const raw = String(value).slice(0, 10)
  const [year, month] = raw.split('-')

  return {
    year: year || '',
    month: month || '',
  }
}

const buildMonthYearDate = (month: string, year: string) => {
  if (!month || !year) return null
  return `${year}-${month}-01`
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

const monthYearToNumber = (month: string, year: string) => {
  if (!month || !year) return null

  const parsed = Number(`${year}${month}`)
  return Number.isFinite(parsed) ? parsed : null
}

const isMonthYearInFuture = (month: string, year: string) => {
  const value = monthYearToNumber(month, year)
  if (!value) return false

  const now = new Date()
  const currentValue = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`)

  return value > currentValue
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile> => {
  const { data } = await http.get('/applicants/me')
  return data
}

const fetchResume = async (resumeId: number): Promise<ResumeResponse> => {
  const { data } = await http.get(`/applicants/me/resumes/${resumeId}`)
  return data
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

const fetchEducationInstitutions = async (): Promise<EducationInstitutionItem[]> => {
  try {
    return await fetchCatalog<EducationInstitutionItem>('educational-institutions')
  } catch {
    return fetchCatalog<EducationInstitutionItem>('education_institutions')
  }
}

const updateApplicantProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/applicants/me', payload)
  return data
}

const updateResume = async (resumeId: number, payload: { profession_id: number }) => {
  const { data } = await http.put(`/applicants/me/resumes/${resumeId}`, payload)
  return data
}

const deleteResume = async (resumeId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}`)
}

const addSkillsBatch = async (resumeId: number, payload: { skills: string[] }) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/skills/batch`, payload)
  return data
}

const removeSkill = async (resumeId: number, skillId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}/skills/${skillId}`)
}

const addEducation = async (payload: {
  institution_id: number
  start_date: string
  end_date: string | null
}) => {
  const { data } = await http.post('/applicants/me/education', payload)
  return data
}

const updateEducation = async (
  educationId: number,
  payload: {
    institution_id: number
    start_date: string
    end_date: string | null
  },
) => {
  const { data } = await http.put(`/applicants/me/education/${educationId}`, payload)
  return data
}

const deleteEducation = async (educationId: number) => {
  await http.delete(`/applicants/me/education/${educationId}`)
}

const addWorkExperience = async (
  resumeId: number,
  payload: {
    company_name: string
    position: string
    start_date: string
    end_date: string | null
    description: string | null
  },
) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/work-experiences`, payload)
  return data
}

const updateWorkExperience = async (
  resumeId: number,
  experienceId: number,
  payload: {
    company_name: string
    position: string
    start_date: string
    end_date: string | null
    description: string | null
  },
) => {
  const { data } = await http.put(
    `/applicants/me/resumes/${resumeId}/work-experiences/${experienceId}`,
    payload,
  )

  return data
}

const deleteWorkExperience = async (resumeId: number, experienceId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}/work-experiences/${experienceId}`)
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

const SectionNotice = ({ notice }: { notice: NoticeState }) => {
  if (!notice) return null

  return (
    <div
      className={`resume-editor-notice ${
        notice.type === 'success'
          ? 'resume-editor-notice--success'
          : 'resume-editor-notice--error'
      }`}
    >
      {notice.text}
    </div>
  )
}

const createEducationDraft = (item?: EducationItem): EducationDraft => {
  const start = parseMonthYear(item?.start_date)
  const end = parseMonthYear(item?.end_date)

  return {
    localId: makeLocalId(),
    id: item?.id,
    institution_id: item?.institution_id ?? item?.institution?.id,
    institution_name: item?.institution_name || item?.institution?.name || '',
    start_month: start.month,
    start_year: start.year,
    end_month: end.month,
    end_year: end.year,
  }
}

const createExperienceDraft = (item?: WorkExperienceItem): WorkExperienceDraft => {
  const start = parseMonthYear(item?.start_date)
  const end = parseMonthYear(item?.end_date)

  return {
    localId: makeLocalId(),
    id: item?.id,
    company_name: item?.company_name ?? '',
    position: item?.position ?? '',
    start_month: start.month,
    start_year: start.year,
    end_month: end.month,
    end_year: end.year,
    is_current: !item?.end_date,
    description: item?.description ?? '',
  }
}

export const ResumeDetailsPage = () => {
  const { resumeId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const numericResumeId = Number(resumeId)

  const [notices, setNotices] = useState<SectionNotices>({})
  const [openCombo, setOpenCombo] = useState<string | null>(null)

  const [professionSearch, setProfessionSearch] = useState('')
  const [selectedProfessionId, setSelectedProfessionId] = useState<number | null>(null)
  const [selectedProfessionName, setSelectedProfessionName] = useState('')

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<GenderValue>('')

  const [regionId, setRegionId] = useState<number | null>(null)
  const [regionName, setRegionName] = useState('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [districtName, setDistrictName] = useState('')
  const [cityId, setCityId] = useState<number | null>(null)
  const [cityName, setCityName] = useState('')

  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [educations, setEducations] = useState<EducationDraft[]>([])
  const [selectedSkills, setSelectedSkills] = useState<SkillItem[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [experiences, setExperiences] = useState<WorkExperienceDraft[]>([])

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

  const applicantQuery = useQuery({
    queryKey: ['applicant-profile', numericResumeId],
    queryFn: fetchApplicantProfile,
    enabled: Number.isFinite(numericResumeId) && numericResumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resumeQuery = useQuery({
    queryKey: ['applicant-resume', numericResumeId],
    queryFn: () => fetchResume(numericResumeId),
    enabled: Number.isFinite(numericResumeId) && numericResumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['public-professions', 'resume-details'],
    queryFn: fetchProfessions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const regionsQuery = useQuery({
    queryKey: ['public-regions', 'resume-details'],
    queryFn: () => fetchCatalog<RegionItem>('regions', 100),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const districtsQuery = useQuery({
    queryKey: ['public-districts', 'resume-details'],
    queryFn: () => fetchCatalog<DistrictItem>('districts', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['public-cities', 'resume-details'],
    queryFn: () => fetchCatalog<CityItem>('cities', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['public-skills', 'resume-details'],
    queryFn: () => fetchCatalog<SkillItem>('skills'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const educationInstitutionsQuery = useQuery({
    queryKey: ['public-education-institutions', 'resume-details'],
    queryFn: fetchEducationInstitutions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professions = professionsQuery.data || []
  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []
  const cities = citiesQuery.data || []
  const skills = skillsQuery.data || []
  const educationInstitutions = educationInstitutionsQuery.data || []
  const currentResume = resumeQuery.data

  useEffect(() => {
    const profile = applicantQuery.data
    if (!profile) return

    const birth = parseBirthDateParts(profile.birth_date)

    setLastName(profile.last_name || '')
    setFirstName(profile.first_name || '')
    setMiddleName(profile.middle_name || '')
    setPhone(profile.phone || '')
    setBirthDay(birth.day)
    setBirthMonth(birth.month)
    setBirthYear(birth.year)

    if (profile.gender === 'ж' || profile.gender === 'Женский') {
      setGender('ж')
    } else if (profile.gender === 'м' || profile.gender === 'Мужской') {
      setGender('м')
    } else {
      setGender('')
    }

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

    setEducations(toArray<EducationItem>(profile.educations).map(createEducationDraft))
  }, [applicantQuery.data, cities, districts, regions])

  useEffect(() => {
    const resume = resumeQuery.data
    if (!resume) return

    setSelectedProfessionId(resume.profession_id ?? null)
    setSelectedProfessionName(resume.profession?.name || '')
    setProfessionSearch(resume.profession?.name || '')
    setSelectedSkills(toArray<ResumeSkill>(resume.skills))
    setExperiences(toArray<WorkExperienceItem>(resume.work_experiences).map(createExperienceDraft))
  }, [resumeQuery.data])

  const birthDayOptions = useMemo(() => {
    return makeDayOptions(birthYear, birthMonth)
  }, [birthMonth, birthYear])

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

  const filteredSkills: ComboOption[] = useMemo(() => {
    const value = skillSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const base = value ? skills.filter((item) => item.name.toLowerCase().includes(value)) : skills

    return base
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 30)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
  }, [skillSearch, skills, selectedSkills])

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
  })

  const resumeMutation = useMutation({
    mutationFn: (payload: { profession_id: number }) => updateResume(numericResumeId, payload),
  })

  const addSkillsBatchMutation = useMutation({
    mutationFn: (payload: { skills: string[] }) => addSkillsBatch(numericResumeId, payload),
  })

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: number) => removeSkill(numericResumeId, skillId),
  })

  const addEducationMutation = useMutation({
    mutationFn: addEducation,
  })

  const updateEducationMutation = useMutation({
    mutationFn: ({
      educationId,
      payload,
    }: {
      educationId: number
      payload: {
        institution_id: number
        start_date: string
        end_date: string | null
      }
    }) => updateEducation(educationId, payload),
  })

  const deleteEducationMutation = useMutation({
    mutationFn: (educationId: number) => deleteEducation(educationId),
  })

  const addWorkExperienceMutation = useMutation({
    mutationFn: (payload: {
      company_name: string
      position: string
      start_date: string
      end_date: string | null
      description: string | null
    }) => addWorkExperience(numericResumeId, payload),
  })

  const updateWorkExperienceMutation = useMutation({
    mutationFn: ({
      experienceId,
      payload,
    }: {
      experienceId: number
      payload: {
        company_name: string
        position: string
        start_date: string
        end_date: string | null
        description: string | null
      }
    }) => updateWorkExperience(numericResumeId, experienceId, payload),
  })

  const deleteWorkExperienceMutation = useMutation({
    mutationFn: (experienceId: number) => deleteWorkExperience(numericResumeId, experienceId),
  })

  const deleteResumeMutation = useMutation({
    mutationFn: () => deleteResume(numericResumeId),
  })

  const clearNotice = (section: NoticeSection) => {
    setNotices((prev) => ({
      ...prev,
      [section]: null,
    }))
  }

  const setSuccess = (section: NoticeSection, text: string) => {
    setNotices((prev) => ({
      ...prev,
      [section]: { type: 'success', text },
    }))
  }

  const setError = (section: NoticeSection, text: string) => {
    setNotices((prev) => ({
      ...prev,
      [section]: { type: 'error', text },
    }))
  }

  const addEducationRow = () => {
    setEducations((prev) => [...prev, createEducationDraft()])
  }

  const updateEducationRow = (localId: string, patch: Partial<EducationDraft>) => {
    setEducations((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const removeEducationRowLocal = (localId: string) => {
    setEducations((prev) => prev.filter((item) => item.localId !== localId))
  }

  const addExperienceRow = () => {
    setExperiences((prev) => [...prev, createExperienceDraft()])
  }

  const updateExperienceRow = (localId: string, patch: Partial<WorkExperienceDraft>) => {
    setExperiences((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const removeExperienceRowLocal = (localId: string) => {
    setExperiences((prev) => prev.filter((item) => item.localId !== localId))
  }

  const addSkillToSelection = (skillId: number) => {
    const skill = skills.find((item) => item.id === skillId)
    if (!skill) return

    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev
      return [...prev, skill]
    })

    setSkillSearch('')
    setOpenCombo(null)
  }

  const removeSkillFromSelection = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId))
  }

  const validateResume = () => {
    if (!selectedProfessionId) return 'Выберите профессию из списка.'
    return ''
  }

  const validateProfile = () => {
    if (!lastName.trim()) return 'Укажите фамилию.'
    if (!firstName.trim()) return 'Укажите имя.'
    if (!gender) return 'Выберите пол.'
    if (!cityId) return 'Выберите город проживания из списка.'

    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) return 'Укажите номер телефона.'
    if (!phoneRegex.test(normalizedPhone)) return 'Введите телефон в формате +375291234567.'

    const birthError = validateBirthDate(birthDay, birthMonth, birthYear)
    if (birthError) return birthError

    return ''
  }

  const validateSkills = () => {
    if (selectedSkills.length === 0) return 'Добавьте хотя бы один навык.'
    return ''
  }

  const validateEducationSection = () => {
    const touchedRows = educations.filter(
      (item) =>
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year,
    )

    for (const item of touchedRows) {
      if (!item.institution_id) return 'Выберите учебное заведение из списка.'
      if (!item.start_month || !item.start_year) return 'Укажите дату начала обучения.'
      if (!item.end_month || !item.end_year) return 'Укажите дату окончания обучения.'

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

  const validateExperienceSection = () => {
    const touchedRows = experiences.filter(
      (item) =>
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim(),
    )

    for (const item of touchedRows) {
      if (!item.company_name.trim()) return 'Укажите компанию.'
      if (!item.position.trim()) return 'Укажите должность.'
      if (!item.start_month || !item.start_year) return 'Укажите дату начала работы.'

      if (isMonthYearInFuture(item.start_month, item.start_year)) {
        return 'Дата начала работы не может быть в будущем.'
      }

      if (!item.is_current && (!item.end_month || !item.end_year)) {
        return 'Укажите дату окончания работы или отметьте «Работаю сейчас».'
      }

      if (!item.description.trim()) return 'Добавьте описание опыта работы.'

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

  const handleSaveResume = async () => {
    clearNotice('resume')

    const error = validateResume()
    if (error) {
      setError('resume', error)
      return
    }

    try {
      await resumeMutation.mutateAsync({
        profession_id: Number(selectedProfessionId),
      })

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })
      await queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] })

      setSuccess('resume', 'Резюме сохранено.')
    } catch (err) {
      setError('resume', getErrorMessage(err, 'Не удалось сохранить резюме.'))
    }
  }

  const handleSaveProfile = async () => {
    clearNotice('profile')

    const error = validateProfile()
    if (error) {
      setError('profile', error)
      return
    }

    try {
      await profileMutation.mutateAsync({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        phone: normalizePhone(phone),
        gender,
        city_id: cityId,
        birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
      })

      setPhone(normalizePhone(phone))

      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })

      setSuccess('profile', 'Профиль соискателя сохранён.')
    } catch (err) {
      setError('profile', getErrorMessage(err, 'Не удалось сохранить профиль.'))
    }
  }

  const handleSaveSkills = async () => {
    clearNotice('skills')

    const error = validateSkills()
    if (error) {
      setError('skills', error)
      return
    }

    try {
      const currentSkills = toArray<ResumeSkill>(currentResume?.skills)
      const currentIds = new Set(currentSkills.map((item) => item.id))
      const selectedIds = new Set(selectedSkills.map((item) => item.id))

      const toRemove = currentSkills.filter((item) => !selectedIds.has(item.id))
      const toAdd = selectedSkills
        .filter((item) => !currentIds.has(item.id))
        .map((item) => item.name)

      for (const skill of toRemove) {
        await removeSkillMutation.mutateAsync(skill.id)
      }

      if (toAdd.length > 0) {
        await addSkillsBatchMutation.mutateAsync({ skills: toAdd })
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })

      setSuccess('skills', 'Навыки сохранены.')
    } catch (err) {
      setError('skills', getErrorMessage(err, 'Не удалось сохранить навыки.'))
    }
  }

  const handleSaveEducations = async () => {
    clearNotice('education')

    const error = validateEducationSection()
    if (error) {
      setError('education', error)
      return
    }

    try {
      const touchedRows = educations.filter(
        (item) =>
          item.institution_name.trim() ||
          item.start_month ||
          item.start_year ||
          item.end_month ||
          item.end_year,
      )

      for (const item of touchedRows) {
        if (!item.institution_id) continue

        const payload = {
          institution_id: item.institution_id,
          start_date: buildMonthYearDate(item.start_month, item.start_year) as string,
          end_date: buildMonthYearDate(item.end_month, item.end_year),
        }

        if (item.id) {
          await updateEducationMutation.mutateAsync({
            educationId: item.id,
            payload,
          })
        } else {
          await addEducationMutation.mutateAsync(payload)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })

      setSuccess('education', 'Образование сохранено.')
    } catch (err) {
      setError('education', getErrorMessage(err, 'Не удалось сохранить образование.'))
    }
  }

  const handleDeleteEducation = async (item: EducationDraft) => {
    clearNotice('education')

    if (!item.id) {
      removeEducationRowLocal(item.localId)
      return
    }

    try {
      await deleteEducationMutation.mutateAsync(item.id)
      removeEducationRowLocal(item.localId)

      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })

      setSuccess('education', 'Образование удалено.')
    } catch (err) {
      setError('education', getErrorMessage(err, 'Не удалось удалить образование.'))
    }
  }

  const handleSaveExperiences = async () => {
    clearNotice('experience')

    const error = validateExperienceSection()
    if (error) {
      setError('experience', error)
      return
    }

    try {
      const touchedRows = experiences.filter(
        (item) =>
          item.company_name.trim() ||
          item.position.trim() ||
          item.start_month ||
          item.start_year ||
          item.end_month ||
          item.end_year ||
          item.description.trim(),
      )

      for (const item of touchedRows) {
        const payload = {
          company_name: item.company_name.trim(),
          position: item.position.trim(),
          start_date: buildMonthYearDate(item.start_month, item.start_year) as string,
          end_date: item.is_current ? null : buildMonthYearDate(item.end_month, item.end_year),
          description: item.description.trim() || null,
        }

        if (item.id) {
          await updateWorkExperienceMutation.mutateAsync({
            experienceId: item.id,
            payload,
          })
        } else {
          await addWorkExperienceMutation.mutateAsync(payload)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })

      setSuccess('experience', 'Опыт работы сохранён.')
    } catch (err) {
      setError('experience', getErrorMessage(err, 'Не удалось сохранить опыт работы.'))
    }
  }

  const handleDeleteExperience = async (item: WorkExperienceDraft) => {
    clearNotice('experience')

    if (!item.id) {
      removeExperienceRowLocal(item.localId)
      return
    }

    try {
      await deleteWorkExperienceMutation.mutateAsync(item.id)
      removeExperienceRowLocal(item.localId)

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })

      setSuccess('experience', 'Опыт работы удалён.')
    } catch (err) {
      setError('experience', getErrorMessage(err, 'Не удалось удалить опыт работы.'))
    }
  }

  const handleDeleteResume = async () => {
    clearNotice('hero')

    const confirmed = window.confirm('Удалить это резюме?')
    if (!confirmed) return

    try {
      await deleteResumeMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] })
      navigate('/applicant')
    } catch (err) {
      setError('hero', getErrorMessage(err, 'Не удалось удалить резюме.'))
    }
  }

  if (!resumeId || Number.isNaN(numericResumeId) || numericResumeId <= 0) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty">Некорректный идентификатор резюме.</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (applicantQuery.isLoading || resumeQuery.isLoading) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty">Загрузка данных...</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (applicantQuery.isError || resumeQuery.isError) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty resume-editor-empty--error">
              {getErrorMessage(
                resumeQuery.error || applicantQuery.error,
                'Не удалось загрузить данные резюме.',
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const selectedBirthMonthLabel =
    monthOptions.find((item) => item.value === birthMonth)?.label || ''

  const selectedGenderLabel = genderOptions.find((item) => item.value === gender)?.label || ''

  return (
    <div className="resume-editor-page">
      <Header />

      <main className="resume-editor-page__main">
        <div className="resume-editor-page__container">
          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-hero__topbar">
              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--outline"
                onClick={() => navigate('/applicant')}
              >
                ← Назад к списку резюме
              </button>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--danger"
                onClick={handleDeleteResume}
                disabled={deleteResumeMutation.isPending}
              >
                Удалить резюме
              </button>
            </div>

            <SectionNotice notice={notices.hero || null} />

            <div className="resume-editor-hero__content">
              <div className="resume-editor-hero__label">Резюме</div>

              <h1 className="resume-editor-hero__title">
                {selectedProfessionName || currentResume?.profession?.name || 'Резюме'}
              </h1>

              <div className="resume-editor-hero__meta">
                Создано: {formatDateTime(currentResume?.created_at)} · Обновлено:{' '}
                {formatDateTime(currentResume?.updated_at)}
              </div>
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Профессия резюме</h2>
                <p className="resume-editor-section__subtitle">
                  Выберите профессию строго из справочника.
                </p>
              </div>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--primary"
                onClick={handleSaveResume}
                disabled={resumeMutation.isPending}
              >
                Сохранить резюме
              </button>
            </div>

            <SectionNotice notice={notices.resume || null} />

            <div className="resume-editor-subcard resume-editor-subcard--highlight">
              <label className="field">
                <span>Профессия</span>

                <SearchCombo
                  value={professionSearch}
                  placeholder="Поиск профессии"
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
                  }}
                />
              </label>
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Профиль соискателя</h2>
                <p className="resume-editor-section__subtitle">
                  Эти данные относятся ко всему профилю, а не только к одному резюме.
                </p>
              </div>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--primary"
                onClick={handleSaveProfile}
                disabled={profileMutation.isPending}
              >
                Сохранить профиль
              </button>
            </div>

            <SectionNotice notice={notices.profile || null} />

            <div className="resume-editor-subgrid">
              <div className="resume-editor-subcard">
                <div className="resume-editor-subcard__title">Личные данные</div>

                <div className="form-grid form-grid--three">
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

                  <label className="field">
                    <span>Отчество</span>
                    <input
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      placeholder="Например: Иванович"
                    />
                  </label>
                </div>

                <div className="form-grid form-grid--two">
                  <label className="field">
                    <span>Пол</span>

                    <SelectCombo
                      value={selectedGenderLabel}
                      placeholder="Выберите пол"
                      isOpen={openCombo === 'gender'}
                      options={genderOptions}
                      activeValue={gender}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'gender' ? null : 'gender'))
                      }
                      onSelect={(option) => {
                        setGender(String(option.value) as GenderValue)
                        setOpenCombo(null)
                      }}
                    />
                  </label>
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
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="resume-editor-subcard">
                <div className="resume-editor-subcard__title">Контактная информация</div>

                <div className="form-grid">
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
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Навыки</h2>
                <p className="resume-editor-section__subtitle">
                  Навыки привязаны к выбранному резюме.
                </p>
              </div>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--primary"
                onClick={handleSaveSkills}
                disabled={addSkillsBatchMutation.isPending || removeSkillMutation.isPending}
              >
                Сохранить навыки
              </button>
            </div>

            <SectionNotice notice={notices.skills || null} />

            <div className="resume-editor-subcard resume-editor-subcard--highlight">
              <label className="field">
                <span>Навыки</span>

                <SearchCombo
                  value={skillSearch}
                  placeholder="Поиск навыков"
                  isOpen={openCombo === 'skills'}
                  options={filteredSkills}
                  emptyText={skillsQuery.isLoading ? 'Загружаем навыки...' : 'Навыки не найдены'}
                  onFocus={() => setOpenCombo('skills')}
                  onChange={(value) => {
                    setSkillSearch(value)
                    setOpenCombo('skills')
                  }}
                  onSelect={(option) => addSkillToSelection(Number(option.value))}
                />
              </label>

              {selectedSkills.length > 0 ? (
                <div className="chip-list chip-list--selected">
                  {selectedSkills.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chip chip--selected"
                      onClick={() => removeSkillFromSelection(item.id)}
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
                      onClick={() => addSkillToSelection(Number(item.value))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Опыт работы</h2>
                <p className="resume-editor-section__subtitle">
                  Каждую запись можно редактировать отдельно.
                </p>
              </div>

              <div className="resume-editor-actions">
                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--ghost"
                  onClick={addExperienceRow}
                >
                  Добавить опыт
                </button>

                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--primary"
                  onClick={handleSaveExperiences}
                  disabled={
                    addWorkExperienceMutation.isPending || updateWorkExperienceMutation.isPending
                  }
                >
                  Сохранить опыт
                </button>
              </div>
            </div>

            <SectionNotice notice={notices.experience || null} />

            {experiences.length === 0 ? (
              <div className="resume-editor-empty-inline">Опыт работы пока не добавлен.</div>
            ) : null}

            {experiences.map((experience, index) => {
              const startMonthLabel =
                monthOptions.find((item) => item.value === experience.start_month)?.label || ''

              const endMonthLabel =
                monthOptions.find((item) => item.value === experience.end_month)?.label || ''

              return (
                <div key={experience.localId} className="experience-card">
                  <div className="experience-card__head">
                    <h3>Опыт работы {index + 1}</h3>

                    <button
                      type="button"
                      className="link-danger"
                      onClick={() => handleDeleteExperience(experience)}
                      disabled={deleteWorkExperienceMutation.isPending}
                    >
                      Удалить
                    </button>
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
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Образование</h2>
                <p className="resume-editor-section__subtitle">
                  Эти записи относятся ко всему профилю соискателя.
                </p>
              </div>

              <div className="resume-editor-actions">
                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--ghost"
                  onClick={addEducationRow}
                >
                  Добавить образование
                </button>

                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--primary"
                  onClick={handleSaveEducations}
                  disabled={addEducationMutation.isPending || updateEducationMutation.isPending}
                >
                  Сохранить образование
                </button>
              </div>
            </div>

            <SectionNotice notice={notices.education || null} />

            {educations.length === 0 ? (
              <div className="resume-editor-empty-inline">Образование пока не добавлено.</div>
            ) : null}

            {educations.map((education, index) => {
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
                    <h3>Образование {index + 1}</h3>

                    <button
                      type="button"
                      className="link-danger"
                      onClick={() => handleDeleteEducation(education)}
                      disabled={deleteEducationMutation.isPending}
                    >
                      Удалить
                    </button>
                  </div>

                  <label className="field">
                    <span>Учебное заведение</span>

                    <SearchCombo
                      value={education.institution_name}
                      placeholder="Поиск учебного заведения"
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
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}