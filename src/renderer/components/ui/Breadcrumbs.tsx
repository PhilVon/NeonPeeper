import { HTMLAttributes } from 'react'
import './Breadcrumbs.css'

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: string
  glowColor?: 'cyan' | 'green' | 'magenta'
}

export function Breadcrumbs({
  items,
  separator = '/',
  glowColor = 'cyan',
  className = '',
  ...props
}: BreadcrumbsProps) {
  const classes = [
    'breadcrumbs',
    `breadcrumbs-${glowColor}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <nav className={classes} aria-label="Breadcrumb" {...props}>
      <ol className="breadcrumbs-list">
        {items.map((item, i) => {
          const isLast = i === items.length - 1

          return (
            <li key={i} className="breadcrumbs-item">
              {!isLast && item.onClick ? (
                <button
                  className="breadcrumbs-link"
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              ) : (
                <span className={isLast ? 'breadcrumbs-current' : 'breadcrumbs-text'}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="breadcrumbs-separator">{separator}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
