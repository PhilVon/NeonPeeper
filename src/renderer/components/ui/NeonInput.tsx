import { InputHTMLAttributes, forwardRef } from 'react'
import './NeonInput.css'

interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const inputClasses = [
      'neon-input',
      error ? 'neon-input-error' : '',
      className
    ].filter(Boolean).join(' ')

    return (
      <div className="neon-input-wrapper">
        {label && <label className="neon-input-label">{label}</label>}
        <input ref={ref} className={inputClasses} {...props} />
        {error && <span className="neon-input-error-text">{error}</span>}
      </div>
    )
  }
)

NeonInput.displayName = 'NeonInput'
