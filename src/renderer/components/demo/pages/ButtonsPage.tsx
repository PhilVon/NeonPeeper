import { useState } from 'react'
import { NeonButton } from '../../ui/NeonButton'
import { NeonCard } from '../../ui/NeonCard'
import { PropControls } from '../PropControls'
import { CodePreview } from '../CodePreview'

export function ButtonsPage() {
  const [props, setProps] = useState({
    variant: 'primary',
    size: 'medium',
    glow: true,
    disabled: false,
  })

  const handleChange = (key: string, value: unknown) => {
    setProps((prev) => ({ ...prev, [key]: value }))
  }

  const generateCode = () => {
    const propsStr = [
      props.variant !== 'primary' && `variant="${props.variant}"`,
      props.size !== 'medium' && `size="${props.size}"`,
      !props.glow && 'glow={false}',
      props.disabled && 'disabled',
    ]
      .filter(Boolean)
      .join(' ')

    return `<NeonButton${propsStr ? ' ' + propsStr : ''}>Click Me</NeonButton>`
  }

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Buttons</h1>
      <p className="demo-page-subtitle">
        Neon-styled buttons with glow effects, multiple variants, and sizes.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Interactive Demo</h2>
        <NeonCard>
          <div className="demo-preview">
            <NeonButton
              variant={props.variant as 'primary' | 'secondary' | 'danger'}
              size={props.size as 'small' | 'medium' | 'large'}
              glow={props.glow}
              disabled={props.disabled}
            >
              Click Me
            </NeonButton>
          </div>
          <PropControls
            controls={[
              {
                type: 'radio',
                key: 'variant',
                label: 'Variant',
                options: ['primary', 'secondary', 'danger'],
              },
              {
                type: 'radio',
                key: 'size',
                label: 'Size',
                options: ['small', 'medium', 'large'],
              },
              { type: 'toggle', key: 'glow', label: 'Glow' },
              { type: 'toggle', key: 'disabled', label: 'Disabled' },
            ]}
            values={props}
            onChange={handleChange}
          />
        </NeonCard>
        <CodePreview code={generateCode()} />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Variants</h2>
        <div className="demo-row">
          <NeonButton variant="primary">Primary</NeonButton>
          <NeonButton variant="secondary">Secondary</NeonButton>
          <NeonButton variant="danger">Danger</NeonButton>
        </div>
        <CodePreview
          code={`<NeonButton variant="primary">Primary</NeonButton>
<NeonButton variant="secondary">Secondary</NeonButton>
<NeonButton variant="danger">Danger</NeonButton>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Sizes</h2>
        <div className="demo-row">
          <NeonButton size="small">Small</NeonButton>
          <NeonButton size="medium">Medium</NeonButton>
          <NeonButton size="large">Large</NeonButton>
        </div>
        <CodePreview
          code={`<NeonButton size="small">Small</NeonButton>
<NeonButton size="medium">Medium</NeonButton>
<NeonButton size="large">Large</NeonButton>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">States</h2>
        <div className="demo-row">
          <NeonButton disabled>Disabled</NeonButton>
          <NeonButton glow={false}>No Glow</NeonButton>
        </div>
        <CodePreview
          code={`<NeonButton disabled>Disabled</NeonButton>
<NeonButton glow={false}>No Glow</NeonButton>`}
        />
      </section>
    </div>
  )
}
