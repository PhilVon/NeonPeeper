import { ButtonHTMLAttributes } from 'react'
import './NeonButton.css'

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  glow?: boolean
}

export function NeonButton({
  variant = 'primary',
  size = 'medium',
  glow = true,
  className = '',
  children,
  ...props
}: NeonButtonProps) {
  const classes = [
    'neon-button',
    `neon-button-${variant}`,
    `neon-button-${size}`,
    glow ? 'neon-button-glow' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
