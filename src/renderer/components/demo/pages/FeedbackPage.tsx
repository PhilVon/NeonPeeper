import { useState } from 'react'
import { NeonButton } from '../../ui/NeonButton'
import { NeonCard } from '../../ui/NeonCard'
import { Modal, ModalFooter } from '../../ui/Modal'
import { StatusIndicator } from '../../ui/StatusIndicator'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { ProgressBar } from '../../ui/ProgressBar'
import { Skeleton } from '../../ui/Skeleton'
import { AlertBanner } from '../../ui/AlertBanner'
import { Slider } from '../../ui/Slider'
import { toast } from '../../../store/toast-store'
import { CodePreview } from '../CodePreview'
import { PropControls } from '../PropControls'

export function FeedbackPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [progressValue, setProgressValue] = useState(65)
  const [showBanner, setShowBanner] = useState(true)
  const [spinnerProps, setSpinnerProps] = useState({
    size: 'medium',
    color: 'cyan',
  })

  const handleSpinnerChange = (key: string, value: unknown) => {
    setSpinnerProps((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Feedback</h1>
      <p className="demo-page-subtitle">
        Modals, toast notifications, status indicators, loading spinners, progress bars, skeletons, and alerts.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Modal</h2>
        <NeonCard>
          <NeonButton onClick={() => setIsModalOpen(true)}>Open Modal</NeonButton>
        </NeonCard>
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="System Message"
        >
          <p>Access granted. Welcome to the mainframe.</p>
          <p style={{ marginTop: 'var(--spacing-md)' }}>
            This modal demonstrates the neon-styled overlay with focus trapping and escape key handling.
          </p>
          <ModalFooter>
            <NeonButton variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeonButton>
            <NeonButton onClick={() => setIsModalOpen(false)}>
              Confirm
            </NeonButton>
          </ModalFooter>
        </Modal>
        <CodePreview
          code={`const [isOpen, setIsOpen] = useState(false)

<NeonButton onClick={() => setIsOpen(true)}>Open Modal</NeonButton>

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="System Message"
>
  <p>Modal content here...</p>
  <ModalFooter>
    <NeonButton variant="secondary" onClick={() => setIsOpen(false)}>
      Cancel
    </NeonButton>
    <NeonButton onClick={() => setIsOpen(false)}>
      Confirm
    </NeonButton>
  </ModalFooter>
</Modal>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Toast Notifications</h2>
        <NeonCard>
          <div className="demo-row">
            <NeonButton size="small" onClick={() => toast.info('Information message')}>
              Info Toast
            </NeonButton>
            <NeonButton size="small" variant="secondary" onClick={() => toast.success('Operation successful!')}>
              Success Toast
            </NeonButton>
            <NeonButton size="small" onClick={() => toast.warning('Warning: Check your input')}>
              Warning Toast
            </NeonButton>
            <NeonButton size="small" variant="danger" onClick={() => toast.error('Error: Connection failed')}>
              Error Toast
            </NeonButton>
          </div>
        </NeonCard>
        <CodePreview
          code={`import { toast } from '../store/toast-store'

// Trigger toasts from anywhere
toast.info('Information message')
toast.success('Operation successful!')
toast.warning('Warning: Check your input')
toast.error('Error: Connection failed')

// Add ToastContainer to your app
<ToastContainer />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Status Indicators</h2>
        <NeonCard>
          <div className="demo-row">
            <StatusIndicator status="online" label="Online" />
            <StatusIndicator status="busy" label="Busy" />
            <StatusIndicator status="idle" label="Idle" />
            <StatusIndicator status="offline" label="Offline" />
          </div>
        </NeonCard>
        <CodePreview
          code={`<StatusIndicator status="online" label="Online" />
<StatusIndicator status="busy" label="Busy" />
<StatusIndicator status="idle" label="Idle" />
<StatusIndicator status="offline" label="Offline" />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Loading Spinner</h2>
        <NeonCard>
          <div className="demo-preview">
            <LoadingSpinner
              size={spinnerProps.size as 'small' | 'medium' | 'large'}
              color={spinnerProps.color as 'cyan' | 'green' | 'magenta' | 'red'}
            />
          </div>
          <PropControls
            controls={[
              {
                type: 'radio',
                key: 'size',
                label: 'Size',
                options: ['small', 'medium', 'large'],
              },
              {
                type: 'radio',
                key: 'color',
                label: 'Color',
                options: ['cyan', 'green', 'magenta', 'red'],
              },
            ]}
            values={spinnerProps}
            onChange={handleSpinnerChange}
          />
        </NeonCard>
        <CodePreview
          code={`<LoadingSpinner size="small" color="cyan" />
<LoadingSpinner size="medium" color="green" />
<LoadingSpinner size="large" color="magenta" />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Progress Bar - Interactive</h2>
        <NeonCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <ProgressBar value={progressValue} variant="cyan" glow showLabel animated />
            <Slider
              label="Adjust value"
              color="cyan"
              min={0}
              max={100}
              value={progressValue}
              onChange={(e) => setProgressValue(Number(e.target.value))}
              showValue
            />
          </div>
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Progress Bar Variants</h2>
        <NeonCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <ProgressBar value={80} variant="cyan" showLabel />
            <ProgressBar value={60} variant="green" showLabel glow />
            <ProgressBar value={45} variant="magenta" showLabel animated />
            <ProgressBar value={25} variant="red" size="large" showLabel glow animated />
          </div>
        </NeonCard>
        <CodePreview
          code={`<ProgressBar value={80} variant="cyan" showLabel />
<ProgressBar value={60} variant="green" showLabel glow />
<ProgressBar value={45} variant="magenta" showLabel animated />
<ProgressBar value={25} variant="red" size="large" showLabel glow animated />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Skeleton</h2>
        <NeonCard>
          <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Text (3 lines)</p>
              <Skeleton variant="text" lines={3} />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Circular</p>
              <Skeleton variant="circular" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>Rectangular</p>
              <Skeleton variant="rectangular" height={80} />
            </div>
          </div>
        </NeonCard>
        <CodePreview
          code={`<Skeleton variant="text" lines={3} />
<Skeleton variant="circular" />
<Skeleton variant="rectangular" height={80} />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Alert Banners</h2>
        <NeonCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <AlertBanner variant="info" title="Information">
              System update available. Check the changelog for details.
            </AlertBanner>
            <AlertBanner variant="success" title="Success">
              Connection established. All systems operational.
            </AlertBanner>
            <AlertBanner variant="warning" title="Warning">
              High memory usage detected. Consider closing unused tabs.
            </AlertBanner>
            <AlertBanner variant="error" title="Error">
              Authentication failed. Please check your credentials.
            </AlertBanner>
            {showBanner && (
              <AlertBanner
                variant="info"
                title="Dismissible"
                dismissible
                onDismiss={() => setShowBanner(false)}
              >
                This alert can be dismissed. Click the X to close it.
              </AlertBanner>
            )}
            {!showBanner && (
              <NeonButton size="small" onClick={() => setShowBanner(true)}>
                Show Dismissible Alert
              </NeonButton>
            )}
          </div>
        </NeonCard>
        <CodePreview
          code={`<AlertBanner variant="info" title="Information">
  System update available.
</AlertBanner>

<AlertBanner variant="success" title="Success">
  Connection established.
</AlertBanner>

<AlertBanner
  variant="warning"
  title="Dismissible"
  dismissible
  onDismiss={() => setVisible(false)}
>
  This alert can be dismissed.
</AlertBanner>`}
        />
      </section>
    </div>
  )
}
