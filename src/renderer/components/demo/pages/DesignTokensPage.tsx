import { NeonCard } from '../../ui/NeonCard'
import { CodePreview } from '../CodePreview'

interface TokenRowProps {
  name: string
  value: string
  preview?: React.ReactNode
}

function TokenRow({ name, value, preview }: TokenRowProps) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: 'var(--spacing-sm)', fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)' }}>
        {name}
      </td>
      <td style={{ padding: 'var(--spacing-sm)', color: 'var(--text-muted)' }}>
        {value}
      </td>
      <td style={{ padding: 'var(--spacing-sm)' }}>
        {preview}
      </td>
    </tr>
  )
}

export function DesignTokensPage() {
  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Design Tokens</h1>
      <p className="demo-page-subtitle">
        CSS custom properties (variables) that define the visual foundation of the design system.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Neon Accent Colors</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--neon-cyan" value="#00ffff" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-cyan)', borderRadius: 4 }} />} />
              <TokenRow name="--neon-green" value="#00ff88" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-green)', borderRadius: 4 }} />} />
              <TokenRow name="--neon-magenta" value="#ff00ff" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-magenta)', borderRadius: 4 }} />} />
              <TokenRow name="--neon-yellow" value="#ffff00" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-yellow)', borderRadius: 4 }} />} />
              <TokenRow name="--neon-orange" value="#ff8800" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-orange)', borderRadius: 4 }} />} />
              <TokenRow name="--neon-red" value="#ff0044" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-red)', borderRadius: 4 }} />} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Background Colors</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--bg-darkest" value="#0a0a0f" preview={<div style={{ width: 40, height: 20, background: 'var(--bg-darkest)', borderRadius: 4, border: '1px solid var(--border-color)' }} />} />
              <TokenRow name="--bg-dark" value="#12121a" preview={<div style={{ width: 40, height: 20, background: 'var(--bg-dark)', borderRadius: 4, border: '1px solid var(--border-color)' }} />} />
              <TokenRow name="--bg-medium" value="#1a1a25" preview={<div style={{ width: 40, height: 20, background: 'var(--bg-medium)', borderRadius: 4, border: '1px solid var(--border-color)' }} />} />
              <TokenRow name="--bg-light" value="#22222f" preview={<div style={{ width: 40, height: 20, background: 'var(--bg-light)', borderRadius: 4, border: '1px solid var(--border-color)' }} />} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Text Colors</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--text-primary" value="#e0e0e0" preview={<span style={{ color: 'var(--text-primary)' }}>Primary</span>} />
              <TokenRow name="--text-secondary" value="#a0a0a0" preview={<span style={{ color: 'var(--text-secondary)' }}>Secondary</span>} />
              <TokenRow name="--text-muted" value="#606060" preview={<span style={{ color: 'var(--text-muted)' }}>Muted</span>} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Semantic Colors</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--color-success" value="var(--neon-green)" preview={<div style={{ width: 40, height: 20, background: 'var(--color-success)', borderRadius: 4 }} />} />
              <TokenRow name="--color-warning" value="var(--neon-orange)" preview={<div style={{ width: 40, height: 20, background: 'var(--color-warning)', borderRadius: 4 }} />} />
              <TokenRow name="--color-error" value="var(--neon-red)" preview={<div style={{ width: 40, height: 20, background: 'var(--color-error)', borderRadius: 4 }} />} />
              <TokenRow name="--color-info" value="var(--neon-cyan)" preview={<div style={{ width: 40, height: 20, background: 'var(--color-info)', borderRadius: 4 }} />} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Glow Effects</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow
                name="--glow-cyan"
                value="0 0 10px rgba(0, 255, 255, 0.5), ..."
                preview={<div style={{ width: 40, height: 20, background: 'var(--bg-dark)', boxShadow: 'var(--glow-cyan)', borderRadius: 4 }} />}
              />
              <TokenRow
                name="--glow-green"
                value="0 0 10px rgba(0, 255, 136, 0.5), ..."
                preview={<div style={{ width: 40, height: 20, background: 'var(--bg-dark)', boxShadow: 'var(--glow-green)', borderRadius: 4 }} />}
              />
              <TokenRow
                name="--glow-magenta"
                value="0 0 10px rgba(255, 0, 255, 0.5), ..."
                preview={<div style={{ width: 40, height: 20, background: 'var(--bg-dark)', boxShadow: 'var(--glow-magenta)', borderRadius: 4 }} />}
              />
              <TokenRow
                name="--glow-red"
                value="0 0 10px rgba(255, 0, 68, 0.5), ..."
                preview={<div style={{ width: 40, height: 20, background: 'var(--bg-dark)', boxShadow: 'var(--glow-red)', borderRadius: 4 }} />}
              />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Typography</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--font-mono" value="'JetBrains Mono', 'Fira Code', ..." preview={<span style={{ fontFamily: 'var(--font-mono)' }}>Monospace</span>} />
              <TokenRow name="--font-size-xs" value="11px" preview={<span style={{ fontSize: 'var(--font-size-xs)' }}>Extra Small</span>} />
              <TokenRow name="--font-size-sm" value="12px" preview={<span style={{ fontSize: 'var(--font-size-sm)' }}>Small</span>} />
              <TokenRow name="--font-size-md" value="14px" preview={<span style={{ fontSize: 'var(--font-size-md)' }}>Medium</span>} />
              <TokenRow name="--font-size-lg" value="16px" preview={<span style={{ fontSize: 'var(--font-size-lg)' }}>Large</span>} />
              <TokenRow name="--font-size-xl" value="20px" preview={<span style={{ fontSize: 'var(--font-size-xl)' }}>Extra Large</span>} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Spacing</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--spacing-xs" value="4px" preview={<div style={{ width: 'var(--spacing-xs)', height: 20, background: 'var(--neon-cyan)' }} />} />
              <TokenRow name="--spacing-sm" value="8px" preview={<div style={{ width: 'var(--spacing-sm)', height: 20, background: 'var(--neon-cyan)' }} />} />
              <TokenRow name="--spacing-md" value="16px" preview={<div style={{ width: 'var(--spacing-md)', height: 20, background: 'var(--neon-cyan)' }} />} />
              <TokenRow name="--spacing-lg" value="24px" preview={<div style={{ width: 'var(--spacing-lg)', height: 20, background: 'var(--neon-cyan)' }} />} />
              <TokenRow name="--spacing-xl" value="32px" preview={<div style={{ width: 'var(--spacing-xl)', height: 20, background: 'var(--neon-cyan)' }} />} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Border Radius</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--radius-sm" value="4px" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-cyan)', borderRadius: 'var(--radius-sm)' }} />} />
              <TokenRow name="--radius-md" value="8px" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-cyan)', borderRadius: 'var(--radius-md)' }} />} />
              <TokenRow name="--radius-lg" value="12px" preview={<div style={{ width: 40, height: 20, background: 'var(--neon-cyan)', borderRadius: 'var(--radius-lg)' }} />} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Transitions</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <TokenRow name="--transition-fast" value="150ms ease" preview={<span style={{ color: 'var(--text-muted)' }}>Quick interactions</span>} />
              <TokenRow name="--transition-normal" value="250ms ease" preview={<span style={{ color: 'var(--text-muted)' }}>Standard transitions</span>} />
              <TokenRow name="--transition-slow" value="400ms ease" preview={<span style={{ color: 'var(--text-muted)' }}>Emphasis animations</span>} />
            </tbody>
          </table>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Usage Example</h2>
        <CodePreview
          language="css"
          code={`.my-component {
  background: var(--bg-dark);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  transition: all var(--transition-normal);
}

.my-component:hover {
  border-color: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}`}
        />
      </section>
    </div>
  )
}
