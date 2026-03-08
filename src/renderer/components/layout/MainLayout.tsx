import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import './MainLayout.css'

interface SidebarProps {
  tabs?: Array<{ id: string; label: string; icon?: React.ReactNode }>
  activeTab?: string
  onTabChange?: (tabId: string) => void
  children?: React.ReactNode
}

interface MainLayoutProps {
  showSidebar?: boolean
  sidebarProps?: SidebarProps
  children: React.ReactNode
}

export function MainLayout({
  showSidebar = true,
  sidebarProps,
  children
}: MainLayoutProps) {
  return (
    <div className="main-layout">
      <TitleBar />
      <div className="main-layout-body">
        {showSidebar && <Sidebar {...sidebarProps} />}
        <main className="main-layout-content">
          {children}
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
