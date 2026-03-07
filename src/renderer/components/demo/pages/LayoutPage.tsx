import { useState } from 'react'
import { SplitPane } from '../../layout/SplitPane'
import { ResizablePanel } from '../../layout/ResizablePanel'
import { Collapsible, CollapsibleTrigger, CollapsibleContent, Accordion, AccordionItem } from '../../layout/Collapsible'
import { NeonCard } from '../../ui/NeonCard'
import { CodePreview } from '../CodePreview'
import { PropControls } from '../PropControls'

export function LayoutPage() {
  const [splitProps, setSplitProps] = useState({
    direction: 'horizontal',
  })

  const handleSplitChange = (key: string, value: unknown) => {
    setSplitProps((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Layout</h1>
      <p className="demo-page-subtitle">
        Split panes, resizable panels, collapsible sections, and accordions for organizing content.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">SplitPane</h2>
        <NeonCard>
          <div style={{ height: '250px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <SplitPane
              direction={splitProps.direction as 'horizontal' | 'vertical'}
              defaultSize={40}
              minSize={20}
              maxSize={80}
            >
              <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-dark)', height: '100%' }}>
                <p style={{ color: 'var(--neon-cyan)' }}>Panel 1</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Drag the divider to resize
                </p>
              </div>
              <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-darkest)', height: '100%' }}>
                <p style={{ color: 'var(--neon-green)' }}>Panel 2</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Content adjusts automatically
                </p>
              </div>
            </SplitPane>
          </div>
          <PropControls
            controls={[
              {
                type: 'radio',
                key: 'direction',
                label: 'Direction',
                options: ['horizontal', 'vertical'],
              },
            ]}
            values={splitProps}
            onChange={handleSplitChange}
          />
        </NeonCard>
        <CodePreview
          code={`<SplitPane
  direction="horizontal"
  defaultSize={40}
  minSize={20}
  maxSize={80}
>
  <div>Panel 1</div>
  <div>Panel 2</div>
</SplitPane>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">ResizablePanel</h2>
        <NeonCard>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            Drag the edges or corner to resize the panel.
          </p>
          <div style={{ minHeight: '200px', position: 'relative' }}>
            <ResizablePanel
              defaultWidth={300}
              defaultHeight={150}
              minWidth={150}
              maxWidth={500}
              minHeight={100}
              maxHeight={300}
              resizable={['right', 'bottom', 'corner']}
            >
              <div style={{ padding: 'var(--spacing-md)', height: '100%', background: 'var(--bg-dark)' }}>
                <p style={{ color: 'var(--neon-magenta)' }}>Resizable Panel</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Drag edges to resize
                </p>
              </div>
            </ResizablePanel>
          </div>
        </NeonCard>
        <CodePreview
          code={`<ResizablePanel
  defaultWidth={300}
  defaultHeight={150}
  minWidth={150}
  maxWidth={500}
  minHeight={100}
  maxHeight={300}
  resizable={['right', 'bottom', 'corner']}
>
  <div>Resizable content</div>
</ResizablePanel>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Collapsible</h2>
        <NeonCard>
          <Collapsible defaultOpen>
            <CollapsibleTrigger>System Information</CollapsibleTrigger>
            <CollapsibleContent>
              <p>OS: NeonOS v4.2.0</p>
              <p>Kernel: 5.15.0-neon</p>
              <p>Uptime: 42 days, 7 hours</p>
            </CollapsibleContent>
          </Collapsible>
        </NeonCard>
        <CodePreview
          code={`<Collapsible defaultOpen>
  <CollapsibleTrigger>System Information</CollapsibleTrigger>
  <CollapsibleContent>
    <p>OS: NeonOS v4.2.0</p>
    <p>Kernel: 5.15.0-neon</p>
    <p>Uptime: 42 days, 7 hours</p>
  </CollapsibleContent>
</Collapsible>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Accordion</h2>
        <NeonCard>
          <Accordion defaultOpen="section1">
            <AccordionItem id="section1">
              <CollapsibleTrigger>Security Protocols</CollapsibleTrigger>
              <CollapsibleContent>
                <p>Firewall: Active</p>
                <p>Encryption: AES-256</p>
                <p>Last scan: 2 hours ago</p>
              </CollapsibleContent>
            </AccordionItem>
            <AccordionItem id="section2">
              <CollapsibleTrigger>Network Configuration</CollapsibleTrigger>
              <CollapsibleContent>
                <p>IP Address: 192.168.1.42</p>
                <p>Gateway: 192.168.1.1</p>
                <p>DNS: 8.8.8.8</p>
              </CollapsibleContent>
            </AccordionItem>
            <AccordionItem id="section3">
              <CollapsibleTrigger>Storage Devices</CollapsibleTrigger>
              <CollapsibleContent>
                <p>SSD: 512GB (78% used)</p>
                <p>HDD: 2TB (34% used)</p>
                <p>External: Not connected</p>
              </CollapsibleContent>
            </AccordionItem>
          </Accordion>
        </NeonCard>
        <CodePreview
          code={`<Accordion defaultOpen="section1">
  <AccordionItem id="section1">
    <CollapsibleTrigger>Security Protocols</CollapsibleTrigger>
    <CollapsibleContent>
      <p>Firewall: Active</p>
    </CollapsibleContent>
  </AccordionItem>
  <AccordionItem id="section2">
    <CollapsibleTrigger>Network Configuration</CollapsibleTrigger>
    <CollapsibleContent>
      <p>IP Address: 192.168.1.42</p>
    </CollapsibleContent>
  </AccordionItem>
</Accordion>`}
        />
      </section>
    </div>
  )
}
