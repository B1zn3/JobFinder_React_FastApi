import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../shared/api/http'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import './companies.css'

type Region = {
  id: number
  name: string
}

type District = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
}

type City = {
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

type CompanyListItem = {
  id: number
  name: string
  logo?: string | null
  city_names?: string[]
  vacancies_count: number
  first_letter?: string
  company_type_name?: string | null
}

const PAGE_SIZE = 12

const RU_LETTERS = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М',
  'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ',
  'Э', 'Ю', 'Я',
]

const EN_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]

const fetchCatalog = async <T,>(catalogName: string, limit = 100): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit },
  })

  return Array.isArray(data) ? data : []
}

const fetchRegions = () => fetchCatalog<Region>('regions', 100)
const fetchDistricts = () => fetchCatalog<District>('districts', 1000)
const fetchCities = () => fetchCatalog<City>('cities', 1000)

const fetchCompanies = async (params: Record<string, unknown>): Promise<CompanyListItem[]> => {
  const { data } = await http.get('/public/companies', { params })
  return Array.isArray(data) ? data : []
}

const getFirstLetter = (name: string) => {
  const first = name.trim().charAt(0).toUpperCase()
  return first || '#'
}

const parseCityIds = (value: string | null): number[] => {
  if (!value) return []

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
}

const formatCompactCount = (value?: number | null) => {
  const num = Number(value ?? 0)

  if (!Number.isFinite(num) || num <= 0) return '0'
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}m+`
  if (num >= 10_000) return `${Math.floor(num / 1_000)}k+`

  return num.toLocaleString('ru-RU')
}

const formatVacanciesLabel = (count?: number) => {
  const value = Number(count ?? 0)

  if (value >= 10_000) {
    return `${formatCompactCount(value)} вакансий`
  }

  const mod10 = value % 10
  const mod100 = value % 100

  if (mod10 === 1 && mod100 !== 11) return `${value} вакансия`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${value} вакансии`
  }

  return `${value} вакансий`
}

const getCityDisplayName = (city?: City | null) => {
  if (!city) return ''

  if (city.full_name?.trim()) {
    return city.full_name.trim()
  }

  const title = [city.settlement_type_name, city.name].filter(Boolean).join(' ')
  const parts = [title, city.district_name, city.region_name].filter(Boolean)

  return parts.join(', ')
}

const formatCitiesPreview = (cityNames?: string[]) => {
  if (!cityNames?.length) return ''

  if (cityNames.length === 1) {
    return cityNames[0]
  }

  return `${cityNames[0]}, и др.`
}

const buildVisiblePages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'dots-right', totalPages] as const
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'dots-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, 'dots-left', currentPage - 1, currentPage, currentPage + 1, 'dots-right', totalPages] as const
}

