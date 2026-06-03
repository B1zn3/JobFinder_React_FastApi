import { useEffect, useMemo, useRef, useState } from 'react'

type Option = {
  value: string
  label: string
}

type FilterSelectProps = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const FilterSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Выберите',
  className = '',
  disabled = false,
}: FilterSelectProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={`filter-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="filter-select__trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={`filter-select__value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="filter-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="filter-select__menu" role="listbox">
          {options.map((option) => {
            const isActive = option.value === value

            return (
              <button
                key={option.value || '__empty__'}
                type="button"
                className={`filter-select__option ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                role="option"
                aria-selected={isActive}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}