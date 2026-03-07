import { useState } from 'react'
import { NeonInput } from '../../ui/NeonInput'
import { Toggle } from '../../ui/Toggle'
import { Checkbox } from '../../ui/Checkbox'
import { Radio, RadioGroup } from '../../ui/Radio'
import { Select } from '../../ui/Select'
import { TextArea } from '../../ui/TextArea'
import { Slider } from '../../ui/Slider'
import { NeonCard } from '../../ui/NeonCard'
import { CodePreview } from '../CodePreview'

export function FormsPage() {
  const [inputValue, setInputValue] = useState('')
  const [toggleState, setToggleState] = useState(false)
  const [checkboxState, setCheckboxState] = useState(false)
  const [selectedRadio, setSelectedRadio] = useState('option1')
  const [selectValue, setSelectValue] = useState('')
  const [textAreaValue, setTextAreaValue] = useState('')
  const [sliderValue, setSliderValue] = useState(50)

  const selectOptions = [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'angular', label: 'Angular' },
    { value: 'svelte', label: 'Svelte' },
  ]

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Form Controls</h1>
      <p className="demo-page-subtitle">
        Input fields, text areas, toggles, checkboxes, radio buttons, select dropdowns, and sliders.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Text Input</h2>
        <NeonCard>
          <div className="demo-inputs">
            <NeonInput
              label="Username"
              placeholder="Enter username..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <NeonInput
              label="With Error"
              placeholder="Invalid input..."
              error="This field is required"
            />
            <NeonInput
              label="Disabled"
              placeholder="Cannot edit..."
              disabled
            />
          </div>
        </NeonCard>
        <CodePreview
          code={`<NeonInput
  label="Username"
  placeholder="Enter username..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

<NeonInput
  label="With Error"
  error="This field is required"
/>

<NeonInput
  label="Disabled"
  disabled
/>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Toggle</h2>
        <NeonCard>
          <div className="demo-row">
            <Toggle
              label="Cyan toggle"
              color="cyan"
              checked={toggleState}
              onChange={(e) => setToggleState(e.target.checked)}
            />
            <Toggle label="Green toggle" color="green" defaultChecked />
            <Toggle label="Magenta toggle" color="magenta" />
          </div>
          <div className="demo-row" style={{ marginTop: 'var(--spacing-md)' }}>
            <Toggle size="small" label="Small" />
            <Toggle size="medium" label="Medium" defaultChecked />
            <Toggle size="large" label="Large" />
          </div>
        </NeonCard>
        <CodePreview
          code={`<Toggle
  label="Cyan toggle"
  color="cyan"
  checked={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>

<Toggle label="Green toggle" color="green" defaultChecked />
<Toggle size="small" label="Small" />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Checkbox</h2>
        <NeonCard>
          <div className="demo-row">
            <Checkbox
              label="Cyan checkbox"
              color="cyan"
              checked={checkboxState}
              onChange={(e) => setCheckboxState(e.target.checked)}
            />
            <Checkbox label="Green checkbox" color="green" defaultChecked />
            <Checkbox label="Magenta checkbox" color="magenta" />
          </div>
          <div className="demo-row" style={{ marginTop: 'var(--spacing-md)' }}>
            <Checkbox size="small" label="Small" />
            <Checkbox size="medium" label="Medium" defaultChecked />
            <Checkbox size="large" label="Large" />
          </div>
        </NeonCard>
        <CodePreview
          code={`<Checkbox
  label="Cyan checkbox"
  color="cyan"
  checked={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>

<Checkbox label="Green" color="green" defaultChecked />
<Checkbox size="small" label="Small" />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Radio</h2>
        <NeonCard>
          <RadioGroup name="demo-radio" value={selectedRadio} onChange={setSelectedRadio}>
            <Radio value="option1" label="Option 1" color="cyan" />
            <Radio value="option2" label="Option 2" color="cyan" />
            <Radio value="option3" label="Option 3" color="cyan" />
          </RadioGroup>
        </NeonCard>
        <CodePreview
          code={`<RadioGroup name="demo-radio" value={selected} onChange={setSelected}>
  <Radio value="option1" label="Option 1" color="cyan" />
  <Radio value="option2" label="Option 2" color="cyan" />
  <Radio value="option3" label="Option 3" color="cyan" />
</RadioGroup>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Select</h2>
        <NeonCard>
          <div className="demo-inputs">
            <Select
              label="Framework"
              placeholder="Choose a framework..."
              options={selectOptions}
              value={selectValue}
              onChange={setSelectValue}
            />
            <Select
              label="With Error"
              options={selectOptions}
              error="Please select an option"
            />
          </div>
        </NeonCard>
        <CodePreview
          code={`const options = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
]

<Select
  label="Framework"
  placeholder="Choose a framework..."
  options={options}
  value={value}
  onChange={setValue}
/>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">TextArea</h2>
        <NeonCard>
          <div className="demo-inputs">
            <TextArea
              label="Message"
              placeholder="Enter your message..."
              value={textAreaValue}
              onChange={(e) => setTextAreaValue(e.target.value)}
            />
            <TextArea
              label="With Error"
              placeholder="Invalid content..."
              error="Message is too short"
            />
            <TextArea
              label="Disabled"
              placeholder="Cannot edit..."
              disabled
            />
          </div>
        </NeonCard>
        <CodePreview
          code={`<TextArea
  label="Message"
  placeholder="Enter your message..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

<TextArea
  label="With Error"
  error="Message is too short"
/>

<TextArea
  label="Disabled"
  disabled
/>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Slider</h2>
        <NeonCard>
          <div className="demo-inputs">
            <Slider
              label="Cyan Slider"
              color="cyan"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              showValue
            />
            <Slider
              label="Green Slider"
              color="green"
              min={0}
              max={100}
              defaultValue={75}
              showValue
            />
            <Slider
              label="Magenta Slider"
              color="magenta"
              size="large"
              min={0}
              max={100}
              defaultValue={30}
              showValue
            />
          </div>
        </NeonCard>
        <CodePreview
          code={`<Slider
  label="Cyan Slider"
  color="cyan"
  min={0}
  max={100}
  value={value}
  onChange={(e) => setValue(Number(e.target.value))}
  showValue
/>

<Slider
  label="Green Slider"
  color="green"
  defaultValue={75}
  showValue
/>

<Slider
  label="Magenta Slider"
  color="magenta"
  size="large"
  showValue
/>`}
        />
      </section>
    </div>
  )
}
