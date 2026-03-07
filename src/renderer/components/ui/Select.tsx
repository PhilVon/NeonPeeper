import { useState, useRef, HTMLAttributes, ReactNode } from 'react'
import { Portal } from '../utils/Portal'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import './Select.css'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SelectOption[]
  value?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (value: string) => void
  label?: ReactNode
  error?: string
}

export function Select({
  options,
  value,
  placeholder = 'Select...',
  disabled = false,
  onChange,
  label,
  error,
  className = '',
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
    setIsOpen(!isOpen)
  }

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue)
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent, optionValue: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSelect(optionValue)
    }
  }

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen)
  useEscapeKey(() => setIsOpen(false), isOpen)

  const classes = [
    'select',
    disabled && 'select-disabled',
    error && 'select-error',
    isOpen && 'select-open',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      {label && <label className="select-label">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'select-value' : 'select-placeholder'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="select-arrow" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {error && <span className="select-error-text">{error}</span>}
      {isOpen && (
        <Portal>
          <div
            ref={dropdownRef}
            className="select-dropdown"
            style={dropdownStyle}
            role="listbox"
          >
            {options.map((option) => (
              <div
                key={option.value}
                className={[
                  'select-option',
                  option.value === value && 'select-option-selected',
                  option.disabled && 'select-option-disabled'
                ].filter(Boolean).join(' ')}
                role="option"
                aria-selected={option.value === value}
                tabIndex={option.disabled ? -1 : 0}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onKeyDown={(e) => !option.disabled && handleKeyDown(e, option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </Portal>
      )}
    </div>
  )
}
