import { InputHTMLAttributes, forwardRef } from 'react'
import './Toggle.css'

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'small' | 'medium' | 'large'
  color?: 'cyan' | 'green' | 'magenta'
  label?: string
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(({
  size = 'medium',
  color = 'cyan',
  label,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `toggle-${Math.random().toString(36).slice(2, 9)}`

  const classes = [
    'toggle',
    `toggle-${size}`,
    `toggle-${color}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <label className={classes} htmlFor={inputId}>
      <input
        ref={ref}
        type="checkbox"
        id={inputId}
        className="toggle-input"
        {...props}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
})

Toggle.displayName = 'Toggle'
