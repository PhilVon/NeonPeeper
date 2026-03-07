import { useState, ReactNode, createContext, useContext } from 'react'
import './Tabs.css'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (id: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps {
  defaultTab?: string
  activeTab?: string
  onTabChange?: (tabId: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
  children,
  className = ''
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || '')
  const activeTab = controlledActiveTab ?? internalActiveTab

  const setActiveTab = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId)
    } else {
      setInternalActiveTab(tabId)
    }
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`tabs ${className}`.trim()}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabListProps {
  children: ReactNode
  className?: string
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div className={`tab-list ${className}`.trim()} role="tablist">
      {children}
    </div>
  )
}

interface TabProps {
  id: string
  children: ReactNode
  disabled?: boolean
  className?: string
}

export function Tab({ id, children, disabled = false, className = '' }: TabProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tab must be used within Tabs')

  const { activeTab, setActiveTab } = context
  const isActive = activeTab === id

  const classes = [
    'tab',
    isActive && 'tab-active',
    disabled && 'tab-disabled',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={classes}
      onClick={() => !disabled && setActiveTab(id)}
    >
      {children}
    </button>
  )
}

interface TabPanelProps {
  id: string
  children: ReactNode
  className?: string
}

export function TabPanel({ id, children, className = '' }: TabPanelProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabPanel must be used within Tabs')

  const { activeTab } = context
  const isActive = activeTab === id

  if (!isActive) return null

  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={id}
      className={`tab-panel ${className}`.trim()}
    >
      {children}
    </div>
  )
}
