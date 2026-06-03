import type { AxiosError } from 'axios'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './employer-company-profile.css'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'

type VacancySummary = {
  id: number
}

type GeoRegion = {
  id: number
  name: string
}

type GeoDistrict = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
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

type CompanyCityItem =
  | GeoCity
  | {
      id: number
      name?: string | null
      full_name?: string | null
      region_id?: number | null
      region_name?: string | null
      district_id?: number | null
      district_name?: string | null
      settlement_type_id?: number | null
      settlement_type_name?: string | null
    }

type CompanyProfile = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies_count?: number | null
  vacancies?: VacancySummary[]
  city_ids?: number[] | null
  city_names?: string[] | null
  cities?: CompanyCityItem[] | null
}

type AuthMeResponse = {
  id: number
  email: string
  role: string
  is_active: boolean
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

type CompanyFieldErrors = {
  name: string
  description: string
  website: string
  foundedYear: string
  employeeCount: string
  offices: string
}

type PasswordInputProps = {
  value: string
  placeholder: string
  autoComplete?: string
  onChange: (value: string) => void
}

const currentYear = new Date().getFullYear()
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const specialRegex = /[^A-Za-zА-Яа-я0-9]/

const emptyCompanyFieldErrors = (): CompanyFieldErrors => ({
  name: '',
  description: '',
  website: '',
  foundedYear: '',
  employeeCount: '',
  offices: '',
})

const fetchCompanyProfile = async (): Promise<CompanyProfile> => {
  const { data } = await http.get('/companies/me')
  return data
}

const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  const { data } = await http.get('/auth/me')
  return data
}

const updateCompanyProfile = async (payload: Record<string, unknown>): Promise<CompanyProfile> => {
  const { data } = await http.put('/companies/me', payload)
  return data
}

const uploadCompanyLogo = async (file: File): Promise<CompanyProfile> => {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await http.post('/companies/me/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}
const deleteCompanyLogo = async (): Promise<CompanyProfile> => {
  const { data } = await http.delete('/companies/me/logo')
  return data
}
const updateSensitiveCredentials = async (payload: {
  email: string
  phone: string | null
  current_password: string
}) => {
  const { data } = await http.patch('/auth/me/credentials', payload)
  return data
}

const changePassword = async (payload: {
  current_password: string
  new_password: string
}) => {
  const { data } = await http.patch('/auth/me/password', payload)
  return data
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

const isValidUrl = (value: string) => {
  if (!value.trim()) return true

  try {
    const url = new URL(normalizeUrl(value))
    return Boolean(url.hostname.includes('.'))
  } catch {
    return false
  }
}

const parsePositiveInteger = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return undefined

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined

  return parsed
}

const normalizeArrayResponse = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]

  if (value && typeof value === 'object') {
    const payload = value as { items?: unknown[]; results?: unknown[]; data?: unknown[] }

    if (Array.isArray(payload.items)) return payload.items as T[]
    if (Array.isArray(payload.results)) return payload.results as T[]
    if (Array.isArray(payload.data)) return payload.data as T[]
  }

  return []
}

const fetchCatalog = async <T,>(catalogName: string, limit = 100): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit },
  })

  return normalizeArrayResponse<T>(data)
}

const getCityDisplayName = (city?: Partial<GeoCity> | null) => {
  if (!city) return ''
  if (city.full_name?.trim()) return city.full_name.trim()

  const settlementType = city.settlement_type_name?.trim() || ''
  const title = [settlementType, city.name].filter(Boolean).join(' ').trim()

  return [title, city.district_name, city.region_name]
    .filter((item) => item && String(item).trim())
    .join(', ')
}

const formatCompactNumber = (value?: number | null) => {
  if (value === null || value === undefined) return '—'
  if (value < 1000) return String(value)

  if (value < 1_000_000) {
    const result = value / 1000
    return `${Number.isInteger(result) ? result : result.toFixed(1)}k+`
  }

  const result = value / 1_000_000
  return `${Number.isInteger(result) ? result : result.toFixed(1)}M+`
}

