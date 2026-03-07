import { HTMLAttributes, useState, ReactNode } from 'react'
import './DataTable.css'

export interface DataTableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => ReactNode
}

interface DataTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'data'> {
  columns: DataTableColumn<T>[]
  data: T[]
  striped?: boolean
  hoverable?: boolean
  glowColor?: 'cyan' | 'green' | 'magenta'
  onRowClick?: (item: T) => void
}

type SortDirection = 'none' | 'asc' | 'desc'

function nextSort(current: SortDirection): SortDirection {
  if (current === 'none') return 'asc'
  if (current === 'asc') return 'desc'
  return 'none'
}

function sortIcon(dir: SortDirection): string {
  if (dir === 'asc') return '▲'
  if (dir === 'desc') return '▼'
  return '⬍'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  striped = false,
  hoverable = true,
  glowColor = 'cyan',
  onRowClick,
  className = '',
  ...props
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('none')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const next = nextSort(sortDir)
      setSortDir(next)
      if (next === 'none') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = (() => {
    if (!sortKey || sortDir === 'none') return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  })()

  const classes = [
    'data-table-wrapper',
    `data-table-${glowColor}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.sortable ? 'data-table-sortable' : ''}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.header}
                {col.sortable && (
                  <span className="data-table-sort-icon">
                    {sortKey === col.key ? sortIcon(sortDir) : sortIcon('none')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table-empty">
                No data available
              </td>
            </tr>
          ) : (
            sortedData.map((item, i) => (
              <tr
                key={i}
                className={[
                  striped && i % 2 === 1 ? 'data-table-striped' : '',
                  hoverable ? 'data-table-hoverable' : '',
                  onRowClick ? 'data-table-clickable' : ''
                ].filter(Boolean).join(' ')}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
