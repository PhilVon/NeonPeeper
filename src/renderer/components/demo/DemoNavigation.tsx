import './DemoNavigation.css'

export interface DemoSection {
  id: string
  label: string
  icon?: string
}

export const demoSections: DemoSection[] = [
  { id: 'overview', label: 'Overview', icon: '>' },
  { id: 'buttons', label: 'Buttons', icon: '[]' },
  { id: 'forms', label: 'Form Controls', icon: '#' },
  { id: 'feedback', label: 'Feedback', icon: '!' },
  { id: 'data-display', label: 'Data Display', icon: '@' },
  { id: 'navigation', label: 'Navigation', icon: '~' },
  { id: 'layout', label: 'Layout', icon: '|' },
  { id: 'effects', label: 'Effects', icon: '*' },
  { id: 'tokens', label: 'Design Tokens', icon: '$' },
]

interface DemoNavigationProps {
  activeSection: string
  onSectionChange: (sectionId: string) => void
}

export function DemoNavigation({ activeSection, onSectionChange }: DemoNavigationProps) {
  return (
    <aside className="demo-navigation">
      <div className="demo-navigation-header">
        <span className="demo-navigation-title">Components</span>
      </div>
      <nav className="demo-navigation-list">
        {demoSections.map((section) => (
          <button
            key={section.id}
            className={`demo-navigation-item ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => onSectionChange(section.id)}
          >
            <span className="demo-navigation-icon">{section.icon}</span>
            <span className="demo-navigation-label">{section.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