const getCompanyInitials = (name: string) => {
  const normalized = name.trim()
  if (!normalized) return 'C'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('users_email_key') || lower.includes('key (email)')) {
    return 'Email уже используется другим аккаунтом.'
  }

  if (
    lower.includes('email already') ||
    lower.includes('email exists') ||
    lower.includes('почта уже') ||
    lower.includes('email уже')
  ) {
    return 'Email уже используется другим аккаунтом.'
  }

  if (
    lower.includes('incorrect password') ||
    lower.includes('invalid password') ||
    lower.includes('wrong password') ||
    lower.includes('неверный пароль') ||
    lower.includes('текущий пароль')
  ) {
    return 'Неверный текущий пароль.'
  }

  if (
    lower.includes('input should be a valid email') ||
    lower.includes('value is not a valid email') ||
    lower.includes('valid email')
  ) {
    return 'Введите корректный email.'
  }

  if (lower.includes('name') || lower.includes('company') || lower.includes('название')) {
    return 'Укажите название компании.'
  }

  if (lower.includes('website') || lower.includes('url') || lower.includes('сайт')) {
    return 'Проверьте ссылку на сайт компании.'
  }

  if (lower.includes('founded') || lower.includes('year') || lower.includes('год')) {
    return 'Проверьте год основания.'
  }

  if (lower.includes('employee') || lower.includes('сотруд')) {
    return 'Проверьте количество сотрудников.'
  }

  if (
    lower.includes('file') ||
    lower.includes('image') ||
    lower.includes('logo') ||
    lower.includes('файл') ||
    lower.includes('изображ') ||
    lower.includes('логотип')
  ) {
    return message || 'Проверьте файл логотипа.'
  }

  if (lower.includes('field required')) return 'Заполните обязательные поля.'

  if (lower.includes('string should have at least')) {
    const count = message.match(/(\d+)/)?.[1]
    return count ? `Поле должно содержать минимум ${count} символов.` : 'Слишком короткое значение.'
  }

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ запрещ')) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (lower.includes('profile not found') || lower.includes('компании не найден')) {
    return 'Профиль компании не найден.'
  }

  if (status === 400) return message || 'Некорректные данные.'
  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return message || 'Такие данные уже используются другим аккаунтом.'
  if (status === 422) return message || 'Проверьте корректность введённых данных.'
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  if (message.length > 220) {
    return 'Не удалось выполнить действие. Проверьте данные и попробуйте снова.'
  }

  return message || 'Не удалось выполнить действие.'
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
      return 'Такие данные уже используются другим аккаунтом.'
    case 422:
      return 'Проверьте корректность введённых данных.'
    case 429:
      return 'Слишком много попыток. Попробуйте позже.'
    default:
      return status && status >= 500 ? 'Ошибка сервера. Попробуйте позже.' : fallback
  }
}

const validateEmailValue = (value: string) => {
  const normalized = value.trim()

  if (!normalized) return 'Введите email.'
  if (!emailRegex.test(normalized)) return 'Введите корректный email.'

  return ''
}

const validatePasswordValue = (value: string) => {
  const errors: string[] = []

  if (!value) {
    errors.push('Введите новый пароль.')
    return errors
  }

  if (/\s/.test(value)) errors.push('Пароль не должен содержать пробелы.')
  if (value.length < 8) errors.push('Пароль должен содержать минимум 8 символов.')
  if (!/[a-zа-я]/.test(value)) errors.push('Пароль должен содержать хотя бы одну строчную букву.')
  if (!/[A-ZА-Я]/.test(value)) errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
  if (!/\d/.test(value)) errors.push('Пароль должен содержать хотя бы одну цифру.')
  if (!specialRegex.test(value)) errors.push('Пароль должен содержать хотя бы один специальный символ.')

  return errors
}

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null
  return <span className="company-profile-field__error">{message}</span>
}

const PasswordErrors = ({ errors }: { errors: string[] }) => {
  if (!errors.length) return null

  return (
    <div className="company-profile-field-errors">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  )
}

const PasswordInput = ({
  value,
  placeholder,
  autoComplete,
  onChange,
}: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="company-password-input">
      <input
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />

      <button
        type="button"
        className="company-password-input__toggle"
        onClick={() => setIsVisible((prev) => !prev)}
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        <img src={isVisible ? hidePasswordIcon : showPasswordIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  )
}

const EditIcon = () => (
  <svg className="company-security-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 6.5l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type SecurityModalProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  className?: string
  closeDisabled?: boolean
}

