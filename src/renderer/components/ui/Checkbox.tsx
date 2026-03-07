import { InputHTMLAttributes, forwardRef } from 'react'
import './Checkbox.css'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'small' | 'medium' | 'large'
  color?: 'cyan' | 'green' | 'magenta'
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  size = 'medium',
  color = 'cyan',
  label,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`

  const classes = [
    'checkbox',
    `checkbox-${size}`,
    `checkbox-${color}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <label className={classes} htmlFor={inputId}>
      <input
        ref={ref}
        type="checkbox"
        id={inputId}
        className="checkbox-input"
        {...props}
      />
      <span className="checkbox-box">
        <svg className="checkbox-icon" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className="checkbox-label">{label}</span>}
    </label>
  )
})

Checkbox.displayName = 'Checkbox'
