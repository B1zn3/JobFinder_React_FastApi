import type { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Header } from "../../shared/ui/Header";
import { Footer } from "../../shared/ui/Footer";
import { http } from "../../shared/api/http";
import "./create-vacancy.css";

type CatalogItem = {
  id: number;
  name: string;
  full_name?: string | null;
  region_id?: number | null;
  region_name?: string | null;
  district_id?: number | null;
  district_name?: string | null;
  settlement_type_id?: number | null;
  settlement_type_name?: string | null;
};

type ComboOption = {
  value: string | number;
  label: string;
  subtitle?: string;
};

type StepKey = "main" | "description" | "conditions" | "skills" | "preview";

type VacancyPayload = {
  title: string;
  description: string;
  profession_id: number;
  city_id: number;
  employment_type_id: number;
  work_schedule_id: number;
  salary_min: number;
  salary_max: number;
  currency_id: number;
  experience_id: number;
};

type VacancyResponse = {
  id: number;
  title: string;
};

type CompanyProfile = {
  id: number;
  name: string;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  founded_year?: number | null;
  employee_count?: number | null;
};

type ApiValidationItem = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[];
  message?: string;
  error?: string;
};

const STEPS: StepKey[] = [
  "main",
  "description",
  "conditions",
  "skills",
  "preview",
];

const STEP_TITLES: Record<StepKey, string> = {
  main: "Основное",
  description: "Описание",
  conditions: "Условия",
  skills: "Навыки",
  preview: "Предпросмотр",
};

const toArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown[] }).items)
  ) {
    return (value as { items: T[] }).items;
  }

  return [];
};

const safeString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeCatalogItem = (item: Record<string, unknown>): CatalogItem => ({
  id: safeNumber(item.id) ?? 0,
  name: safeString(item.name),
  full_name: safeString(item.full_name) || null,
  region_id: safeNumber(item.region_id),
  region_name: safeString(item.region_name) || null,
  district_id: safeNumber(item.district_id),
  district_name: safeString(item.district_name) || null,
  settlement_type_id: safeNumber(item.settlement_type_id),
  settlement_type_name: safeString(item.settlement_type_name) || null,
});

const getCityDisplayName = (city: CatalogItem) => {
  if (city.full_name?.trim()) return city.full_name.trim();

  const cityName = [city.settlement_type_name, city.name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return [cityName || city.name, city.district_name, city.region_name]
    .filter((item) => item && item.trim())
    .join(", ");
};

const getCityOptionSubtitle = (city: CatalogItem) => {
  return [city.district_name, city.region_name]
    .filter((item) => item && item.trim())
    .join(" • ");
};

const getCitySearchText = (city: CatalogItem) => {
  return [
    city.name,
    city.full_name,
    city.district_name,
    city.region_name,
    city.settlement_type_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const fetchCatalog = async (catalogName: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit: catalogName === "cities" ? 100 : 200 },
  });

  return toArray<Record<string, unknown>>(data)
    .map(normalizeCatalogItem)
    .filter((item) => item.id && item.name);
};

const fetchProfessions = async (): Promise<CatalogItem[]> => {
  const { data } = await http.get("/public/professions", {
    params: { skip: 0, limit: 100 },
  });

  return toArray<CatalogItem>(data);
};

const fetchCompanyProfile = async (): Promise<CompanyProfile | null> => {
  const { data } = await http.get("/companies/me");
  return data || null;
};

const createVacancy = async (
  payload: VacancyPayload,
): Promise<VacancyResponse> => {
  const { data } = await http.post("/companies/me/vacancies", payload);
  return data;
};

const addSkillToVacancy = async (vacancyId: number, skillName: string) => {
  const { data } = await http.post(
    `/companies/me/vacancies/${vacancyId}/skills`,
    {
      name: skillName,
    },
  );

  return data;
};

