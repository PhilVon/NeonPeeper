import { useState } from 'react'
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

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon && <span className="sidebar-tab-icon">{tab.icon}</span>}
            <span className="sidebar-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
      {children && <div className="sidebar-content">{children}</div>}
    </aside>
  )
}
