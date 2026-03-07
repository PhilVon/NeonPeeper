# P2P Chat System — UI Components

> New React components for chat, media, and peer management.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Chat Components](#chat-components)
- [Media Components](#media-components)
- [Peer Components](#peer-components)
- [Settings Components](#settings-components)
- [Layout Integration](#layout-integration)

---

## Design Principles

New P2P components follow the conventions established by the existing neon UI library:

| Convention | Pattern | Examples |
|------------|---------|----------|
| **TypeScript props** | `interface ComponentProps` extending native HTML attributes | `NeonButton`, `NeonCard` |
| **Visual variants** | `variant`, `size`, `glow`, `glowColor` props | `variant: 'primary' \| 'secondary' \| 'danger'` |
| **CSS design tokens** | Use `var(--neon-*)`, `var(--bg-*)`, `var(--glow-*)` | `theme.css` variables |
| **forwardRef** | For input-like components that need ref access | `NeonInput`, `TextArea`, `Toggle` |
| **Module CSS** | Component-scoped styles via CSS imports | `import './Component.css'` |
| **Neon aesthetic** | Dark backgrounds, glowing borders, monospace fonts | Consistent with existing UI |
| **Accessibility** | ARIA attributes, semantic HTML, keyboard navigation | `useFocusTrap`, `useEscapeKey` |

---

## Chat Components

### ChatList

Sidebar list of all chat sessions, sorted by last activity.

```typescript
interface ChatListProps {
  /** Currently selected chat ID */
  activeChatId: string | null

  /** Callback when a chat is selected */
  onChatSelect: (chatId: string) => void

  /** Callback to create a new chat */
  onNewChat: () => void
}
```

**Visual spec:**

```
+----------------------------------+
| CHATS                    [+ New] |
+----------------------------------+
| ● Alice                    2m ago|
|   Hey, did you see the...        |
+----------------------------------+
| ● Team Chat (3)           15m ago|
|   Bob: I'll push the fix...      |
+----------------------------------+
|   Charlie                  1h ago|
|   Thanks for the help!           |
+----------------------------------+
```

- Online peers: `StatusIndicator` with `status="online"` (●)
- Offline peers: no indicator
- Unread count: `Badge` with `variant="info"`
- Last message preview: truncated, muted text color (`var(--text-muted)`)
- Active chat: highlighted background (`var(--bg-light)`) with cyan left border

### ChatView

Main chat area showing messages, input, and header.

```typescript
interface ChatViewProps {
  /** Chat ID to display */
  chatId: string
}
```

**Composition:**

```
+----------------------------------------------+
| ChatHeader                                   |
|  Alice  ● Online          [📞] [📹] [⋮]     |
+----------------------------------------------+
|                                              |
|  ChatMessage (from: them)                    |
|  ┌────────────────────────────┐              |
|  │ Hey, how's it going?      │              |
|  └───────────────── 2:30 PM ─┘              |
|                                              |
|              ChatMessage (from: me)          |
|              ┌────────────────────────────┐  |
|              │ Going well! Working on the │  |
|              │ new feature.               │  |
|              └── 2:31 PM ✓✓ ─────────────┘  |
|                                              |
|  TypingIndicator                             |
|  Alice is typing...                          |
|                                              |
+----------------------------------------------+
| ChatInput                                    |
| [Type a message...              ] [Send ▶]   |
+----------------------------------------------+
```

### ChatMessage

Individual message bubble.

```typescript
interface ChatMessageProps {
  /** Message data */
  message: {
    id: string
    from: string
    content: string
    timestamp: number
    status: 'sent' | 'delivered' | 'read'
    replyTo?: string
    edited?: { editedAt: number }
    deleted?: boolean
  }

  /** Whether this message is from the local user */
  isOwn: boolean

  /** Sender's display name (for group chats) */
  senderName?: string

  /** Sender's avatar color */
  senderColor?: string

  /** Callback for context menu actions */
  onAction?: (action: 'reply' | 'edit' | 'delete' | 'copy', messageId: string) => void
}
```

**Styling:**

- Own messages: right-aligned, `var(--neon-cyan)` subtle border
- Others' messages: left-aligned, `var(--border-color)` border
- Deleted messages: italic "Message deleted" in `var(--text-muted)`
- Edited messages: small "(edited)" label
- Timestamps: `var(--text-muted)`, `var(--font-size-xs)`
- Status checkmarks: `✓` delivered, `✓✓` read (in `var(--neon-green)`)

### ChatInput

Message composition with typing indicator trigger.

```typescript
interface ChatInputProps {
  /** Callback when message is submitted */
  onSend: (content: string) => void

  /** Callback when user starts/stops typing */
  onTyping: (isTyping: boolean) => void

  /** Placeholder text */
  placeholder?: string

  /** Whether input is disabled (peer offline) */
  disabled?: boolean

  /** Optional: ID of message being replied to */
  replyToId?: string

  /** Callback to cancel reply */
  onCancelReply?: () => void
}
```

- Uses `TextArea` with auto-resize (max 6 rows)
- `Enter` sends, `Shift+Enter` for newline
- Debounced typing indicator: fire `onTyping(true)` on input, `onTyping(false)` after 3s of inactivity

### ChatHeader

Top bar of the chat view with peer info and action buttons.

```typescript
interface ChatHeaderProps {
  /** Chat session data */
  chat: {
    id: string
    type: 'direct' | 'group'
    name: string | null
    members: string[]
  }

  /** Callback to start audio call */
  onAudioCall?: () => void

  /** Callback to start video call */
  onVideoCall?: () => void

  /** Callback to open chat settings */
  onSettings?: () => void
}
```

### TypingIndicator

Animated "X is typing..." display.

```typescript
interface TypingIndicatorProps {
  /** Display names of peers currently typing */
  typingPeers: string[]
}
```

- 1 peer: "Alice is typing..."
- 2 peers: "Alice and Bob are typing..."
- 3+ peers: "3 people are typing..."
- Animated dots using `pulse` animation class

### GroupMemberList

Sidebar showing members of a group chat.

```typescript
interface GroupMemberListProps {
  /** Member peer IDs */
  members: string[]

  /** Callback to invite a new member */
  onInvite?: () => void

  /** Callback to remove a member (if allowed) */
  onRemove?: (peerId: string) => void
}
```

---

## Media Components

### VideoGrid

Responsive grid layout for video tiles. Automatically adjusts layout based on participant count.

```typescript
interface VideoGridProps {
  /** Local video stream */
  localStream: MediaStream | null

  /** Remote video streams */
  remoteStreams: Array<{
    peerId: string
    stream: MediaStream
    displayName: string
    audioMuted: boolean
    videoEnabled: boolean
  }>

  /** Active/dominant speaker peer ID */
  activeSpeaker?: string

  /** Screen share stream (displayed full-width above grid) */
  screenShare?: {
    peerId: string
    stream: MediaStream
    displayName: string
  } | null
}
```

**Layout rules:**

```
1 participant (self only):
+----------------------------------+
|                                  |
|           Self (large)           |
|                                  |
+----------------------------------+

2 participants (1:1 call):
+-----------------+-----------------+
|                 |                 |
|    Remote       |    Self         |
|    (large)      |    (large)      |
|                 |                 |
+-----------------+-----------------+

3-4 participants:
+-----------------+-----------------+
|                 |                 |
|    Peer 1       |    Peer 2       |
|                 |                 |
+-----------------+-----------------+
|                 |                 |
|    Peer 3       |    Self         |
|                 |                 |
+-----------------+-----------------+

5-6 participants:
+-----------+-----------+-----------+
|  Peer 1   |  Peer 2   |  Peer 3   |
+-----------+-----------+-----------+
|  Peer 4   |  Peer 5   |   Self    |
+-----------+-----------+-----------+

7-8+ participants:
+---------+---------+---------+---------+
| Peer 1  | Peer 2  | Peer 3  | Peer 4  |
+---------+---------+---------+---------+
| Peer 5  | Peer 6  | Peer 7  |  Self   |
+---------+---------+---------+---------+

With screen share:
+----------------------------------------------+
|                                              |
|          Screen Share (full width)           |
|                                              |
+----------------------------------------------+
| [P1] [P2] [P3] [Self]  (thumbnail strip)    |
+----------------------------------------------+
```

- Active speaker: `var(--glow-green)` border glow
- CSS Grid for responsive layout
- Transition between layouts with `var(--transition-normal)`

### VideoTile

Single video tile with name overlay and status indicators.

```typescript
interface VideoTileProps {
  /** MediaStream to display */
  stream: MediaStream

  /** Peer display name */
  displayName: string

  /** Whether audio is muted */
  audioMuted: boolean

  /** Whether video is enabled */
  videoEnabled: boolean

  /** Whether this is the local user */
  isLocal?: boolean

  /** Whether this is the active speaker */
  isActiveSpeaker?: boolean

  /** Size variant */
  size?: 'small' | 'medium' | 'large'

  /** Connection quality */
  quality?: 'excellent' | 'good' | 'fair' | 'poor'
}
```

**Visual spec:**

```
+------------------------------+
|                              |
|                              |
|     <video> element          |
|     (object-fit: cover)      |
|                              |
|                              |
| 🔇 Alice        ▂▃▅ Good    |
+------------------------------+
```

- Name overlay: bottom-left, semi-transparent `var(--bg-darkest)` backdrop
- Mute icon: bottom-left, shown when audio is muted
- Quality indicator: bottom-right, colored bars
- Video disabled: show `Avatar` component with initials on `var(--bg-dark)` background
- Active speaker: animated `glow-pulse` border in `var(--neon-green)`

### ScreenShareView

Full-width screen share display.

```typescript
interface ScreenShareViewProps {
  /** Screen share stream */
  stream: MediaStream

  /** Sharer's display name */
  displayName: string

  /** Whether the local user is sharing */
  isLocal?: boolean

  /** Callback to stop sharing (only for local) */
  onStopSharing?: () => void
}
```

- Uses `object-fit: contain` (preserve aspect ratio, letterbox if needed)
- If local: shows "You are sharing your screen" banner with Stop button

### MediaControls

Bottom toolbar for call controls.

```typescript
interface MediaControlsProps {
  /** Whether audio is muted */
  audioMuted: boolean

  /** Whether video is enabled */
  videoEnabled: boolean

  /** Whether screen is being shared */
  screenSharing: boolean

  /** Whether in a call */
  inCall: boolean

  /** Toggle audio mute */
  onToggleAudio: () => void

  /** Toggle video */
  onToggleVideo: () => void

  /** Toggle screen share */
  onToggleScreen: () => void

  /** End call */
  onEndCall: () => void

  /** Open settings */
  onSettings?: () => void
}
```

**Visual spec:**

```
+------------------------------------------------------+
|  [🎤 Mute] [📹 Camera] [🖥️ Screen] [⚙️]   [📞 End] |
+------------------------------------------------------+
```

- Active state: `NeonButton variant="primary"` with glow
- Muted/disabled state: `NeonButton variant="secondary"`
- End call: `NeonButton variant="danger"` with red glow
- Uses existing `NeonButton` component with `size="medium"`

### ScreenSourcePicker

Modal for selecting a screen/window to share.

```typescript
interface ScreenSourcePickerProps {
  /** Whether the picker is open */
  isOpen: boolean

  /** Available sources from desktopCapturer */
  sources: Array<{
    id: string
    name: string
    thumbnail: string
    appIcon: string | null
  }>

  /** Callback when source is selected */
  onSelect: (sourceId: string) => void

  /** Callback to close picker */
  onClose: () => void
}
```

- Uses existing `Modal` component with `size="large"`
- Grid of source thumbnails with names
- Hover: `var(--glow-cyan)` border
- Selected: `var(--neon-cyan)` solid border
- Separate tabs for "Screens" and "Windows"

### DeviceSelector

Dropdown for camera/microphone/speaker selection.

```typescript
interface DeviceSelectorProps {
  /** Device type to select */
  type: 'camera' | 'microphone' | 'speaker'

  /** Available devices */
  devices: MediaDeviceInfo[]

  /** Currently selected device ID */
  selectedId: string | null

  /** Callback when device changes */
  onChange: (deviceId: string) => void

  /** Label text */
  label?: string
}
```

- Uses existing `Select` component
- Shows device labels
- "Default" option when `selectedId` is null

### QualityIndicator

Small badge showing connection quality.

```typescript
interface QualityIndicatorProps {
  /** Connection quality level */
  quality: 'excellent' | 'good' | 'fair' | 'poor'

  /** Whether to show text label */
  showLabel?: boolean

  /** Size variant */
  size?: 'small' | 'medium'
}
```

**Visual representation:**

```
excellent: ▂▃▅▇  (all green, var(--neon-green))
good:      ▂▃▅   (3 bars green)
fair:      ▂▃    (2 bars yellow, var(--neon-yellow))
poor:      ▂     (1 bar red, var(--neon-red))
```

---

## Peer Components

### PeerList

List of known peers with online status.

```typescript
interface PeerListProps {
  /** Callback when a peer is selected for chat */
  onStartChat: (peerId: string) => void

  /** Callback to open manual connection */
  onManualConnect: () => void
}
```

**Visual spec:**

```
+----------------------------------+
| PEERS                   [+ Add]  |
+----------------------------------+
| ● Alice                  ✓ Verified |
| ● Bob                              |
|   Charlie (offline)       1h ago    |
+----------------------------------+
```

- Uses `StatusIndicator` for online status
- Uses `Badge variant="success"` for verified peers
- Offline peers in `var(--text-muted)`

### PeerCard

Detailed peer info card (shown on hover or click).

```typescript
interface PeerCardProps {
  /** Peer profile data */
  peer: {
    peerId: string
    displayName: string
    status: 'online' | 'offline' | 'busy' | 'idle'
    verified: boolean
    firstSeen: number
    lastSeen: number
  }

  /** Callback to start a chat */
  onChat: () => void

  /** Callback to start a call */
  onCall: () => void

  /** Callback to verify identity */
  onVerify: () => void
}
```

- Uses existing `NeonCard` with `glow` based on status
- Shows peer ID (truncated), display name, status, verification badge
- Action buttons using `NeonButton size="small"`

### PeerInvite

Manual connection dialog for serverless P2P.

```typescript
interface PeerInviteProps {
  /** Whether the dialog is open */
  isOpen: boolean

  /** Callback to close */
  onClose: () => void
}
```

**Tabs:**

1. **Create Invite**: Generate connection string/QR code
2. **Accept Invite**: Paste connection string or scan QR code

```
+----------------------------------------------+
| Connect to Peer                          [×] |
+----------------------------------------------+
| [Create Invite] [Accept Invite]              |
+----------------------------------------------+
|                                              |
|  Your connection string:                     |
|  +----------------------------------------+  |
|  | eyJzZHAiOiJ2PTA...                    |  |
|  +----------------------------------------+  |
|  [📋 Copy]  [📱 QR Code]                    |
|                                              |
|  Share this with your peer, then wait for    |
|  their response.                             |
|                                              |
+----------------------------------------------+
```

- Uses existing `Modal`, `NeonButton`, `TextArea` components
- Uses existing `Tabs` compound component for Create/Accept tabs

### ConnectionDialog

Modal showing connection progress/status.

```typescript
interface ConnectionDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean

  /** Peer being connected to */
  peerDisplayName: string

  /** Current connection stage */
  stage: 'signaling' | 'ice' | 'dtls' | 'handshake' | 'connected' | 'failed'

  /** Error message if failed */
  error?: string

  /** Callback to retry */
  onRetry: () => void

  /** Callback to cancel/close */
  onClose: () => void
}
```

**Progress visualization:**

```
+----------------------------------------------+
| Connecting to Alice                      [×] |
+----------------------------------------------+
|                                              |
|  [✓] Signaling         Exchange SDP          |
|  [✓] ICE               Finding best path     |
|  [●] DTLS              Encrypting...         |
|  [ ] Handshake          Waiting...            |
|                                              |
|  [Cancel]                                    |
+----------------------------------------------+
```

- Uses `LoadingSpinner` for active stage
- `var(--neon-green)` checkmark for completed stages
- `var(--neon-red)` X for failed stage

---

## Settings Components

### MediaSettings

Camera, microphone, and speaker selection with live preview.

```typescript
interface MediaSettingsProps {
  /** Callback when settings change */
  onSave?: () => void
}
```

**Layout:**

```
+----------------------------------------------+
| Media Settings                               |
+----------------------------------------------+
| Camera:      [Logitech HD Pro ▼]             |
| +--------------------+                       |
| |                    |  (live preview)        |
| |  Camera Preview    |                       |
| +--------------------+                       |
|                                              |
| Microphone:  [Built-in Microphone ▼]         |
| [===========■========] (level meter)         |
|                                              |
| Speaker:     [Default Output ▼]              |
| [🔊 Test]                                    |
+----------------------------------------------+
```

- Uses `DeviceSelector` for each device type
- Live camera preview via `<video>` element
- Audio level meter using `ProgressBar` component

### QualitySettings

Video quality and codec preferences.

```typescript
interface QualitySettingsProps {}
```

**Layout:**

```
+----------------------------------------------+
| Quality Settings                             |
+----------------------------------------------+
| Video Quality:                               |
|  ○ Low    (320×240 / 15fps)                  |
|  ○ Medium (640×480 / 24fps)                  |
|  ● High   (1280×720 / 30fps)  [Default]      |
|  ○ Ultra  (1920×1080 / 30fps)                |
|  ○ Adaptive (automatic)                      |
|                                              |
| Preferred Codec:                             |
|  ● Auto (recommended)                        |
|  ○ H.264 (best hardware support)             |
|  ○ VP9 (better compression)                  |
|  ○ VP8 (maximum compatibility)               |
+----------------------------------------------+
```

- Uses existing `Radio` component for selections
- Uses `settings-store` for persistence

### NetworkSettings

STUN/TURN and signaling server configuration.

```typescript
interface NetworkSettingsProps {}
```

**Layout:**

```
+----------------------------------------------+
| Network Settings                             |
+----------------------------------------------+
| Signaling Server:                            |
| [ws://localhost:8080              ]          |
| [ ] Auto-connect on startup                 |
|                                              |
| STUN Servers:                                |
| [stun:stun.l.google.com:19302    ] [×]      |
| [stun:stun1.l.google.com:19302   ] [×]      |
| [+ Add STUN server]                         |
|                                              |
| TURN Server:                                |
| URL:        [turn:turn.example.com:3478]     |
| Username:   [user                      ]     |
| Password:   [••••••                    ]     |
|                                              |
| [Reset to Defaults]                          |
+----------------------------------------------+
```

- Uses existing `NeonInput` for text fields
- Uses existing `Checkbox` for auto-connect toggle
- Uses existing `NeonButton variant="danger"` for reset

---

## Layout Integration

### How New Components Fit into MainLayout

```
+------------------------------------------------------------------+
| TitleBar                                                    [–][□][×]|
+----------+-------------------------------------------------------+
|          |  ChatHeader                                           |
| Sidebar  |  Alice  ● Online           [📞] [📹] [⋮]             |
|          +-------------------------------------------------------+
| [💬]     |                                                       |
| [👥]     |  ChatView                                             |
| [⚙️]     |                                                       |
|          |  Messages...                                          |
|          |                                                       |
|          +-------------------------------------------------------+
|          |  ChatInput                                             |
|          |  [Type a message...                     ] [Send ▶]     |
+----------+-------------------------------------------------------+
| StatusBar  Connected to 3 peers  |  ▂▃▅ Good  |  v0.1.0         |
+------------------------------------------------------------------+
```

### Sidebar Tabs

Extend the existing `Sidebar` component with new tabs:

```typescript
const sidebarTabs: SidebarTab[] = [
  { id: 'chats',    label: 'Chats',    icon: '💬' },
  { id: 'peers',    label: 'Peers',    icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]
```

| Tab | Content |
|-----|---------|
| `chats` | `ChatList` component |
| `peers` | `PeerList` component |
| `settings` | `MediaSettings`, `QualitySettings`, `NetworkSettings` |

### StatusBar Integration

Update `StatusBar` to show P2P status:

```typescript
// Use existing StatusBar props
<StatusBar
  status={connectedPeerCount > 0 ? 'online' : 'offline'}
  statusText={`Connected to ${connectedPeerCount} peer${connectedPeerCount !== 1 ? 's' : ''}`}
  version="0.1.0"
/>
```

### Video Call Overlay

During active video calls, overlay the VideoGrid:

```
+------------------------------------------------------------------+
| TitleBar                                                          |
+------------------------------------------------------------------+
|                                                                  |
|                     VideoGrid                                    |
|     +------------------+  +------------------+                   |
|     |                  |  |                  |                   |
|     |   Remote Video   |  |   Local Video    |                   |
|     |                  |  |                  |                   |
|     +------------------+  +------------------+                   |
|                                                                  |
+------------------------------------------------------------------+
| MediaControls                                                    |
| [🎤 Mute] [📹 Camera] [🖥️ Screen] [⚙️]            [📞 End]      |
+------------------------------------------------------------------+
```

The VideoGrid replaces the main content area during calls. The chat sidebar can be toggled to appear alongside the video.

---

*Previous: [IPC API ←](./10-ipc-api.md) · Next: [Implementation Phases →](./12-implementation-phases.md)*
