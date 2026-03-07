import { HTMLAttributes, useState } from 'react'
import './Avatar.css'

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string
  src?: string
  size?: 'small' | 'medium' | 'large'
  status?: 'online' | 'offline' | 'busy' | 'idle'
  glowColor?: 'cyan' | 'green' | 'magenta' | 'red'
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export function Avatar({
  name,
  src,
  size = 'medium',
  status,
  glowColor = 'cyan',
  className = '',
  ...props
}: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  const classes = [
    'avatar',
    `avatar-${size}`,
    `avatar-${glowColor}`,
    className
  ].filter(Boolean).join(' ')

  const showImage = src && !imgError

  return (
    <div className={classes} {...props}>
      {showImage ? (
        <img
          className="avatar-img"
          src={src}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="avatar-initials">
          {name ? getInitials(name) : '?'}
        </span>
      )}
      {status && (
        <span className={`avatar-status avatar-status-${status}`} />
      )}
    </div>
  )
}