const uniqueMessages = (messages: string[]) =>
  Array.from(new Set(messages.filter(Boolean)));

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase();

  if (lower.includes("profession") || lower.includes("професс")) {
    return "Выберите профессию из списка.";
  }

  if (lower.includes("city") || lower.includes("город")) {
    return "Выберите город из списка.";
  }

  if (lower.includes("skill") || lower.includes("навык")) {
    return "Добавьте хотя бы один навык.";
  }

  if (lower.includes("employment") || lower.includes("занятост")) {
    return "Выберите тип занятости.";
  }

  if (lower.includes("schedule") || lower.includes("график")) {
    return "Выберите график работы.";
  }

  if (lower.includes("currency") || lower.includes("валют")) {
    return "Выберите валюту.";
  }

  if (lower.includes("experience") || lower.includes("опыт")) {
    return "Выберите требуемый опыт.";
  }

  if (lower.includes("salary") || lower.includes("зарплат")) {
    return "Проверьте зарплатную вилку.";
  }

  if (lower.includes("field required")) {
    return "Заполните обязательные поля.";
  }

  if (lower.includes("not authenticated") || lower.includes("unauthorized")) {
    return "Сессия истекла. Войдите в аккаунт заново.";
  }

  if (lower.includes("forbidden") || lower.includes("доступ запрещ")) {
    return "Недостаточно прав для выполнения действия.";
  }

  if (status === 400) return message || "Некорректные данные.";
  if (status === 401) return "Сессия истекла. Войдите в аккаунт заново.";
  if (status === 403) return "Недостаточно прав для выполнения действия.";
  if (status === 404) return "Данные не найдены.";
  if (status === 409) return message || "Такие данные уже используются.";
  if (status === 422)
    return message || "Проверьте корректность введённых данных.";
  if (status === 429) return "Слишком много попыток. Попробуйте позже.";
  if (status && status >= 500) return "Ошибка сервера. Попробуйте позже.";

  if (message.length > 220) {
    return "Не удалось сохранить вакансию. Проверьте форму и попробуйте снова.";
  }

  return message || "Не удалось сохранить вакансию.";
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  const status = axiosError.response?.status;
  const data = axiosError.response?.data;

  if (!axiosError.response) {
    return "Нет соединения с сервером. Проверьте интернет или попробуйте позже.";
  }

  if (Array.isArray(data?.detail)) {
    const messages = uniqueMessages(
      data.detail.map((item) =>
        translateApiErrorMessage(item.msg || "", status),
      ),
    );

    return messages[0] || fallback;
  }

  if (typeof data?.detail === "string") {
    return translateApiErrorMessage(data.detail, status);
  }

  if (
    data?.detail &&
    typeof data.detail === "object" &&
    !Array.isArray(data.detail)
  ) {
    const message = data.detail.message || data.detail.error;
    if (message) return translateApiErrorMessage(message, status);
  }

  if (data?.message) return translateApiErrorMessage(data.message, status);
  if (data?.error) return translateApiErrorMessage(data.error, status);

  switch (status) {
    case 400:
      return "Некорректные данные. Проверьте форму.";
    case 401:
      return "Сессия истекла. Войдите в аккаунт заново.";
    case 403:
      return "Недостаточно прав для выполнения действия.";
    case 404:
      return "Данные не найдены.";
    case 409:
      return "Такие данные уже используются.";
    case 422:
      return "Проверьте корректность введённых данных.";
    case 429:
      return "Слишком много попыток. Попробуйте позже.";
    default:
      return status && status >= 500
        ? "Ошибка сервера. Попробуйте позже."
        : fallback;
  }
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const validateVacancyTitle = (value: string) => {
  const title = normalizeText(value);

  if (!title) return "Укажите название вакансии.";
  if (title.length < 3) return "Название вакансии слишком короткое.";
  if (title.length > 120)
    return "Название вакансии должно быть не длиннее 120 символов.";

  const allowedPattern = /^[A-Za-zА-Яа-яЁё0-9\s.,:;!?()/#&+\-№"«»]+$/;

  if (!allowedPattern.test(title)) {
    return "Название содержит недопустимые символы.";
  }

  const lettersCount = title.match(/[A-Za-zА-Яа-яЁё]/g)?.length || 0;
  const digitsCount = title.match(/\d/g)?.length || 0;

  if (lettersCount < 3) {
    return "Название должно содержать минимум 3 буквы.";
  }

  if (digitsCount > lettersCount) {
    return "Название вакансии не должно состоять преимущественно из цифр.";
  }

  if (/(.)\1{5,}/i.test(title)) {
    return "Название выглядит некорректно.";
  }

  return "";
};

const parseSalary = (value: string) => {
  const normalized = value.trim();

  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed <= 0) return null;

  return parsed;
};