const SecurityModal = ({
  title,
  subtitle,
  onClose,
  children,
  className = '',
  closeDisabled = false,
}: SecurityModalProps) => (
  <div
    className="company-profile-modal-overlay"
    onClick={() => {
      if (!closeDisabled) onClose()
    }}
  >
    <div
      className={`company-profile-modal ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="company-profile-modal__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <button
          type="button"
          className="company-profile-modal__close"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Закрыть"
        >
          <span>×</span>
        </button>
      </div>

      {children}
    </div>
  </div>
)

type CompanyGeoSelectOption = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_name?: string | null
  full_name?: string | null
}

type CompanyGeoSelectProps = {
  label: string
  placeholder: string
  value: string
  options: CompanyGeoSelectOption[]
  openKey: string
  openSelect: string | null
  disabled?: boolean
  isLoading?: boolean
  emptyText?: string
  getLabel?: (item: CompanyGeoSelectOption) => string
  setOpenSelect: (value: string | null) => void
  onChange: (value: string) => void
}

const CompanyGeoSelect = ({
  label,
  placeholder,
  value,
  options,
  openKey,
  openSelect,
  disabled = false,
  isLoading = false,
  emptyText = 'Нет вариантов',
  getLabel = (item) => item.name,
  setOpenSelect,
  onChange,
}: CompanyGeoSelectProps) => {
  const isDisabled = disabled || isLoading
  const isOpen = !isDisabled && openSelect === openKey
  const selected = options.find((item) => String(item.id) === value)
  const selectedLabel = selected ? getLabel(selected) : ''

  return (
    <div className={`company-geo-select ${isOpen ? 'is-open' : ''} ${isDisabled ? 'is-disabled' : ''}`}>
      <span className="company-profile-field-label">{label}</span>

      <button
        type="button"
        className={`company-geo-select__trigger ${isOpen ? 'is-open' : ''}`}
        disabled={isDisabled}
        onClick={() => setOpenSelect(isOpen ? null : openKey)}
        aria-expanded={isOpen}
      >
        <span className={selected ? 'is-value' : 'is-placeholder'}>
          {isLoading ? 'Загружаем...' : selectedLabel || placeholder}
        </span>

        <svg className="company-geo-select__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9L12 15L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="company-geo-select__dropdown">
          <button
            type="button"
            className={`company-geo-select__option ${!value ? 'is-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('')
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
                className={`company-geo-select__option ${String(item.id) === value ? 'is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(String(item.id))
                  setOpenSelect(null)
                }}
              >
                {getLabel(item)}
              </button>
            ))
          ) : (
            <div className="company-geo-select__empty">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

type CompanyOfficeSelectorProps = {
  cities: GeoCity[]
  regions: GeoRegion[]
  districts: GeoDistrict[]
  selectedCityIds: number[]
  regionId: string
  districtId: string
  cityIdToAdd: string
  openSelect: string | null
  isCitiesLoading?: boolean
  isRegionsLoading?: boolean
  isDistrictsLoading?: boolean
  error?: string
  setOpenSelect: (value: string | null) => void
  onRegionChange: (value: string) => void
  onDistrictChange: (value: string) => void
  onCityIdToAddChange: (value: string) => void
  onAddCity: () => void
  onRemoveCity: (cityId: number) => void
}

const CompanyOfficeSelector = ({
  cities,
  regions,
  districts,
  selectedCityIds,
  regionId,
  districtId,
  cityIdToAdd,
  openSelect,
  isCitiesLoading = false,
  isRegionsLoading = false,
  isDistrictsLoading = false,
  error,
  setOpenSelect,
  onRegionChange,
  onDistrictChange,
  onCityIdToAddChange,
  onAddCity,
  onRemoveCity,
}: CompanyOfficeSelectorProps) => {
  const selectedCities = useMemo(() => {
    return selectedCityIds
      .map((cityId) => cities.find((city) => city.id === cityId))
      .filter(Boolean) as GeoCity[]
  }, [cities, selectedCityIds])

  const filteredDistricts = useMemo(() => {
    if (!regionId) return districts
    return districts.filter((district) => String(district.region_id) === regionId)
  }, [districts, regionId])

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      const matchesRegion = !regionId || String(city.region_id) === regionId
      const matchesDistrict = !districtId || String(city.district_id) === districtId
      const notSelected = !selectedCityIds.includes(city.id)

      return matchesRegion && matchesDistrict && notSelected
    })
  }, [cities, regionId, districtId, selectedCityIds])

  return (
    <section className="company-profile-offices">
      <div className="company-profile-offices__head">
        <div>
          <h3>Офисы</h3>
          <p>Выберите города, где у компании есть офисы или рабочие точки.</p>
        </div>

        <span>{selectedCityIds.length} выбрано</span>
      </div>

      {error ? <FieldError message={error} /> : null}

      <div className="company-profile-office-controls">
        <CompanyGeoSelect
          label="Область"
          placeholder="Выберите область"
          value={regionId}
          options={regions}
          openKey="office-region"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          isLoading={isRegionsLoading}
          emptyText="Области не найдены"
          onChange={(value) => {
            onRegionChange(value)
            onDistrictChange('')
            onCityIdToAddChange('')
          }}
        />

        <CompanyGeoSelect
          label="Район"
          placeholder={regionId ? 'Выберите район' : 'Сначала область'}
          value={districtId}
          options={filteredDistricts}
          openKey="office-district"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          disabled={!regionId}
          isLoading={isDistrictsLoading}
          emptyText="Районы не найдены"
          getLabel={(district) =>
            district.region_name ? `${district.name}, ${district.region_name}` : district.name
          }
          onChange={(value) => {
            onDistrictChange(value)
            onCityIdToAddChange('')
          }}
        />

        <CompanyGeoSelect
          label="Город / населённый пункт"
          placeholder={districtId ? 'Выберите город' : 'Сначала район'}
          value={cityIdToAdd}
          options={filteredCities}
          openKey="office-city"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          disabled={!districtId}
          isLoading={isCitiesLoading}
          emptyText="Города не найдены"
          getLabel={(city) => getCityDisplayName(city)}
          onChange={onCityIdToAddChange}
        />

        <button
          type="button"
          className="company-profile-btn company-profile-btn--primary company-profile-office-add-btn"
          onClick={onAddCity}
          disabled={!cityIdToAdd}
        >
          Добавить город
        </button>
      </div>

      {selectedCities.length > 0 ? (
        <div className="company-profile-office-list">
          {selectedCities.map((city) => (
            <div key={city.id} className="company-profile-office-chip">
              <span>{getCityDisplayName(city)}</span>

              <button
                type="button"
                onClick={() => onRemoveCity(city.id)}
                aria-label={`Удалить ${getCityDisplayName(city)}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="company-profile-offices__empty">
          Города офисов пока не выбраны. Добавьте хотя бы один город, чтобы кандидаты видели географию компании.
        </div>
      )}
    </section>
  )
}

