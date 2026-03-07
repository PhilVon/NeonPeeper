import { useState } from 'react'
import { DemoNavigation, demoSections } from './DemoNavigation'
import { OverviewPage } from './pages/OverviewPage'
import { ButtonsPage } from './pages/ButtonsPage'
import { FormsPage } from './pages/FormsPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { DataDisplayPage } from './pages/DataDisplayPage'
import { NavigationPage } from './pages/NavigationPage'
import { LayoutPage } from './pages/LayoutPage'
import { EffectsPage } from './pages/EffectsPage'
import { DesignTokensPage } from './pages/DesignTokensPage'
import { ToastContainer } from '../ui/Toast'
import './DemoSuite.css'

const pageComponents: Record<string, React.ComponentType> = {
  overview: OverviewPage,
  buttons: ButtonsPage,
  forms: FormsPage,
  feedback: FeedbackPage,
  'data-display': DataDisplayPage,
  navigation: NavigationPage,
  layout: LayoutPage,
  effects: EffectsPage,
  tokens: DesignTokensPage,
}

export function DemoSuite() {
  const [activeSection, setActiveSection] = useState(demoSections[0].id)

  const ActivePage = pageComponents[activeSection] || OverviewPage

  return (
    <div className="demo-suite">
      <ToastContainer />
      <DemoNavigation
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <main className="demo-suite-content">
        <ActivePage />
      </main>
    </div>
  )
}
