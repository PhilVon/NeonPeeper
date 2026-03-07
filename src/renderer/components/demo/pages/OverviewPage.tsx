import { NeonButton } from '../../ui/NeonButton'
import { NeonCard } from '../../ui/NeonCard'
import { useUIStore } from '../../../store/ui-store'

export function OverviewPage() {
  const { crtEnabled, toggleCRT } = useUIStore()

  return (
    <div className="demo-page">
      <h1 className="demo-page-title glitch-hover">Neon Template</h1>
      <p className="demo-page-subtitle">
        A cyberpunk/90s hacker aesthetic component library for Electron + React applications.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">CRT Effect</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          Toggle the retro CRT monitor effect with scanlines and vignette.
        </p>
        <NeonButton onClick={toggleCRT} glow>
          {crtEnabled ? 'Disable CRT Effect' : 'Enable CRT Effect'}
        </NeonButton>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Component Categories</h2>
        <div className="demo-grid">
          <NeonCard title="Buttons" glow glowColor="cyan">
            <p>Primary, secondary, and danger variants with glow effects and multiple sizes.</p>
          </NeonCard>
          <NeonCard title="Form Controls" glow glowColor="green">
            <p>Inputs, text areas, toggles, checkboxes, radio buttons, select dropdowns, and sliders.</p>
          </NeonCard>
          <NeonCard title="Feedback" glow glowColor="magenta">
            <p>Modals, toasts, status indicators, spinners, progress bars, skeletons, and alert banners.</p>
          </NeonCard>
          <NeonCard title="Data Display" glow glowColor="cyan">
            <p>Badges, tooltips, cards, avatars, and sortable data tables.</p>
          </NeonCard>
          <NeonCard title="Navigation" glow glowColor="green">
            <p>Tab panels, sidebar navigation, and breadcrumbs.</p>
          </NeonCard>
          <NeonCard title="Layout" glow glowColor="magenta">
            <p>Split panes, resizable panels, collapsible sections, and accordions.</p>
          </NeonCard>
        </div>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Design System</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          Built on a consistent design token system with neon accent colors,
          dark backgrounds, and monospace typography. Check the <strong>Design Tokens</strong> page
          for the complete reference.
        </p>
        <div className="demo-row">
          <span style={{ color: 'var(--neon-cyan)', textShadow: 'var(--glow-cyan)' }}>Cyan</span>
          <span style={{ color: 'var(--neon-green)', textShadow: 'var(--glow-green)' }}>Green</span>
          <span style={{ color: 'var(--neon-magenta)', textShadow: 'var(--glow-magenta)' }}>Magenta</span>
          <span style={{ color: 'var(--neon-red)', textShadow: 'var(--glow-red)' }}>Red</span>
        </div>
      </section>
    </div>
  )
}
