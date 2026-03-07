import { InputHTMLAttributes, forwardRef } from 'react'
import './Slider.css'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  color?: 'cyan' | 'green' | 'magenta' | 'red'
  size?: 'small' | 'medium' | 'large'
  showValue?: boolean
  label?: string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ color = 'cyan', size = 'medium', showValue = false, label, className = '', ...props }, ref) => {
    const classes = [
      'neon-slider',
      `neon-slider-${color}`,
      `neon-slider-${size}`,
      className
    ].filter(Boolean).join(' ')

    return (
      <div className="neon-slider-wrapper">
        {label && <label className="neon-slider-label">{label}</label>}
        <div className="neon-slider-row">
          <input
            ref={ref}
            type="range"
            className={classes}
            {...props}
          />
          {showValue && (
            <span className="neon-slider-value">
              {props.value ?? props.defaultValue ?? 0}
            </span>
          )}
        </div>
      </div>
    )
  }
)

Slider.displayName = 'Slider'
