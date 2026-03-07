import { useState } from 'react'
import { Tabs, TabList, Tab, TabPanel } from '../../ui/Tabs'
import { Sidebar } from '../../layout/Sidebar'
import { Breadcrumbs } from '../../ui/Breadcrumbs'
import { NeonCard } from '../../ui/NeonCard'
import { CodePreview } from '../CodePreview'

export function NavigationPage() {
  const [sidebarTab, setSidebarTab] = useState('home')
  const [currentPath, setCurrentPath] = useState(['Home', 'Systems', 'Network', 'Config'])

  const sidebarTabs = [
    { id: 'home', label: 'Home' },
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Settings' },
    { id: 'logout', label: 'Logout' },
  ]

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Navigation</h1>
      <p className="demo-page-subtitle">
        Tab panels, sidebar navigation, and breadcrumbs for organizing content.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Tabs</h2>
        <NeonCard>
          <Tabs defaultTab="tab1">
            <TabList>
              <Tab id="tab1">Terminal</Tab>
              <Tab id="tab2">Network</Tab>
              <Tab id="tab3">System</Tab>
            </TabList>
            <TabPanel id="tab1">
              <p>Terminal interface ready. Type your commands below.</p>
            </TabPanel>
            <TabPanel id="tab2">
              <p>Network status: Connected. Latency: 12ms.</p>
            </TabPanel>
            <TabPanel id="tab3">
              <p>System resources: CPU 23%, Memory 4.2GB used.</p>
            </TabPanel>
          </Tabs>
        </NeonCard>
        <CodePreview
          code={`<Tabs defaultTab="tab1">
  <TabList>
    <Tab id="tab1">Terminal</Tab>
    <Tab id="tab2">Network</Tab>
    <Tab id="tab3">System</Tab>
  </TabList>
  <TabPanel id="tab1">
    <p>Terminal interface ready.</p>
  </TabPanel>
  <TabPanel id="tab2">
    <p>Network status: Connected.</p>
  </TabPanel>
  <TabPanel id="tab3">
    <p>System resources: CPU 23%.</p>
  </TabPanel>
</Tabs>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Sidebar</h2>
        <NeonCard>
          <div style={{ display: 'flex', height: '250px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Sidebar
              tabs={sidebarTabs}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
            />
            <div style={{ flex: 1, padding: 'var(--spacing-md)', background: 'var(--bg-darkest)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Active tab: <strong style={{ color: 'var(--neon-cyan)' }}>{sidebarTab}</strong>
              </p>
              <p style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-sm)' }}>
                The sidebar supports controlled and uncontrolled modes.
              </p>
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`const [activeTab, setActiveTab] = useState('home')

const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

// Controlled mode
<Sidebar
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// Uncontrolled mode (uses internal state)
<Sidebar tabs={tabs} />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Sidebar with Icons</h2>
        <NeonCard>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            Sidebar tabs can include custom icons via the <code>icon</code> property.
          </p>
          <div style={{ display: 'flex', height: '200px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Sidebar
              tabs={[
                { id: 'files', label: 'Files', icon: <span>[]</span> },
                { id: 'search', label: 'Search', icon: <span>?</span> },
                { id: 'git', label: 'Git', icon: <span>*</span> },
              ]}
            />
            <div style={{ flex: 1, padding: 'var(--spacing-md)', background: 'var(--bg-darkest)' }}>
              <p style={{ color: 'var(--text-muted)' }}>Content area</p>
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<Sidebar
  tabs={[
    { id: 'files', label: 'Files', icon: <FilesIcon /> },
    { id: 'search', label: 'Search', icon: <SearchIcon /> },
    { id: 'git', label: 'Git', icon: <GitIcon /> },
  ]}
/>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Breadcrumbs</h2>
        <NeonCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Basic</p>
              <Breadcrumbs
                items={[
                  { label: 'Home' },
                  { label: 'Systems' },
                  { label: 'Network' },
                ]}
              />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Custom separator</p>
              <Breadcrumbs
                items={[
                  { label: 'Root' },
                  { label: 'Users' },
                  { label: 'Profile' },
                ]}
                separator=">"
                glowColor="green"
              />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Interactive</p>
              <Breadcrumbs
                items={currentPath.map((segment, i) => ({
                  label: segment,
                  onClick: i < currentPath.length - 1
                    ? () => setCurrentPath(currentPath.slice(0, i + 1))
                    : undefined,
                }))}
                glowColor="magenta"
              />
              <p style={{ color: 'var(--text-muted)', marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)' }}>
                Click a breadcrumb to navigate. Current depth: {currentPath.length}
              </p>
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<Breadcrumbs
  items={[
    { label: 'Home', onClick: () => navigate('/') },
    { label: 'Systems', onClick: () => navigate('/systems') },
    { label: 'Network' },
  ]}
  separator="/"
  glowColor="cyan"
/>`}
        />
      </section>
    </div>
  )
}