export const EmployerCompanyProfilePage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const [noticeSuccess, setNoticeSuccess] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<CompanyFieldErrors>(emptyCompanyFieldErrors())

  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [emailWarning, setEmailWarning] = useState('')
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')

  const [selectedCityIds, setSelectedCityIds] = useState<number[]>([])
  const [officeRegionId, setOfficeRegionId] = useState('')
  const [officeDistrictId, setOfficeDistrictId] = useState('')
  const [officeCityIdToAdd, setOfficeCityIdToAdd] = useState('')
  const [openOfficeSelect, setOpenOfficeSelect] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [emailPassword, setEmailPassword] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const [logoModalError, setLogoModalError] = useState('')

  const profileQuery = useQuery({
    queryKey: ['employer-profile', 'company-profile-page'],
    queryFn: fetchCompanyProfile,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const authMeQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: fetchAuthMe,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const regionsQuery = useQuery({
    queryKey: ['company-profile-regions'],
    queryFn: () => fetchCatalog<GeoRegion>('regions'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const districtsQuery = useQuery({
    queryKey: ['company-profile-districts'],
    queryFn: () => fetchCatalog<GeoDistrict>('districts'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['company-profile-cities'],
    queryFn: () => fetchCatalog<GeoCity>('cities'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const updateProfileMutation = useMutation({
    mutationFn: updateCompanyProfile,
    onSuccess: async (updatedProfile) => {
      setNoticeSuccess('Профиль компании успешно сохранён.')
      setNoticeError('')
      setFieldErrors(emptyCompanyFieldErrors())

      queryClient.setQueryData(['employer-profile', 'company-profile-page'], updatedProfile)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-profile', 'company-profile-page'] }),
      ])
    },
    onError: (error) => {
      setNoticeSuccess('')
      setNoticeError(getApiErrorMessage(error, 'Не удалось сохранить профиль компании.'))
    },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: uploadCompanyLogo,
    onSuccess: async (updatedProfile) => {
      setNoticeSuccess('Логотип компании успешно обновлён.')
      setNoticeError('')
      setLogoModalError('')
      setIsLogoModalOpen(false)
      setLogoFile(null)

      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
        setLogoPreviewUrl('')
      }

      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }

      queryClient.setQueryData(['employer-profile', 'company-profile-page'], updatedProfile)

      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-profile', 'company-profile-page'] }),
      ])
    },
    onError: (error) => {
      setLogoModalError(getApiErrorMessage(error, 'Не удалось загрузить логотип компании.'))
    },
  })
const deleteLogoMutation = useMutation({
  mutationFn: deleteCompanyLogo,
  onSuccess: async (updatedProfile) => {
    setNoticeSuccess('Логотип компании удалён.')
    setNoticeError('')
    setLogoModalError('')
    setIsLogoModalOpen(false)
    setLogoFile(null)

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
      setLogoPreviewUrl('')
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }

    queryClient.setQueryData(['employer-profile', 'company-profile-page'], updatedProfile)

    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['employer-profile', 'company-profile-page'] }),
    ])
  },
  onError: (error) => {
    setLogoModalError(getApiErrorMessage(error, 'Не удалось удалить логотип компании.'))
  },
})
  const emailMutation = useMutation({
    mutationFn: updateSensitiveCredentials,
    onSuccess: async () => {
      const normalizedEmail = emailDraft.trim()

      setEmail(normalizedEmail)
      setEmailSuccess('Email успешно обновлён.')
      setEmailError('')
      setEmailPassword('')
      setEmailWarning('')

      await queryClient.invalidateQueries({ queryKey: ['auth-me'] })
    },
    onError: (error) => {
      setEmailSuccess('')
      setEmailError(getApiErrorMessage(error, 'Не удалось изменить email.'))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess('Пароль успешно изменён.')
      setPasswordError('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPasswordWarnings([])
    },
    onError: (error) => {
      setPasswordSuccess('')
      setPasswordError(getApiErrorMessage(error, 'Не удалось изменить пароль.'))
    },
  })

  const profile = profileQuery.data
  const authMe = authMeQuery.data

  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []
  const cities = citiesQuery.data || []

  const normalizedLogo = profile?.logo?.trim() || ''
  const displayName = name.trim() || profile?.name || 'Компания'
  const initials = getCompanyInitials(displayName)
  const vacanciesCount = profile?.vacancies_count ?? profile?.vacancies?.length ?? 0

  const selectedCities = useMemo(() => {
    return selectedCityIds
      .map((cityId) => cities.find((city) => city.id === cityId))
      .filter(Boolean) as GeoCity[]
  }, [cities, selectedCityIds])

  const completionPercent = useMemo(() => {
    const checks = [
      Boolean(name.trim()),
      Boolean(description.trim()),
      Boolean(website.trim()),
      Boolean(foundedYear.trim()),
      Boolean(employeeCount.trim()),
      selectedCityIds.length > 0,
      Boolean(normalizedLogo),
    ]

    const completed = checks.filter(Boolean).length
    return Math.round((completed / checks.length) * 100)
  }, [description, employeeCount, foundedYear, name, normalizedLogo, selectedCityIds.length, website])

  const yearsOnMarket = useMemo(() => {
    const year = parsePositiveInteger(foundedYear)

    if (!year) return null
    if (year > currentYear) return null

    return currentYear - year
  }, [foundedYear])

  useEffect(() => {
    if (!profile) return

    setName(profile.name || '')
    setDescription(profile.description || '')
    setWebsite(profile.website || '')
    setFoundedYear(profile.founded_year ? String(profile.founded_year) : '')
    setEmployeeCount(profile.employee_count ? String(profile.employee_count) : '')

    const idsFromCities = Array.isArray(profile.cities)
      ? profile.cities
          .map((city) => Number(city.id))
          .filter((cityId) => Number.isFinite(cityId) && cityId > 0)
      : []

    const idsFromPayload = Array.isArray(profile.city_ids)
      ? profile.city_ids
          .map(Number)
          .filter((cityId) => Number.isFinite(cityId) && cityId > 0)
      : []

    setSelectedCityIds(Array.from(new Set([...idsFromCities, ...idsFromPayload])))
  }, [profile])

  useEffect(() => {
    if (!authMe) return

    setEmail(authMe.email || '')
    setEmailDraft(authMe.email || '')
  }, [authMe])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.company-geo-select')) {
        setOpenOfficeSelect(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [])

  useEffect(() => {
    const hasOpenedModal = isEmailModalOpen || isPasswordModalOpen || isLogoModalOpen
    document.body.style.overflow = hasOpenedModal ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isEmailModalOpen, isPasswordModalOpen, isLogoModalOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      if (!emailMutation.isPending) setIsEmailModalOpen(false)
      if (!passwordMutation.isPending) setIsPasswordModalOpen(false)
      if (!uploadLogoMutation.isPending && !deleteLogoMutation.isPending) {
  handleCloseLogoModal()
}
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [
    emailMutation.isPending,
    passwordMutation.isPending,
    uploadLogoMutation.isPending,
    deleteLogoMutation.isPending,
    logoPreviewUrl,
  ])

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

  const validateCompanyForm = () => {
    const errors = emptyCompanyFieldErrors()

    if (!name.trim()) {
      errors.name = 'Введите название компании.'
    }

    if (name.trim().length > 255) {
      errors.name = 'Название компании должно быть не длиннее 255 символов.'
    }

    if (description.trim().length > 5000) {
      errors.description = 'Описание должно быть не длиннее 5000 символов.'
    }

    if (!isValidUrl(website)) {
      errors.website = 'Введите корректную ссылку на сайт.'
    }

    const parsedFoundedYear = parsePositiveInteger(foundedYear)

    if (parsedFoundedYear === undefined) {
      errors.foundedYear = 'Введите корректный год основания.'
    } else if (parsedFoundedYear !== null && (parsedFoundedYear < 1800 || parsedFoundedYear > 2100)) {
      errors.foundedYear = 'Год основания должен быть от 1800 до 2100.'
    }

    const parsedEmployeeCount = parsePositiveInteger(employeeCount)

    if (parsedEmployeeCount === undefined) {
      errors.employeeCount = 'Введите корректное количество сотрудников.'
    }

    if (selectedCityIds.length === 0) {
      errors.offices = 'Добавьте хотя бы один город офиса компании.'
    }

    setFieldErrors(errors)

    return !Object.values(errors).some(Boolean)
  }

  const handleSaveProfile = async () => {
    setNoticeSuccess('')
    setNoticeError('')

    if (!validateCompanyForm()) {
      setNoticeError('Проверьте поля формы.')
      return
    }

    const parsedFoundedYear = parsePositiveInteger(foundedYear)
    const parsedEmployeeCount = parsePositiveInteger(employeeCount)

    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        website: website.trim() ? normalizeUrl(website) : null,
        founded_year: parsedFoundedYear,
        employee_count: parsedEmployeeCount,
        city_ids: selectedCityIds,
      })
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const handleSaveEmail = async () => {
    setEmailSuccess('')
    setEmailError('')

    const warning = validateEmailValue(emailDraft)
    setEmailWarning(warning)

    if (warning) {
      setEmailError(warning)
      return
    }

    if (!emailPassword.trim()) {
      setEmailError('Введите текущий пароль.')
      return
    }

    try {
      await emailMutation.mutateAsync({
        email: emailDraft.trim(),
        phone: null,
        current_password: emailPassword,
      })
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const handleChangePassword = async () => {
    setPasswordSuccess('')
    setPasswordError('')

    if (!currentPassword.trim()) {
      setPasswordError('Введите текущий пароль.')
      return
    }

    const warnings = validatePasswordValue(newPassword)
    setPasswordWarnings(warnings)

    if (warnings.length > 0) {
      setPasswordError('Проверьте новый пароль.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Новые пароли не совпадают.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('Новый пароль должен отличаться от текущего.')
      return
    }

    try {
      await passwordMutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      })

      authSession.clear?.()

      window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1200)
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const handleAddOfficeCity = () => {
    const cityId = Number(officeCityIdToAdd)

    if (!Number.isFinite(cityId) || cityId <= 0) return

    setSelectedCityIds((prev) => Array.from(new Set([...prev, cityId])))
    setOfficeCityIdToAdd('')
    setFieldErrors((prev) => ({ ...prev, offices: '' }))
  }

  const handleRemoveOfficeCity = (cityId: number) => {
    setSelectedCityIds((prev) => prev.filter((id) => id !== cityId))
  }

  const handleOpenEmailModal = () => {
    setEmailDraft(email)
    setEmailPassword('')
    setEmailWarning('')
    setEmailSuccess('')
    setEmailError('')
    setIsEmailModalOpen(true)
  }

  const handleOpenPasswordModal = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordWarnings([])
    setPasswordSuccess('')
    setPasswordError('')
    setIsPasswordModalOpen(true)
  }

  const handleOpenLogoModal = () => {
    setLogoModalError('')
    setLogoFile(null)

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
      setLogoPreviewUrl('')
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }

    setIsLogoModalOpen(true)
  }

  const handleCloseLogoModal = () => {
  if (uploadLogoMutation.isPending || deleteLogoMutation.isPending) return

  setIsLogoModalOpen(false)
  setLogoModalError('')
  setLogoFile(null)

  if (logoPreviewUrl) {
    URL.revokeObjectURL(logoPreviewUrl)
    setLogoPreviewUrl('')
  }

  if (logoInputRef.current) {
    logoInputRef.current.value = ''
  }
}
const handleDeleteLogo = async () => {
  setLogoModalError('')

  if (!normalizedLogo) {
    setLogoModalError('У компании пока нет логотипа.')
    return
  }

  try {
    await deleteLogoMutation.mutateAsync()
  } catch {
    // Ошибка обработана в onError.
  }
}

  const handleSelectLogoFile = (file?: File | null) => {
    setLogoModalError('')

    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setLogoModalError('Выберите изображение в формате JPG, PNG или WEBP.')
      return
    }

    const maxSize = 8 * 1024 * 1024

    if (file.size > maxSize) {
      setLogoModalError('Логотип должен быть не больше 8 МБ.')
      return
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
    }

    setLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
  }

  const handleSaveLogo = async () => {
    setLogoModalError('')

    if (!logoFile) {
      setLogoModalError('Сначала выберите логотип.')
      return
    }

    try {
      await uploadLogoMutation.mutateAsync(logoFile)
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const isPageLoading = profileQuery.isLoading || authMeQuery.isLoading
  const isPageError = profileQuery.isError || authMeQuery.isError

  return (
    <div className="company-profile-page">
      <Header />

      <main className="company-profile-page__main">
        <div className="company-profile-container">
          <section className="company-profile-shell">
            <aside className="company-profile-sidebar">
              <section className="company-profile-summary-card">
                <div className="company-profile-logo-wrap">
                  {normalizedLogo ? (
                    <img src={normalizedLogo} alt="Логотип компании" className="company-profile-logo" />
                  ) : (
                    <div className="company-profile-logo company-profile-logo--placeholder">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="company-profile-summary-content">
                  <span className="company-profile-eyebrow">Компания</span>
                  <h1>{displayName}</h1>
                  <p>Заполненный профиль помогает кандидатам быстрее понять работодателя.</p>
                </div>

                <div className="company-profile-progress">
                  <div className="company-profile-progress__head">
                    <span>Заполненность</span>
                    <strong>{completionPercent}%</strong>
                  </div>

                  <div className="company-profile-progress__bar">
                    <span style={{ width: `${completionPercent}%` }} />
                  </div>
                </div>

                <div className="company-profile-stats">
                  <div className="company-profile-stat">
                    <span>Вакансий</span>
                    <strong>{formatCompactNumber(vacanciesCount)}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Сотрудников</span>
                    <strong>{formatCompactNumber(parsePositiveInteger(employeeCount) || null)}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Год основания</span>
                    <strong>{yearsOnMarket !== null ? `${yearsOnMarket}` : '—'}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Городов офисов</span>
                    <strong>{selectedCityIds.length}</strong>
                  </div>
                </div>

                <div className="company-profile-logo-actions">
                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--outline company-profile-logo-btn"
                    onClick={handleOpenLogoModal}
                  >
                    {normalizedLogo ? 'Изменить логотип' : 'Загрузить логотип'}
                  </button>

                  {normalizedLogo ? (
                    <button
                      type="button"
                      className="company-profile-btn company-profile-btn--danger company-profile-logo-btn"
                      onClick={handleDeleteLogo}
                      disabled={deleteLogoMutation.isPending}
                    >
                      {deleteLogoMutation.isPending ? 'Удаляем...' : 'Удалить логотип'}
                    </button>
                  ) : null}
                </div>
              </section>
            </aside>

            <section className="company-profile-main">
              <section className="company-profile-main-card">
                <div className="company-profile-main-card__header">
                  <div>
                    <span className="company-profile-eyebrow">Профиль работодателя</span>
                    <h2>Информация о компании</h2>
                    <p>
                      Заполните данные компании, добавьте города офисов и поддерживайте профиль актуальным.
                    </p>
                  </div>
                </div>

                {isPageLoading ? (
                  <div className="company-profile-state">Загружаем профиль компании...</div>
                ) : null}

                {isPageError ? (
                  <div className="company-profile-message company-profile-message--error">
                    Не удалось загрузить профиль компании.
                  </div>
                ) : null}

                {noticeSuccess ? (
                  <div className="company-profile-message company-profile-message--success">
                    {noticeSuccess}
                  </div>
                ) : null}

                {noticeError ? (
                  <div className="company-profile-message company-profile-message--error">
                    {noticeError}
                  </div>
                ) : null}

                <div className="company-profile-form-grid">
                  <label className="company-profile-field company-profile-field--full">
                    <span>Название компании</span>
                    <input
                      value={name}
                      placeholder="Например: SaleSoft"
                      onChange={(event) => {
                        setName(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, name: '' }))
                      }}
                    />
                    <FieldError message={fieldErrors.name} />
                  </label>

                  <label className="company-profile-field company-profile-field--full">
                    <span>Описание</span>
                    <textarea
                      value={description}
                      placeholder="Расскажите о компании, продуктах, команде и условиях работы."
                      onChange={(event) => {
                        setDescription(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, description: '' }))
                      }}
                    />
                    <FieldError message={fieldErrors.description} />
                  </label>

                  <div className="company-profile-counter">
                    {description.length}/5000
                  </div>

                  <label className="company-profile-field">
                    <span>Сайт</span>
                    <input
                      value={website}
                      placeholder="example.com"
                      onChange={(event) => {
                        setWebsite(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, website: '' }))
                      }}
                    />
                    <FieldError message={fieldErrors.website} />
                  </label>

                  <label className="company-profile-field">
                    <span>Год основания</span>
                    <input
                      value={foundedYear}
                      placeholder="2018"
                      inputMode="numeric"
                      onChange={(event) => {
                        setFoundedYear(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, foundedYear: '' }))
                      }}
                    />
                    <FieldError message={fieldErrors.foundedYear} />
                  </label>

                  <label className="company-profile-field">
                    <span>Количество сотрудников</span>
                    <input
                      value={employeeCount}
                      placeholder="100"
                      inputMode="numeric"
                      onChange={(event) => {
                        setEmployeeCount(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, employeeCount: '' }))
                      }}
                    />
                    <FieldError message={fieldErrors.employeeCount} />
                  </label>
                </div>

                <CompanyOfficeSelector
                  cities={cities}
                  regions={regions}
                  districts={districts}
                  selectedCityIds={selectedCityIds}
                  regionId={officeRegionId}
                  districtId={officeDistrictId}
                  cityIdToAdd={officeCityIdToAdd}
                  openSelect={openOfficeSelect}
                  isCitiesLoading={citiesQuery.isLoading}
                  isRegionsLoading={regionsQuery.isLoading}
                  isDistrictsLoading={districtsQuery.isLoading}
                  error={fieldErrors.offices}
                  setOpenSelect={setOpenOfficeSelect}
                  onRegionChange={setOfficeRegionId}
                  onDistrictChange={setOfficeDistrictId}
                  onCityIdToAddChange={setOfficeCityIdToAdd}
                  onAddCity={handleAddOfficeCity}
                  onRemoveCity={handleRemoveOfficeCity}
                />

                <div className="company-security-list">
                  <div className="company-security-row">
                    <div className="company-security-row__content">
                      <span>Email</span>
                      <strong>{email || '—'}</strong>
                    </div>

                    <button
                      type="button"
                      className="company-security-edit-btn"
                      onClick={handleOpenEmailModal}
                      aria-label="Изменить email"
                    >
                      <EditIcon />
                    </button>
                  </div>

                  <div className="company-security-row">
                    <div className="company-security-row__content">
                      <span>Пароль</span>
                      <strong>••••••••</strong>
                    </div>

                    <button
                      type="button"
                      className="company-security-edit-btn"
                      onClick={handleOpenPasswordModal}
                      aria-label="Изменить пароль"
                    >
                      <EditIcon />
                    </button>
                  </div>
                </div>

                <div className="company-profile-main-card__footer">
                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--outline"
                    onClick={() => navigate('/employer/vacancies/create')}
                  >
                    Создать вакансию
                  </button>

                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--primary company-profile-save-btn"
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending || isPageLoading}
                  >
                    {updateProfileMutation.isPending ? 'Сохраняем...' : 'Сохранить профиль'}
                  </button>
                </div>
              </section>
            </section>
          </section>
        </div>

        {isLogoModalOpen ? (
          <div className="company-profile-modal-overlay" onClick={handleCloseLogoModal}>
            <div
              className="company-profile-modal company-logo-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="company-profile-modal__header">
                <div>
                  <h2>Выберите лого</h2>
                  <p>
                    Загрузите изображение компании. Оно будет показано в профиле, вакансиях и карточках компании.
                  </p>
                </div>

                <button
                  type="button"
                  className="company-profile-modal__close"
                  onClick={handleCloseLogoModal}
                  disabled={uploadLogoMutation.isPending || deleteLogoMutation.isPending}
                  aria-label="Закрыть"
                >
                  <span>×</span>
                </button>
              </div>

              <div className="company-logo-modal__body">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="company-logo-modal__file-input"
                  onChange={(event) => handleSelectLogoFile(event.target.files?.[0])}
                />

                <button
                  type="button"
                  className="company-logo-modal__choose"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadLogoMutation.isPending || deleteLogoMutation.isPending}
                >
                  Выбрать файл
                </button>

                <div className="company-logo-preview-card">
                  <div className="company-logo-preview-card__avatar">
                    {logoPreviewUrl || normalizedLogo ? (
                      <img src={logoPreviewUrl || normalizedLogo} alt="Предпросмотр логотипа" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="company-logo-preview-card__content">
                    <strong>{displayName}</strong>
                    <span>Так логотип будет выглядеть в карточке компании</span>
                  </div>
                </div>

                {logoFile ? (
                  <div className="company-logo-modal__file-info">
                    <span>{logoFile.name}</span>
                    <strong>{(logoFile.size / 1024 / 1024).toFixed(2)} МБ</strong>
                  </div>
                ) : null}

                {logoModalError ? (
                  <div className="company-profile-message company-profile-message--error">
                    {logoModalError}
                  </div>
                ) : null}
              </div>

              <div className="company-profile-modal__footer company-logo-modal__footer">

                      <button
                        type="button"
                        className="company-profile-btn company-profile-btn--outline"
                        onClick={handleCloseLogoModal}
                        disabled={uploadLogoMutation.isPending || deleteLogoMutation.isPending}
                      >
                        Отмена
                      </button>

                      <button
                        type="button"
                        className="company-profile-btn company-profile-btn--primary"
                        onClick={handleSaveLogo}
                        disabled={!logoFile || uploadLogoMutation.isPending || deleteLogoMutation.isPending}
                      >
                        {uploadLogoMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                      </button>
                    </div>
            </div>
          </div>
        ) : null}

        {isEmailModalOpen ? (
          <SecurityModal
            title="Изменение email"
            onClose={() => setIsEmailModalOpen(false)}
            className="company-profile-modal--compact company-security-modal"
            closeDisabled={emailMutation.isPending}
          >
            {emailSuccess ? (
              <div className="company-profile-message company-profile-message--success">
                {emailSuccess}
              </div>
            ) : null}

            {emailError ? (
              <div className="company-profile-message company-profile-message--error">
                {emailError}
              </div>
            ) : null}

            <div className="company-profile-form-grid company-profile-form-grid--compact">
              <label className="company-profile-field company-profile-field--full">
                <span>Новый email</span>

                <input
                  type="email"
                  value={emailDraft}
                  placeholder="name@example.com"
                  autoComplete="email"
                  onChange={(event) => {
                    const value = event.target.value
                    setEmailDraft(value)
                    setEmailWarning(value ? validateEmailValue(value) : '')
                    setEmailError('')
                  }}
                />

                <FieldError message={emailWarning} />
              </label>

              <label className="company-profile-field company-profile-field--full">
                <span>Текущий пароль</span>

                <PasswordInput
                  value={emailPassword}
                  placeholder="Введите текущий пароль"
                  autoComplete="current-password"
                  onChange={(value) => {
                    setEmailPassword(value)
                    setEmailError('')
                  }}
                />
              </label>
            </div>

            <div className="company-profile-modal__footer">
              <button
                type="button"
                className="company-profile-btn company-profile-btn--outline"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={emailMutation.isPending}
              >
                Отмена
              </button>

              <button
                type="button"
                className="company-profile-btn company-profile-btn--primary"
                onClick={handleSaveEmail}
                disabled={emailMutation.isPending}
              >
                {emailMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </SecurityModal>
        ) : null}

        {isPasswordModalOpen ? (
          <SecurityModal
            title="Смена пароля"
            subtitle="После успешной смены пароля потребуется заново войти в аккаунт."
            onClose={() => setIsPasswordModalOpen(false)}
            className="company-profile-modal--compact company-security-modal"
            closeDisabled={passwordMutation.isPending}
          >
            {passwordSuccess ? (
              <div className="company-profile-message company-profile-message--success">
                {passwordSuccess}
              </div>
            ) : null}

            {passwordError ? (
              <div className="company-profile-message company-profile-message--error">
                {passwordError}
              </div>
            ) : null}

            <div className="company-profile-form-grid company-profile-form-grid--password">
              <label className="company-profile-field company-profile-field--full">
                <span>Текущий пароль</span>

                <PasswordInput
                  value={currentPassword}
                  placeholder="Введите текущий пароль"
                  autoComplete="current-password"
                  onChange={(value) => {
                    setCurrentPassword(value)
                    setPasswordError('')
                  }}
                />
              </label>

              <label className="company-profile-field company-profile-field--full">
                <span>Новый пароль</span>

                <PasswordInput
                  value={newPassword}
                  placeholder="Aa123456!"
                  autoComplete="new-password"
                  onChange={(value) => {
                    setNewPassword(value)
                    setPasswordWarnings(value ? validatePasswordValue(value) : [])
                    setPasswordError('')
                  }}
                />

                <PasswordErrors errors={passwordWarnings} />
              </label>

              <label className="company-profile-field company-profile-field--full">
                <span>Повторите новый пароль</span>

                <PasswordInput
                  value={confirmNewPassword}
                  placeholder="Повторите новый пароль"
                  autoComplete="new-password"
                  onChange={(value) => {
                    setConfirmNewPassword(value)
                    setPasswordError('')
                  }}
                />
              </label>
            </div>

            <div className="company-profile-modal__footer">
              <button
                type="button"
                className="company-profile-btn company-profile-btn--outline"
                onClick={() => setIsPasswordModalOpen(false)}
                disabled={passwordMutation.isPending}
              >
                Отмена
              </button>

              <button
                type="button"
                className="company-profile-btn company-profile-btn--primary"
                onClick={handleChangePassword}
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </SecurityModal>
        ) : null}
      </main>

      <Footer />
    </div>
  )
}