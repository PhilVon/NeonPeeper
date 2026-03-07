import { useState } from 'react'
import { Badge } from '../../ui/Badge'
import { Tooltip } from '../../ui/Tooltip'
import { NeonButton } from '../../ui/NeonButton'
import { NeonCard } from '../../ui/NeonCard'
import { Avatar } from '../../ui/Avatar'
import { DataTable, DataTableColumn } from '../../ui/DataTable'
import { StatusIndicator } from '../../ui/StatusIndicator'
import { CodePreview } from '../CodePreview'
import { PropControls } from '../PropControls'

interface UserData {
  name: string
  role: string
  status: 'online' | 'offline' | 'busy' | 'idle'
  access: number
}

const sampleUsers: UserData[] = [
  { name: 'Nova Chen', role: 'Admin', status: 'online', access: 10 },
  { name: 'Rex Harper', role: 'Operator', status: 'busy', access: 7 },
  { name: 'Zara Kim', role: 'Analyst', status: 'idle', access: 5 },
  { name: 'Axel Drake', role: 'Guest', status: 'offline', access: 2 },
]

const userColumns: DataTableColumn<UserData>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'role', header: 'Role', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (user) => <StatusIndicator status={user.status} label={user.status} />,
  },
  { key: 'access', header: 'Access Level', sortable: true },
]