const formatSalary = (
  salaryMin: string,
  salaryMax: string,
  currencyName: string,
  salaryHidden: boolean,
) => {
  if (salaryHidden) return "Зарплата не указана";

  const min = parseSalary(salaryMin);
  const max = parseSalary(salaryMax);

  if (!min || !max) return "Зарплата не указана";

  if (min === max) {
    return `${min.toLocaleString("ru-RU")} ${currencyName}`.trim();
  }

  return `${min.toLocaleString("ru-RU")} — ${max.toLocaleString("ru-RU")} ${currencyName}`.trim();
};

const getCompanyInitial = (companyName?: string | null) => {
  return companyName?.trim()?.[0]?.toUpperCase() || "К";
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`vacancy-combo-field__chevron ${open ? "is-open" : ""}`}
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
);

type SearchComboProps = {
  value: string;
  placeholder: string;
  isOpen: boolean;
  options: ComboOption[];
  activeValue?: string | number | null;
  emptyText?: string;
  onFocus: () => void;
  onChange: (value: string) => void;
  onSelect: (option: ComboOption) => void;
};

const SearchCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = "Ничего не найдено",
  onFocus,
  onChange,
  onSelect,
}: SearchComboProps) => {
  return (
    <div className={`vacancy-combo ${isOpen ? "is-open" : ""}`}>
      <input
        className={`vacancy-combo-input ${isOpen ? "is-open" : ""}`}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />

      {isOpen && (
        <div className="vacancy-combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`vacancy-combo__option ${
                  String(activeValue) === String(option.value)
                    ? "is-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
              >
                <span className="vacancy-combo__option-main">
                  {option.label}
                </span>
                {option.subtitle ? (
                  <span className="vacancy-combo__option-subtitle">
                    {option.subtitle}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="vacancy-combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
};

type SelectComboProps = {
  value: string;
  placeholder: string;
  isOpen: boolean;
  options: ComboOption[];
  activeValue?: string | number | null;
  emptyText?: string;
  onToggle: () => void;
  onSelect: (option: ComboOption) => void;
};

const SelectCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = "Нет вариантов",
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`vacancy-combo ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className={`vacancy-combo-field ${isOpen ? "is-open" : ""}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span
          className={
            value
              ? "vacancy-combo-field__value"
              : "vacancy-combo-field__placeholder"
          }
        >
          {value || placeholder}
        </span>

        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="vacancy-combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`vacancy-combo__option ${
                  String(activeValue) === String(option.value)
                    ? "is-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(option)}
              >
                <span className="vacancy-combo__option-main">
                  {option.label}
                </span>
                {option.subtitle ? (
                  <span className="vacancy-combo__option-subtitle">
                    {option.subtitle}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="vacancy-combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
};

export const CreateVacancyPage = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [openCombo, setOpenCombo] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [professionSearch, setProfessionSearch] = useState("");
  const [professionId, setProfessionId] = useState<number | null>(null);
  const [professionName, setProfessionName] = useState("");

  const [citySearch, setCitySearch] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");

  const [employmentTypeId, setEmploymentTypeId] = useState<number | null>(null);
  const [employmentTypeName, setEmploymentTypeName] = useState("");

  const [workScheduleId, setWorkScheduleId] = useState<number | null>(null);
  const [workScheduleName, setWorkScheduleName] = useState("");

  const [experienceId, setExperienceId] = useState<number | null>(null);
  const [experienceName, setExperienceName] = useState("");

  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [currencyName, setCurrencyName] = useState("");

  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryHidden, setSalaryHidden] = useState(false);

  const [skillSearch, setSkillSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<CatalogItem[]>([]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (!target.closest(".vacancy-combo")) {
        setOpenCombo(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const companyQuery = useQuery({
    queryKey: ["company-profile", "vacancy-create"],
    queryFn: fetchCompanyProfile,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const professionsQuery = useQuery({
    queryKey: ["vacancy-create-professions"],
    queryFn: fetchProfessions,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const citiesQuery = useQuery({
    queryKey: ["vacancy-create-cities"],
    queryFn: () => fetchCatalog("cities"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const employmentTypesQuery = useQuery({
    queryKey: ["vacancy-create-employment-types"],
    queryFn: () => fetchCatalog("employment-types"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const workSchedulesQuery = useQuery({
    queryKey: ["vacancy-create-work-schedules"],
    queryFn: () => fetchCatalog("work-schedules"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const currenciesQuery = useQuery({
    queryKey: ["vacancy-create-currencies"],
    queryFn: () => fetchCatalog("currencies"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const experiencesQuery = useQuery({
    queryKey: ["vacancy-create-experiences"],
    queryFn: () => fetchCatalog("experiences"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const skillsQuery = useQuery({
    queryKey: ["vacancy-create-skills"],
    queryFn: () => fetchCatalog("skills"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createVacancyMutation = useMutation({
    mutationFn: createVacancy,
  });

  const professions = professionsQuery.data || [];
  const cities = citiesQuery.data || [];
  const employmentTypes = employmentTypesQuery.data || [];
  const workSchedules = workSchedulesQuery.data || [];
  const currencies = currenciesQuery.data || [];
  const experiences = experiencesQuery.data || [];
  const skills = skillsQuery.data || [];
  const company = companyQuery.data;

  const filteredProfessions: ComboOption[] = useMemo(() => {
    const value = professionSearch.trim().toLowerCase();
    const base = value
      ? professions.filter((item) => item.name.toLowerCase().includes(value))
      : professions;

    return base.slice(0, 30).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [professionSearch, professions]);

  const filteredCities: ComboOption[] = useMemo(() => {
    const value = citySearch.trim().toLowerCase();
    const base = value
      ? cities.filter((item) => getCitySearchText(item).includes(value))
      : cities;

    return base.slice(0, 40).map((item) => ({
      value: item.id,
      label: getCityDisplayName(item),
      subtitle: getCityOptionSubtitle(item),
    }));
  }, [citySearch, cities]);

  const filteredSkills: ComboOption[] = useMemo(() => {
    const value = skillSearch.trim().toLowerCase();
    const selectedIds = new Set(selectedSkills.map((item) => item.id));

    const base = value
      ? skills.filter((item) => item.name.toLowerCase().includes(value))
      : skills;

    return base
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 30)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }));
  }, [skillSearch, skills, selectedSkills]);

  const employmentTypeOptions: ComboOption[] = useMemo(() => {
    return employmentTypes.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [employmentTypes]);

  const workScheduleOptions: ComboOption[] = useMemo(() => {
    return workSchedules.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [workSchedules]);

  const currencyOptions: ComboOption[] = useMemo(() => {
    return currencies.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [currencies]);

  const experienceOptions: ComboOption[] = useMemo(() => {
    return experiences.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  }, [experiences]);

  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100);
  const currentStepKey = STEPS[currentStep];
  const isSaving = createVacancyMutation.isPending;

  const addSkill = (skillId: number) => {
    const skill = skills.find((item) => item.id === skillId);

    if (!skill) return;

    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev;
      return [...prev, skill];
    });

    setSkillSearch("");
    setOpenCombo(null);
    setSaveError("");
  };

  const removeSkill = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId));
  };

  const validateMainStep = () => {
    const titleError = validateVacancyTitle(title);

    if (titleError) return titleError;
    if (!professionId || !professionName.trim())
      return "Выберите профессию из списка.";
    if (!cityId || !cityName.trim()) return "Выберите город из списка.";

    return "";
  };

  const validateDescriptionStep = () => {
    const normalizedDescription = description.trim();

    if (!normalizedDescription) return "Добавьте описание вакансии.";

    if (normalizedDescription.length < 40) {
      return "Описание слишком короткое. Добавьте задачи, требования и условия.";
    }

    if (normalizedDescription.length > 5000) {
      return "Описание должно быть не длиннее 5000 символов.";
    }

    return "";
  };

  const validateConditionsStep = () => {
    if (!employmentTypeId) return "Выберите тип занятости.";
    if (!workScheduleId) return "Выберите график работы.";
    if (!experienceId) return "Выберите требуемый опыт.";
    if (!currencyId) return "Выберите валюту.";

    if (salaryHidden) return "";

    const min = parseSalary(salaryMin);
    const max = parseSalary(salaryMax);

    if (!min)
      return "Укажите зарплату от или отметьте “Не указывать зарплату”.";
    if (!max)
      return "Укажите зарплату до или отметьте “Не указывать зарплату”.";

    if (min > max) {
      return "Зарплата “до” не может быть меньше зарплаты “от”.";
    }

    if (max > 1_000_000_000) {
      return "Зарплата выглядит нереалистично. Проверьте значение.";
    }

    return "";
  };

  const validateSkillsStep = () => {
    if (selectedSkills.length === 0) {
      return "Добавьте хотя бы один ключевой навык.";
    }

    return "";
  };

  const validateStep = (step: StepKey) => {
    if (step === "main") return validateMainStep();
    if (step === "description") return validateDescriptionStep();
    if (step === "conditions") return validateConditionsStep();
    if (step === "skills") return validateSkillsStep();

    return (
      validateMainStep() ||
      validateDescriptionStep() ||
      validateConditionsStep() ||
      validateSkillsStep()
    );
  };

  const validateAllSteps = () => {
    for (const step of STEPS) {
      const error = validateStep(step);

      if (error) return error;
    }

    return "";
  };

  const createVacancyRequest = async () => {
    const error = validateAllSteps();

    if (error) {
      setSaveError(error);
      return;
    }

    if (
      !professionId ||
      !cityId ||
      !employmentTypeId ||
      !workScheduleId ||
      !currencyId ||
      !experienceId
    ) {
      setSaveError("Проверьте обязательные поля.");
      return;
    }

    const min = salaryHidden ? 0 : parseSalary(salaryMin);
    const max = salaryHidden ? 0 : parseSalary(salaryMax);

    if (min === null || max === null) {
      setSaveError("Проверьте зарплатную вилку.");
      return;
    }

    setSaveError("");
    setSaveSuccess("");

    try {
      const createdVacancy = await createVacancyMutation.mutateAsync({
        title: normalizeText(title),
        description: description.trim(),
        profession_id: professionId,
        city_id: cityId,
        employment_type_id: employmentTypeId,
        work_schedule_id: workScheduleId,
        salary_min: min,
        salary_max: max,
        currency_id: currencyId,
        experience_id: experienceId,
      });

      await Promise.all(
        selectedSkills.map((skill) =>
          addSkillToVacancy(createdVacancy.id, skill.name),
        ),
      );

      setSaveSuccess("Вакансия успешно создана.");
      navigate(`/vacancies/${createdVacancy.id}`);
    } catch (requestError) {
      setSaveError(
        getApiErrorMessage(
          requestError,
          "Не удалось создать вакансию. Проверьте данные и попробуйте снова.",
        ),
      );
    }
  };

  const goBack = () => {
    if (currentStep === 0) {
      navigate("/employer/vacancies");
      return;
    }

    setSaveError("");
    setSaveSuccess("");
    setCurrentStep((prev) => prev - 1);
  };

  const goNext = async () => {
    setSaveError("");
    setSaveSuccess("");

    const error = validateStep(currentStepKey);

    if (error) {
      setSaveError(error);
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    await createVacancyRequest();
  };

  return (
    <div className="create-vacancy-page">
      <Header />

      <main className="create-vacancy-page__main">
        <div className="container create-vacancy-page__container">
          <section className="create-vacancy-card">
            <div className="create-vacancy-card__top">
              <div>
                <div className="create-vacancy-card__progress-label">
                  Шаг {currentStep + 1} из {STEPS.length} · {progressPercent}%
                </div>

                <div className="create-vacancy-card__step-name">
                  {STEP_TITLES[currentStepKey]}
                </div>
              </div>

              <button
                type="button"
                className="create-vacancy-card__cancel"
                onClick={() => navigate("/employer/vacancies")}
              >
                Выйти
              </button>
            </div>

            {companyQuery.isError ||
            professionsQuery.isError ||
            citiesQuery.isError ||
            employmentTypesQuery.isError ||
            workSchedulesQuery.isError ||
            currenciesQuery.isError ||
            experiencesQuery.isError ||
            skillsQuery.isError ? (
              <div className="vacancy-form-error">
                Не удалось загрузить часть данных. Обновите страницу.
              </div>
            ) : null}

            {currentStepKey === "main" && (
              <>
                <h1 className="create-vacancy-card__title">Основные данные</h1>

                <p className="create-vacancy-card__subtitle">
                  Укажите название вакансии, профессию и населённый пункт. Все
                  три поля обязательны.
                </p>

                <label className="vacancy-field">
                  <span>Название вакансии</span>

                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Например: Frontend-разработчик"
                    maxLength={120}
                  />
                </label>

                <div className="vacancy-form-grid vacancy-form-grid--two">
                  <label className="vacancy-field">
                    <span>Профессия</span>

                    <SearchCombo
                      value={professionSearch}
                      placeholder="Начните вводить профессию"
                      isOpen={openCombo === "profession"}
                      options={filteredProfessions}
                      activeValue={professionId}
                      emptyText={
                        professionsQuery.isLoading
                          ? "Загружаем профессии..."
                          : "Профессия не найдена"
                      }
                      onFocus={() => setOpenCombo("profession")}
                      onChange={(value) => {
                        setProfessionSearch(value);
                        setProfessionId(null);
                        setProfessionName("");
                        setOpenCombo("profession");
                      }}
                      onSelect={(option) => {
                        setProfessionId(Number(option.value));
                        setProfessionName(option.label);
                        setProfessionSearch(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>

                  <label className="vacancy-field">
                    <span>Населённый пункт</span>

                    <SearchCombo
                      value={citySearch}
                      placeholder="Город, район или область"
                      isOpen={openCombo === "city"}
                      options={filteredCities}
                      activeValue={cityId}
                      emptyText={
                        citiesQuery.isLoading
                          ? "Загружаем города..."
                          : "Город не найден"
                      }
                      onFocus={() => setOpenCombo("city")}
                      onChange={(value) => {
                        setCitySearch(value);
                        setCityId(null);
                        setCityName("");
                        setOpenCombo("city");
                      }}
                      onSelect={(option) => {
                        setCityId(Number(option.value));
                        setCityName(option.label);
                        setCitySearch(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>
                </div>
              </>
            )}

            {currentStepKey === "description" && (
              <>
                <h1 className="create-vacancy-card__title">
                  Описание вакансии
                </h1>

                <p className="create-vacancy-card__subtitle">
                  Опишите задачи, требования и условия. Минимум 40 символов.
                </p>

                <label className="vacancy-field">
                  <span>Описание</span>

                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Расскажите, чем будет заниматься кандидат, какие навыки нужны и что предлагает компания."
                    maxLength={5000}
                  />
                </label>

                <div className="vacancy-counter">
                  {description.trim().length}/5000 символов
                </div>
              </>
            )}

            {currentStepKey === "conditions" && (
              <>
                <h1 className="create-vacancy-card__title">Условия работы</h1>

                <p className="create-vacancy-card__subtitle">
                  Заполните формат работы, график, опыт и зарплату. Если
                  зарплату показывать не нужно, отметьте чекбокс.
                </p>

                <div className="vacancy-form-grid vacancy-form-grid--two">
                  <label className="vacancy-field">
                    <span>Тип занятости</span>

                    <SelectCombo
                      value={employmentTypeName}
                      placeholder="Выберите тип"
                      isOpen={openCombo === "employmentType"}
                      options={employmentTypeOptions}
                      activeValue={employmentTypeId}
                      emptyText={
                        employmentTypesQuery.isLoading
                          ? "Загружаем типы занятости..."
                          : "Нет вариантов"
                      }
                      onToggle={() =>
                        setOpenCombo((prev) =>
                          prev === "employmentType" ? null : "employmentType",
                        )
                      }
                      onSelect={(option) => {
                        setEmploymentTypeId(Number(option.value));
                        setEmploymentTypeName(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>

                  <label className="vacancy-field">
                    <span>График работы</span>

                    <SelectCombo
                      value={workScheduleName}
                      placeholder="Выберите график"
                      isOpen={openCombo === "workSchedule"}
                      options={workScheduleOptions}
                      activeValue={workScheduleId}
                      emptyText={
                        workSchedulesQuery.isLoading
                          ? "Загружаем графики..."
                          : "Нет вариантов"
                      }
                      onToggle={() =>
                        setOpenCombo((prev) =>
                          prev === "workSchedule" ? null : "workSchedule",
                        )
                      }
                      onSelect={(option) => {
                        setWorkScheduleId(Number(option.value));
                        setWorkScheduleName(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>

                  <label className="vacancy-field">
                    <span>Опыт</span>

                    <SelectCombo
                      value={experienceName}
                      placeholder="Выберите опыт"
                      isOpen={openCombo === "experience"}
                      options={experienceOptions}
                      activeValue={experienceId}
                      emptyText={
                        experiencesQuery.isLoading
                          ? "Загружаем опыт..."
                          : "Нет вариантов"
                      }
                      onToggle={() =>
                        setOpenCombo((prev) =>
                          prev === "experience" ? null : "experience",
                        )
                      }
                      onSelect={(option) => {
                        setExperienceId(Number(option.value));
                        setExperienceName(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>

                  <label className="vacancy-field">
                    <span>Валюта</span>

                    <SelectCombo
                      value={currencyName}
                      placeholder="Выберите валюту"
                      isOpen={openCombo === "currency"}
                      options={currencyOptions}
                      activeValue={currencyId}
                      emptyText={
                        currenciesQuery.isLoading
                          ? "Загружаем валюты..."
                          : "Нет вариантов"
                      }
                      onToggle={() =>
                        setOpenCombo((prev) =>
                          prev === "currency" ? null : "currency",
                        )
                      }
                      onSelect={(option) => {
                        setCurrencyId(Number(option.value));
                        setCurrencyName(option.label);
                        setOpenCombo(null);
                        setSaveError("");
                      }}
                    />
                  </label>
                </div>

                <div className="vacancy-form-grid vacancy-form-grid--two">
                  <label className="vacancy-field">
                    <span>Зарплата от</span>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={salaryMin}
                      disabled={salaryHidden}
                      onChange={(event) => {
                        setSalaryMin(event.target.value.replace(/\D/g, ""));
                      }}
                      placeholder="Например: 1500"
                    />
                  </label>

                  <label className="vacancy-field">
                    <span>Зарплата до</span>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={salaryMax}
                      disabled={salaryHidden}
                      onChange={(event) => {
                        setSalaryMax(event.target.value.replace(/\D/g, ""));
                      }}
                      placeholder="Например: 2500"
                    />
                  </label>
                  <label className="vacancy-checkbox">
                    <input
                      type="checkbox"
                      checked={salaryHidden}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSalaryHidden(checked);

                        if (checked) {
                          setSalaryMin("");
                          setSalaryMax("");
                        }

                        setSaveError("");
                      }}
                    />

                    <span>Не указывать зарплату</span>
                  </label>
                </div>
              </>
            )}

            {currentStepKey === "skills" && (
              <>
                <h1 className="create-vacancy-card__title">Ключевые навыки</h1>

                <p className="create-vacancy-card__subtitle">
                  Добавьте навыки, которые будут показаны в карточке вакансии.
                  Минимум один навык обязателен.
                </p>

                <label className="vacancy-field">
                  <span>Навыки</span>

                  <SearchCombo
                    value={skillSearch}
                    placeholder="Например: React"
                    isOpen={openCombo === "skills"}
                    options={filteredSkills}
                    emptyText={
                      skillsQuery.isLoading
                        ? "Загружаем навыки..."
                        : "Навык не найден"
                    }
                    onFocus={() => setOpenCombo("skills")}
                    onChange={(value) => {
                      setSkillSearch(value);
                      setOpenCombo("skills");
                    }}
                    onSelect={(option) => addSkill(Number(option.value))}
                  />
                </label>

                {selectedSkills.length > 0 ? (
                  <div className="vacancy-selected-skills">
                    {selectedSkills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        className="vacancy-skill-chip vacancy-skill-chip--selected"
                        onClick={() => removeSkill(skill.id)}
                      >
                        {skill.name} ×
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="vacancy-skill-block">
                  <span>Рекомендованные навыки</span>

                  <div className="vacancy-skill-list">
                    {filteredSkills.slice(0, 18).map((skill) => (
                      <button
                        key={String(skill.value)}
                        type="button"
                        className="vacancy-skill-chip"
                        onClick={() => addSkill(Number(skill.value))}
                      >
                        {skill.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {currentStepKey === "preview" && (
              <>
                <h1 className="create-vacancy-card__title">Предпросмотр</h1>

                <p className="create-vacancy-card__subtitle">
                  Так вакансия будет выглядеть для кандидата.
                </p>

                <section className="vacancy-preview-hero">
                  <div className="vacancy-preview-hero__content">
                    <div className="vacancy-preview-hero__breadcrumbs">
                      Вакансии <span>•</span> {professionName}
                    </div>

                    <h2>{normalizeText(title)}</h2>

                    <div className="vacancy-preview-hero__company">
                      {company?.name || "Ваша компания"}
                    </div>

                    <div className="vacancy-preview-hero__city">{cityName}</div>

                    <div className="vacancy-preview-hero__tags">
                      <span>{professionName}</span>
                      <span>{employmentTypeName}</span>
                      <span>{workScheduleName}</span>
                      <span>{experienceName}</span>
                    </div>

                    <button
                      type="button"
                      className="vacancy-preview-hero__apply"
                      disabled
                    >
                      Откликнуться
                    </button>
                  </div>

                  <div className="vacancy-preview-hero__salary">
                    {formatSalary(
                      salaryMin,
                      salaryMax,
                      currencyName,
                      salaryHidden,
                    )}
                  </div>
                </section>

                <div className="vacancy-preview-layout">
                  <div className="vacancy-preview-layout__main">
                    <section className="vacancy-preview-section">
                      <h3>Описание вакансии</h3>
                      <p>{description.trim()}</p>
                    </section>

                    <section className="vacancy-preview-section">
                      <h3>Ключевые навыки</h3>

                      <div className="vacancy-preview-skills">
                        {selectedSkills.map((skill) => (
                          <span key={skill.id}>{skill.name}</span>
                        ))}
                      </div>
                    </section>
                  </div>

                  <aside className="vacancy-preview-company-card">
                    <div className="vacancy-preview-company-card__head">
                      {company?.logo ? (
                        <img src={company.logo} alt={company.name} />
                      ) : (
                        <div>{getCompanyInitial(company?.name)}</div>
                      )}

                      <div>
                        <h3>{company?.name || "Ваша компания"}</h3>
                        <p>Информация о компании</p>
                      </div>
                    </div>

                    {company?.description ? <p>{company.description}</p> : null}

                    {company?.founded_year ? (
                      <div className="vacancy-preview-company-card__row">
                        <span>Год основания</span>
                        <strong>{company.founded_year}</strong>
                      </div>
                    ) : null}

                    {company?.employee_count ? (
                      <div className="vacancy-preview-company-card__row">
                        <span>Сотрудников</span>
                        <strong>{company.employee_count}</strong>
                      </div>
                    ) : null}

                    {company?.website ? (
                      <div className="vacancy-preview-company-card__row">
                        <span>Сайт</span>
                        <strong>Перейти</strong>
                      </div>
                    ) : null}
                  </aside>
                </div>
              </>
            )}

            {saveError ? (
              <div className="vacancy-form-error">{saveError}</div>
            ) : null}
            {saveSuccess ? (
              <div className="vacancy-form-success">{saveSuccess}</div>
            ) : null}
          </section>
        </div>
      </main>

      <div className="vacancy-stepper-footer">
        <div className="vacancy-stepper-footer__inner">
          <div className="vacancy-stepper-footer__progress">
            {STEPS.map((step, index) => (
              <span
                key={step}
                className={index <= currentStep ? "is-active" : ""}
                title={STEP_TITLES[step]}
              />
            ))}
          </div>

          <div className="vacancy-stepper-footer__actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={goBack}
              disabled={isSaving}
            >
              Назад
            </button>

            <button
              type="button"
              className="btn btn--primary"
              onClick={goNext}
              disabled={isSaving}
            >
              {isSaving
                ? "Сохраняем..."
                : currentStep === STEPS.length - 1
                  ? "Создать вакансию"
                  : currentStep === STEPS.length - 2
                    ? "Предпросмотр"
                    : "Продолжить"}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};
