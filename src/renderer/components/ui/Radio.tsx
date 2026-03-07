import { InputHTMLAttributes, forwardRef, ReactNode, createContext, useContext } from 'react'
import './Radio.css'

interface RadioGroupContextValue {
  name?: string
  value?: string
  onChange?: (value: string) => void
}

const RadioGroupContext = createContext<RadioGroupContextValue>({})

interface RadioGroupProps {
  name: string
  value?: string
  onChange?: (value: string) => void
  children: ReactNode
  className?: string
  direction?: 'horizontal' | 'vertical'
}

export function RadioGroup({
  name,
  value,
  onChange,
  children,
  className = '',
  direction = 'vertical'
}: RadioGroupProps) {
  const classes = [
    'radio-group',
    `radio-group-${direction}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange }}>
      <div className={classes} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'small' | 'medium' | 'large'
  color?: 'cyan' | 'green' | 'magenta'
  label?: string
  value: string
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({
  size = 'medium',
  color = 'cyan',
  label,
  value,
  className = '',
  id,
  ...props
}, ref) => {
  const group = useContext(RadioGroupContext)
  const inputId = id || `radio-${Math.random().toString(36).slice(2, 9)}`

  const classes = [
    'radio',
    `radio-${size}`,
    `radio-${color}`,
    className
  ].filter(Boolean).join(' ')

  const isChecked = group.value !== undefined ? group.value === value : props.checked

  const handleChange = () => {
    group.onChange?.(value)
  }

  return (
    <label className={classes} htmlFor={inputId}>
      <input
        ref={ref}
        type="radio"
        id={inputId}
        name={group.name}
        value={value}
        checked={isChecked}
        onChange={handleChange}
        className="radio-input"
        {...props}
      />
      <span className="radio-circle">
        <span className="radio-dot" />
      </span>
      {label && <span className="radio-label">{label}</span>}
    </label>
  )
})

Radio.displayName = 'Radio'
