import { Toggle } from '../ui/Toggle'
import { Radio, RadioGroup } from '../ui/Radio'
import './PropControls.css'

interface ToggleControl {
  type: 'toggle'
  key: string
  label: string
}

interface RadioControl {
  type: 'radio'
  key: string
  label: string
  options: string[]
}

interface SelectControl {
  type: 'select'
  key: string
  label: string
  options: { value: string; label: string }[]
}

type Control = ToggleControl | RadioControl | SelectControl

interface PropControlsProps {
  controls: Control[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export function PropControls({ controls, values, onChange }: PropControlsProps) {
  return (
    <div className="prop-controls">
      <div className="prop-controls-header">Props</div>
      <div className="prop-controls-list">
        {controls.map((control) => (
          <div key={control.key} className="prop-control-item">
            {control.type === 'toggle' && (
              <Toggle
                label={control.label}
                checked={values[control.key] as boolean}
                onChange={(e) => onChange(control.key, e.target.checked)}
                size="small"
              />
            )}
            {control.type === 'radio' && (
              <div className="prop-control-radio">
                <span className="prop-control-label">{control.label}</span>
                <RadioGroup
                  name={`prop-${control.key}`}
                  value={values[control.key] as string}
                  onChange={(value) => onChange(control.key, value)}
                >
                  {control.options.map((option) => (
                    <Radio
                      key={option}
                      value={option}
                      label={option}
                      size="small"
                    />
                  ))}
                </RadioGroup>
              </div>
            )}
            {control.type === 'select' && (
              <div className="prop-control-select">
                <span className="prop-control-label">{control.label}</span>
                <select
                  value={values[control.key] as string}
                  onChange={(e) => onChange(control.key, e.target.value)}
                  className="prop-control-select-input"
                >
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
