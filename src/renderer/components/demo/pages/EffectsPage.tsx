import { NeonCard } from '../../ui/NeonCard'
import { CodePreview } from '../CodePreview'
import { useReplayAnimation } from '../../../hooks/useReplayAnimation'

function ReplayableDemo({
  animationClass,
  children,
  style
}: {
  animationClass: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const { ref, replay } = useReplayAnimation<HTMLDivElement>({ animationClass })

  return (
    <div
      ref={ref}
      className={animationClass}
      style={{ ...style, cursor: 'pointer' }}
      onClick={replay}
      title="Click to replay animation"
    >
      {children}
    </div>
  )
}

export function EffectsPage() {
  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Effects</h1>
      <p className="demo-page-subtitle">
        CSS animation classes for adding cyberpunk visual effects to elements.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Text Effects</h2>
        <NeonCard>
          <div className="demo-row">
            <span className="pulse" style={{ color: 'var(--neon-cyan)' }}>Pulse</span>
            <span className="pulse-fast" style={{ color: 'var(--neon-green)' }}>Pulse Fast</span>
            <span className="flicker" style={{ color: 'var(--neon-magenta)' }}>Flicker</span>
            <span className="glitch-hover" style={{ color: 'var(--neon-cyan)' }}>Hover for Glitch</span>
          </div>
        </NeonCard>
        <CodePreview
          code={`<span className="pulse">Pulse</span>
<span className="pulse-fast">Pulse Fast</span>
<span className="flicker">Flicker</span>
<span className="glitch-hover">Hover for Glitch</span>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Motion Effects</h2>
        <NeonCard>
          <div className="demo-row">
            <span className="float" style={{ display: 'inline-block', color: 'var(--neon-cyan)' }}>Float</span>
            <ReplayableDemo
              animationClass="fade-in"
              style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--neon-green)', color: 'var(--neon-green)' }}
            >
              Fade In (click to replay)
            </ReplayableDemo>
          </div>
        </NeonCard>
        <CodePreview
          code={`<span className="float">Float</span>
<div className="fade-in">Fade In</div>

// To make one-time animations replayable:
import { useReplayAnimation } from '../hooks/useReplayAnimation'

const { ref, replay } = useReplayAnimation({ animationClass: 'fade-in' })
<div ref={ref} className="fade-in" onClick={replay}>
  Click to replay
</div>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Glow Effects</h2>
        <NeonCard>
          <div className="demo-row">
            <div className="glow-pulse" style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--neon-cyan)' }}>
              Glow Pulse
            </div>
            <div className="border-glow-expand" style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--neon-cyan)' }}>
              Border Glow Expand
            </div>
            <div className="neon-border" style={{ padding: 'var(--spacing-sm)' }}>
              Neon Border
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<div className="glow-pulse">Glow Pulse</div>
<div className="border-glow-expand">Border Glow Expand</div>
<div className="neon-border">Neon Border</div>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Special Effects</h2>
        <NeonCard>
          <div className="demo-row">
            <ReplayableDemo
              animationClass="power-on"
              style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--neon-cyan)' }}
            >
              Power On (click to replay)
            </ReplayableDemo>
            <span className="cursor-blink" style={{ color: 'var(--neon-green)' }}>Terminal</span>
          </div>
        </NeonCard>
        <CodePreview
          code={`<div className="power-on">Power On</div>
<span className="cursor-blink">Terminal</span>

// Make power-on replayable:
const { ref, replay } = useReplayAnimation({ animationClass: 'power-on' })
<div ref={ref} className="power-on" onClick={replay}>
  Click to replay
</div>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Background Effects</h2>
        <NeonCard>
          <div className="demo-row">
            <div
              className="data-stream"
              style={{
                padding: 'var(--spacing-md)',
                width: '200px',
                height: '100px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ color: 'var(--neon-green)' }}>Data Stream</span>
            </div>
            <div
              className="scan-line-animated"
              style={{
                padding: 'var(--spacing-md)',
                width: '200px',
                height: '100px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)'
              }}
            >
              <span style={{ color: 'var(--neon-cyan)' }}>Scan Line</span>
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<div className="data-stream">Data Stream</div>
<div className="scan-line-animated">Scan Line</div>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Typography Colors</h2>
        <NeonCard>
          <div className="demo-row">
            <span className="text-cyan">Cyan Text</span>
            <span className="text-green">Green Text</span>
            <span className="text-magenta">Magenta Text</span>
            <span className="text-yellow">Yellow Text</span>
            <span className="text-orange">Orange Text</span>
            <span className="text-red">Red Text</span>
          </div>
          <div className="demo-row" style={{ marginTop: 'var(--spacing-md)' }}>
            <span className="glow-cyan">Glowing Cyan</span>
            <span className="glow-green">Glowing Green</span>
            <span className="glow-magenta">Glowing Magenta</span>
          </div>
        </NeonCard>
        <CodePreview
          code={`<span className="text-cyan">Cyan Text</span>
<span className="text-green">Green Text</span>
<span className="text-magenta">Magenta Text</span>

<span className="glow-cyan">Glowing Cyan</span>
<span className="glow-green">Glowing Green</span>
<span className="glow-magenta">Glowing Magenta</span>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Advanced Effects</h2>
        <NeonCard>
          <div className="demo-row" style={{ flexWrap: 'wrap' }}>
            <div
              className="hologram"
              style={{
                padding: 'var(--spacing-md)',
                width: '160px',
                height: '80px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'var(--neon-cyan)' }}>Hologram</span>
            </div>
            <span
              className="chromatic-aberration"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-lg)' }}
            >
              Chromatic Aberration
            </span>
            <span
              className="neon-flicker"
              style={{ color: 'var(--neon-magenta)', fontSize: 'var(--font-size-lg)' }}
            >
              Neon Flicker
            </span>
            <div
              className="scanline-sweep"
              style={{
                padding: 'var(--spacing-md)',
                width: '160px',
                height: '80px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)',
              }}
            >
              <span style={{ color: 'var(--neon-green)' }}>Scanline Sweep</span>
            </div>
            <div
              className="static-noise"
              style={{
                padding: 'var(--spacing-md)',
                width: '160px',
                height: '80px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-dark)',
              }}
            >
              <span style={{ color: 'var(--neon-red)' }}>Static Noise</span>
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<div className="hologram">Hologram</div>
<span className="chromatic-aberration">Chromatic</span>
<span className="neon-flicker">Neon Flicker</span>
<div className="scanline-sweep">Scanline Sweep</div>
<div className="static-noise">Static Noise</div>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Available Animation Classes</h2>
        <NeonCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Class</th>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Description</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-primary)' }}>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.glitch</code></td><td>RGB split + shake effect (plays once)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.glitch-hover</code></td><td>Glitch effect on hover</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.pulse</code></td><td>Opacity breathing (2s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.pulse-fast</code></td><td>Fast opacity breathing (1s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.glow-pulse</code></td><td>Box shadow pulse effect</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.flicker</code></td><td>Screen flicker effect</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.float</code></td><td>Floating up/down motion</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.fade-in</code></td><td>Fade in with slide up (use hook to replay)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.power-on</code></td><td>CRT power-on effect (use hook to replay)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.cursor-blink</code></td><td>Terminal cursor blink</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.neon-border</code></td><td>Glowing border on hover</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.data-stream</code></td><td>Matrix-style background</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.scan-line-animated</code></td><td>Moving scan line overlay</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.hologram</code></td><td>Hue-rotate + scan-line overlay (4s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.chromatic-aberration</code></td><td>Animated cyan/magenta text-shadow drift (3s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.neon-flicker</code></td><td>Irregular neon sign flicker (4s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.scanline-sweep</code></td><td>Horizontal bright line sweep left-to-right (2.5s cycle)</td></tr>
              <tr><td style={{ padding: 'var(--spacing-sm)' }}><code>.static-noise</code></td><td>Cross-hatch noise pattern (rapid steps)</td></tr>
            </tbody>
          </table>
        </NeonCard>
      </section>
    </div>
  )
}
