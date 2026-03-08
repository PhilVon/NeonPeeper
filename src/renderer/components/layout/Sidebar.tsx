import { useState, useCallback } from 'react'
import './Sidebar.css'

interface SidebarTab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface SidebarProps {
  tabs?: SidebarTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  children?: React.ReactNode
}

const defaultTabs: SidebarTab[] = [
  { id: 'home', label: 'Home' },
  { id: 'settings', label: 'Settings' },
]

export function Sidebar({
  tabs = defaultTabs,
  activeTab: controlledActiveTab,
  onTabChange,
  children
}: SidebarProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id)
  const activeTab = controlledActiveTab ?? internalActiveTab

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId)
    } else {
      setInternalActiveTab(tabId)
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      let nextIndex = -1

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
      } else if (e.key === 'Home') {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        nextIndex = tabs.length - 1
      }

      if (nextIndex >= 0) {
        handleTabClick(tabs[nextIndex].id)
        // Focus the new tab button
        const nav = (e.currentTarget as HTMLElement)
        const buttons = nav.querySelectorAll<HTMLElement>('[role="tab"]')
        buttons[nextIndex]?.focus()
      }
    },
    [tabs, activeTab, handleTabClick]
  )

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav" role="tablist" aria-label="Main navigation" onKeyDown={handleKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
          >
            {tab.icon && <span className="sidebar-tab-icon">{tab.icon}</span>}
            <span className="sidebar-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
      {children && <div className="sidebar-content" role="tabpanel">{children}</div>}
    </aside>
  )
}