export function DataDisplayPage() {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [badgeProps, setBadgeProps] = useState({
    variant: 'default',
    size: 'medium',
    glow: true,
  })

  const [cardProps, setCardProps] = useState({
    glow: true,
    glowColor: 'cyan',
  })

  const handleBadgeChange = (key: string, value: unknown) => {
    setBadgeProps((prev) => ({ ...prev, [key]: value }))
  }

  const handleCardChange = (key: string, value: unknown) => {
    setCardProps((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="demo-page">
      <h1 className="demo-page-title">Data Display</h1>
      <p className="demo-page-subtitle">
        Badges, tooltips, cards, avatars, and data tables for presenting information.
      </p>

      <section className="demo-section">
        <h2 className="demo-section-title">Badge - Interactive</h2>
        <NeonCard>
          <div className="demo-preview">
            <Badge
              variant={badgeProps.variant as 'default' | 'info' | 'success' | 'warning' | 'danger'}
              size={badgeProps.size as 'small' | 'medium'}
              glow={badgeProps.glow}
            >
              Badge
            </Badge>
          </div>
          <PropControls
            controls={[
              {
                type: 'radio',
                key: 'variant',
                label: 'Variant',
                options: ['default', 'info', 'success', 'warning', 'danger'],
              },
              {
                type: 'radio',
                key: 'size',
                label: 'Size',
                options: ['small', 'medium'],
              },
              { type: 'toggle', key: 'glow', label: 'Glow' },
            ]}
            values={badgeProps}
            onChange={handleBadgeChange}
          />
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Badge Variants</h2>
        <NeonCard>
          <div className="demo-row">
            <Badge>Default</Badge>
            <Badge variant="info" glow>Info</Badge>
            <Badge variant="success" glow>Success</Badge>
            <Badge variant="warning" glow>Warning</Badge>
            <Badge variant="danger" glow>Danger</Badge>
          </div>
          <div className="demo-row" style={{ marginTop: 'var(--spacing-md)' }}>
            <Badge size="small" variant="info">Small</Badge>
            <Badge size="medium" variant="success">Medium</Badge>
          </div>
        </NeonCard>
        <CodePreview
          code={`<Badge>Default</Badge>
<Badge variant="info" glow>Info</Badge>
<Badge variant="success" glow>Success</Badge>
<Badge variant="warning" glow>Warning</Badge>
<Badge variant="danger" glow>Danger</Badge>

<Badge size="small" variant="info">Small</Badge>
<Badge size="medium" variant="success">Medium</Badge>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Tooltips</h2>
        <NeonCard>
          <div className="demo-row">
            <Tooltip content="Tooltip on top" position="top">
              <NeonButton size="small">Top</NeonButton>
            </Tooltip>
            <Tooltip content="Tooltip on bottom" position="bottom">
              <NeonButton size="small">Bottom</NeonButton>
            </Tooltip>
            <Tooltip content="Tooltip on left" position="left">
              <NeonButton size="small">Left</NeonButton>
            </Tooltip>
            <Tooltip content="Tooltip on right" position="right">
              <NeonButton size="small">Right</NeonButton>
            </Tooltip>
          </div>
        </NeonCard>
        <CodePreview
          code={`<Tooltip content="Tooltip on top" position="top">
  <NeonButton>Top</NeonButton>
</Tooltip>

<Tooltip content="Tooltip on bottom" position="bottom">
  <NeonButton>Bottom</NeonButton>
</Tooltip>

<Tooltip content="Tooltip on left" position="left">
  <NeonButton>Left</NeonButton>
</Tooltip>

<Tooltip content="Tooltip on right" position="right">
  <NeonButton>Right</NeonButton>
</Tooltip>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Cards - Interactive</h2>
        <NeonCard>
          <div className="demo-preview" style={{ flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <NeonCard
              title="Interactive Card"
              glow={cardProps.glow}
              glowColor={cardProps.glowColor as 'cyan' | 'green' | 'magenta'}
            >
              <p>Card content with customizable glow effect.</p>
            </NeonCard>
          </div>
          <PropControls
            controls={[
              { type: 'toggle', key: 'glow', label: 'Glow' },
              {
                type: 'radio',
                key: 'glowColor',
                label: 'Glow Color',
                options: ['cyan', 'green', 'magenta'],
              },
            ]}
            values={cardProps}
            onChange={handleCardChange}
          />
        </NeonCard>
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Card Variants</h2>
        <div className="demo-grid">
          <NeonCard title="Basic Card">
            <p>A simple card with a title.</p>
          </NeonCard>
          <NeonCard title="Cyan Glow" glow glowColor="cyan">
            <p>Card with cyan neon glow effect.</p>
          </NeonCard>
          <NeonCard title="Green Glow" glow glowColor="green">
            <p>Card with green neon glow effect.</p>
          </NeonCard>
          <NeonCard title="Magenta Glow" glow glowColor="magenta">
            <p>Card with magenta neon glow effect.</p>
          </NeonCard>
        </div>
        <CodePreview
          code={`<NeonCard title="Basic Card">
  <p>A simple card with a title.</p>
</NeonCard>

<NeonCard title="Cyan Glow" glow glowColor="cyan">
  <p>Card with cyan neon glow effect.</p>
</NeonCard>

<NeonCard title="Green Glow" glow glowColor="green">
  <p>Card with green neon glow effect.</p>
</NeonCard>`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Avatar</h2>
        <NeonCard>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>Sizes</p>
          <div className="demo-row">
            <Avatar name="Nova Chen" size="small" />
            <Avatar name="Nova Chen" size="medium" />
            <Avatar name="Nova Chen" size="large" />
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>Status</p>
          <div className="demo-row">
            <Avatar name="Online User" status="online" glowColor="green" />
            <Avatar name="Busy User" status="busy" glowColor="red" />
            <Avatar name="Offline User" status="offline" glowColor="cyan" />
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>Glow Colors</p>
          <div className="demo-row">
            <Avatar name="Cyan" glowColor="cyan" />
            <Avatar name="Green" glowColor="green" />
            <Avatar name="Magenta" glowColor="magenta" />
            <Avatar name="Red" glowColor="red" />
          </div>
        </NeonCard>
        <CodePreview
          code={`<Avatar name="Nova Chen" size="large" />

<Avatar name="Online User" status="online" glowColor="green" />
<Avatar name="Busy User" status="busy" glowColor="red" />
<Avatar name="Offline User" status="offline" glowColor="cyan" />

<Avatar name="Cyan" glowColor="cyan" />`}
        />
      </section>

      <section className="demo-section">
        <h2 className="demo-section-title">Data Table</h2>
        <NeonCard>
          <DataTable
            columns={userColumns}
            data={sampleUsers}
            striped
            glowColor="cyan"
            onRowClick={(user) => setSelectedUser(user)}
          />
          {selectedUser && (
            <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Selected: <strong style={{ color: 'var(--neon-cyan)' }}>{selectedUser.name}</strong> — {selectedUser.role}
            </p>
          )}
        </NeonCard>
        <CodePreview
          code={`const columns: DataTableColumn<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'role', header: 'Role', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (user) => <StatusIndicator status={user.status} label={user.status} />,
  },
  { key: 'access', header: 'Access Level', sortable: true },
]

<DataTable
  columns={columns}
  data={users}
  striped
  glowColor="cyan"
  onRowClick={(user) => setSelected(user)}
/>`}
        />
      </section>
    </div>
  )
}