const CompanyLogo = ({ src, name }: { src?: string | null; name: string }) => {
  if (src) {
    return <img src={src} alt={name} className="companies-page__company-logo-img" />
  }

  return (
    <div className="companies-page__company-logo-placeholder">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

type CityModalProps = {
  open: boolean
  regions: Region[]
  districts: District[]
  cities: City[]
  selectedCityIds: number[]
  onClose: () => void
  onApply: (cityIds: number[]) => void
}

function CityModal({
  open,
  regions,
  districts,
  cities,
  selectedCityIds,
  onClose,
  onApply,
}: CityModalProps) {
  const [tempRegionId, setTempRegionId] = useState<number | null>(null)
  const [tempDistrictId, setTempDistrictId] = useState<number | null>(null)
  const [tempCityIds, setTempCityIds] = useState<number[]>(selectedCityIds)

  useEffect(() => {
    if (open) {
      setTempCityIds(selectedCityIds)

      const firstSelectedCity = cities.find((city) => selectedCityIds.includes(city.id))
      setTempRegionId(firstSelectedCity?.region_id ?? null)
      setTempDistrictId(firstSelectedCity?.district_id ?? null)
    }
  }, [open, selectedCityIds, cities])

  const filteredDistricts = useMemo(() => {
    if (!tempRegionId) return districts
    return districts.filter((district) => district.region_id === tempRegionId)
  }, [districts, tempRegionId])

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      const matchesRegion = !tempRegionId || city.region_id === tempRegionId
      const matchesDistrict = !tempDistrictId || city.district_id === tempDistrictId

      return matchesRegion && matchesDistrict
    })
  }, [cities, tempRegionId, tempDistrictId])

  if (!open) return null

  const toggleCity = (cityId: number) => {
    setTempCityIds((prev) =>
      prev.includes(cityId)
        ? prev.filter((id) => id !== cityId)
        : [...prev, cityId],
    )
  }

  const clearAll = () => {
    setTempRegionId(null)
    setTempDistrictId(null)
    setTempCityIds([])
  }

  return (
    <div className="city-modal__overlay" onClick={onClose}>
      <div className="city-modal city-modal--geo" onClick={(e) => e.stopPropagation()}>
        <div className="city-modal__header">
          <div>
            <h2>Где искать</h2>
            <p>Выберите область, район и один или несколько городов.</p>
          </div>

          <button type="button" className="city-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="city-modal__geo-layout">
          <div className="city-modal__column">
            <div className="city-modal__column-title">Область</div>

            <button
              type="button"
              className={`city-modal__geo-item ${!tempRegionId ? 'is-selected' : ''}`}
              onClick={() => {
                setTempRegionId(null)
                setTempDistrictId(null)
              }}
            >
              Все области
            </button>

            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                className={`city-modal__geo-item ${tempRegionId === region.id ? 'is-selected' : ''}`}
                onClick={() => {
                  setTempRegionId(region.id)
                  setTempDistrictId(null)
                }}
              >
                {region.name}
              </button>
            ))}
          </div>

          <div className="city-modal__column">
            <div className="city-modal__column-title">Район</div>

            <button
              type="button"
              className={`city-modal__geo-item ${!tempDistrictId ? 'is-selected' : ''}`}
              onClick={() => setTempDistrictId(null)}
            >
              Все районы
            </button>

            {filteredDistricts.length > 0 ? (
              filteredDistricts.map((district) => (
                <button
                  key={district.id}
                  type="button"
                  className={`city-modal__geo-item ${
                    tempDistrictId === district.id ? 'is-selected' : ''
                  }`}
                  onClick={() => setTempDistrictId(district.id)}
                >
                  {district.name}
                </button>
              ))
            ) : (
              <div className="city-modal__empty">Районы не найдены</div>
            )}
          </div>

          <div className="city-modal__column city-modal__column--cities">
            <div className="city-modal__column-title">Город / населённый пункт</div>

            <button
              type="button"
              className={`city-modal__item ${tempCityIds.length === 0 ? 'is-selected' : ''}`}
              onClick={() => setTempCityIds([])}
            >
              <span className="city-modal__checkbox" />
              <span>Все города</span>
            </button>

            {filteredCities.length > 0 ? (
              filteredCities.map((city) => {
                const isSelected = tempCityIds.includes(city.id)

                return (
                  <button
                    key={city.id}
                    type="button"
                    className={`city-modal__item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggleCity(city.id)}
                    title={getCityDisplayName(city)}
                  >
                    <span className="city-modal__checkbox" />
                    <span>{getCityDisplayName(city)}</span>
                  </button>
                )
              })
            ) : (
              <div className="city-modal__empty">Города не найдены</div>
            )}
          </div>
        </div>

        {tempCityIds.length > 0 ? (
          <div className="city-modal__selected">
            Выбрано городов: <strong>{tempCityIds.length}</strong>
          </div>
        ) : null}

        <div className="city-modal__footer">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Отменить
          </button>

          <button type="button" className="btn btn--text" onClick={clearAll}>
            Сбросить
          </button>

          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onApply(tempCityIds)
              onClose()
            }}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  )
}

export const CompaniesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const initialPage = Number(searchParams.get('page') || '1')
  const [page, setPage] = useState(
    Number.isNaN(initialPage) || initialPage < 1 ? 1 : initialPage,
  )

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedLetter, setSelectedLetter] = useState(searchParams.get('letter') || 'Все')
  const [cityIds, setCityIds] = useState<number[]>(parseCityIds(searchParams.get('city_ids')))
  const [hasVacanciesOnly, setHasVacanciesOnly] = useState(
    searchParams.get('has_vacancies_only') === 'true',
  )
  const [cityModalOpen, setCityModalOpen] = useState(false)

  const regionsQuery = useQuery({
    queryKey: ['company-regions'],
    queryFn: fetchRegions,
  })

  const districtsQuery = useQuery({
    queryKey: ['company-districts'],
    queryFn: fetchDistricts,
  })

  const citiesQuery = useQuery({
    queryKey: ['company-cities'],
    queryFn: fetchCities,
  })

  const companiesQuery = useQuery({
    queryKey: ['companies-list', search, cityIds, hasVacanciesOnly],
    queryFn: () =>
      fetchCompanies({
        search: search || undefined,
        city_ids: cityIds.length ? cityIds.join(',') : undefined,
        has_vacancies_only: hasVacanciesOnly || undefined,
        limit: 1000,
        skip: 0,
      }),
  })

  useEffect(() => {
    const params: Record<string, string> = {}

    if (search) params.search = search
    if (cityIds.length) params.city_ids = cityIds.join(',')
    if (hasVacanciesOnly) params.has_vacancies_only = 'true'
    if (selectedLetter && selectedLetter !== 'Все') params.letter = selectedLetter
    if (page > 1) params.page = String(page)

    setSearchParams(params)
  }, [search, cityIds, hasVacanciesOnly, selectedLetter, page, setSearchParams])

  const selectedCityNames = useMemo(() => {
    if (!cityIds.length) return []

    const cities = citiesQuery.data || []
    return cities
      .filter((city) => cityIds.includes(city.id))
      .map((city) => getCityDisplayName(city))
  }, [cityIds, citiesQuery.data])

  const cityTriggerLabel = useMemo(() => {
    if (!selectedCityNames.length) return 'Город'
    if (selectedCityNames.length === 1) return selectedCityNames[0]
    return `${selectedCityNames[0]}, и др.`
  }, [selectedCityNames])

  const availableLetters = useMemo(() => {
    const companies = companiesQuery.data || []
    const set = new Set<string>()

    companies.forEach((company) => {
      set.add(company.first_letter || getFirstLetter(company.name))
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [companiesQuery.data])

  const filteredCompanies = useMemo(() => {
    const companies = (companiesQuery.data || [])
      .map((company) => ({
        ...company,
        first_letter: company.first_letter || getFirstLetter(company.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    if (selectedLetter === 'Все') return companies

    return companies.filter((company) => company.first_letter === selectedLetter)
  }, [companiesQuery.data, selectedLetter])

  const totalCompanies = filteredCompanies.length
  const totalPages = Math.max(1, Math.ceil(totalCompanies / PAGE_SIZE))

  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredCompanies.slice(start, start + PAGE_SIZE)
  }, [filteredCompanies, page])

  const groupedCompaniesByLetter = useMemo(() => {
    return paginatedCompanies.reduce<Record<string, CompanyListItem[]>>((acc, company) => {
      const letter = company.first_letter || '#'
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(company)
      return acc
    }, {})
  }, [paginatedCompanies])

  const visiblePages = useMemo(() => buildVisiblePages(page, totalPages), [page, totalPages])

  useEffect(() => {
    if (page > totalPages) {
      setPage(1)
    }
  }, [page, totalPages])

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const handleLetterClick = (letter: string) => {
    setSelectedLetter(letter)
    setPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="companies-page">
      <Header />

      <main className="companies-page__main">
        <section className="companies-page__hero">
          <div className="container">
            <div className="companies-page__hero-card">
              <div className="companies-page__hero-top">
                <form className="companies-page__search" onSubmit={handleSearchSubmit}>
                  <input
                    type="text"
                    placeholder="Поиск компании"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn--primary">
                    Найти
                  </button>
                </form>
              </div>

              <div className="companies-page__filters-row">
                <button
                  type="button"
                  className="companies-page__city-trigger"
                  onClick={() => setCityModalOpen(true)}
                  title={selectedCityNames.join(', ')}
                >
                  + {cityTriggerLabel}
                </button>

                <label className="companies-page__switch">
                  <span>Только компании с вакансиями</span>
                  <input
                    type="checkbox"
                    checked={hasVacanciesOnly}
                    onChange={(e) => {
                      setHasVacanciesOnly(e.target.checked)
                      setPage(1)
                    }}
                  />
                  <span className="companies-page__switch-slider" />
                </label>
              </div>

              <div className="companies-page__alphabet">
                <button
                  type="button"
                  className={`companies-page__alphabet-link ${selectedLetter === 'Все' ? 'is-active' : ''}`}
                  onClick={() => handleLetterClick('Все')}
                >
                  Все
                </button>

                {EN_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className={`companies-page__alphabet-link ${
                      selectedLetter === letter ? 'is-active' : ''
                    } ${availableLetters.includes(letter) ? '' : 'is-disabled'}`}
                    onClick={() => handleLetterClick(letter)}
                    disabled={!availableLetters.includes(letter)}
                  >
                    {letter}
                  </button>
                ))}

                {RU_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className={`companies-page__alphabet-link ${
                      selectedLetter === letter ? 'is-active' : ''
                    } ${availableLetters.includes(letter) ? '' : 'is-disabled'}`}
                    onClick={() => handleLetterClick(letter)}
                    disabled={!availableLetters.includes(letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="companies-page__catalog">
          <div className="container">
            <div className="companies-page__summary">
              <span>{formatCompactCount(totalCompanies)} компаний</span>
            </div>

            {companiesQuery.isLoading && (
              <div className="companies-page__grid">
                {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <div key={index} className="companies-page__card companies-page__card--skeleton" />
                ))}
              </div>
            )}

            {companiesQuery.isSuccess && totalCompanies === 0 && (
              <div className="companies-page__empty">
                <h3>Компании не найдены</h3>
                <p>Попробуйте изменить поиск или выбранные города.</p>
              </div>
            )}

            {companiesQuery.isSuccess && totalCompanies > 0 && (
              <>
                <div className="companies-page__sections">
                  {Object.entries(groupedCompaniesByLetter)
                    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                    .map(([letter, companies]) => (
                      <div key={letter} className="companies-page__section">
                        <h2 className="companies-page__letter">{letter}</h2>

                        <div className="companies-page__grid">
                          {companies.map((company) => (
                            <a
                              key={company.id}
                              href={`/companies/${company.id}`}
                              className="companies-page__card"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <div className="companies-page__card-head">
                                <div className="companies-page__card-logo">
                                  <CompanyLogo src={company.logo} name={company.name} />
                                </div>

                                <div className="companies-page__card-main">
                                  <h3>{company.name}</h3>

                                  {company.company_type_name && (
                                    <div className="companies-page__card-type">
                                      {company.company_type_name}
                                    </div>
                                  )}

                                  {company.city_names && company.city_names.length > 0 && (
                                    <div
                                      className="companies-page__card-cities"
                                      title={company.city_names.join(', ')}
                                    >
                                      {formatCitiesPreview(company.city_names)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="companies-page__card-footer">
                                {formatVacanciesLabel(company.vacancies_count)}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {totalPages > 1 && (
                  <div className="companies-page__pagination">
                    <button
                      type="button"
                      className="companies-page__pagination-btn"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                    >
                      Назад
                    </button>

                    <div className="companies-page__pagination-pages">
                      {visiblePages.map((item, index) => {
                        if (typeof item !== 'number') {
                          return (
                            <span
                              key={`${item}-${index}`}
                              className="companies-page__pagination-dots"
                            >
                              …
                            </span>
                          )
                        }

                        return (
                          <button
                            key={item}
                            type="button"
                            className={`companies-page__pagination-page ${
                              item === page ? 'is-active' : ''
                            }`}
                            onClick={() => {
                              setPage(item)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      className="companies-page__pagination-btn"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                    >
                      Вперёд
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />

      <CityModal
        open={cityModalOpen}
        regions={regionsQuery.data || []}
        districts={districtsQuery.data || []}
        cities={citiesQuery.data || []}
        selectedCityIds={cityIds}
        onClose={() => setCityModalOpen(false)}
        onApply={(value) => {
          setCityIds(value)
          setPage(1)
        }}
      />
    </div>
  )
}
