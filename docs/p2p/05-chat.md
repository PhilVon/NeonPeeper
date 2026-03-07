# P2P Chat System — Chat

> Chat sessions, message delivery, persistence, and group routing.

---

## Table of Contents

- [Chat Types](#chat-types)
- [Session Lifecycle](#session-lifecycle)
- [Message Delivery](#message-delivery)
- [Delivery Receipts](#delivery-receipts)
- [Offline Reconnection Sync](#offline-reconnection-sync)
- [IndexedDB Persistence](#indexeddb-persistence)
- [Chat Store](#chat-store)
- [Group Chat Routing](#group-chat-routing)

---

## Chat Types

| Type | Peers | Topology | Creation |
|------|-------|----------|----------|
| **Direct** | 2 | Single RTCPeerConnection | Automatic on first message to a peer |
| **Group** | 3–12+ | Mesh (≤6) or SFU (7+) | Explicit via `CHAT_CREATE` message |

### Direct Chat

- Created implicitly when you send the first message to a peer
- Chat ID is deterministic: `direct:${sorted([peerA, peerB]).join(':')}`
- Always exactly 2 members
- Cannot be converted to group

### Group Chat

- Created explicitly via `CHAT_CREATE` with `type: 'group'`
- Chat ID is a UUIDv4 assigned by the creator
- Members can be invited (`CHAT_INVITE`) or leave (`CHAT_LEAVE`)
- Creator has no special privileges after creation
- Maximum recommended size: 12 peers (mesh ≤6, SFU for 7+)

---

## Session Lifecycle

```
  +---------+
  | CREATED |  (CHAT_CREATE sent/received)
  +----+----+
       |
  +----v----+
  | ACTIVE  |  (messages flowing, members connected)
  +----+----+
       |
       +----------+----------+
       |                     |
  +----v----+          +-----v-----+
  | ARCHIVED|          |   LEFT    |
  | (local) |          | (CHAT_LEAVE sent)
  +---------+          +-----------+
```

### States

| State | Description | Triggers |
|-------|-------------|----------|
| `created` | Session initialized, waiting for first message | `CHAT_CREATE` received |
| `active` | Messages flowing between members | First message or `CHAT_JOIN` |
| `archived` | Hidden from main list (local-only, can be unarchived) | User action |
| `left` | User left the group (stop receiving messages) | `CHAT_LEAVE` sent |

---

## Message Delivery

### Best-Effort Delivery

P2P chat has no central server to queue messages. Delivery guarantees:

| Scenario | Behavior |
|----------|----------|
| Both peers online and connected | Message delivered immediately via DataChannel |
| Peer temporarily disconnected | Message queued locally, delivered on reconnect |
| Peer offline (app closed) | Message stored locally, synced when peer comes back online |
| Peer permanently gone | Message stays in local storage only |

### Local Send Queue

When a peer is temporarily disconnected, messages queue in memory:

```typescript
interface QueuedMessage {
  message: NeonP2PMessage
  attempts: number
  firstAttempt: number
  lastAttempt: number
}

// Queue management
const sendQueue = new Map<string, QueuedMessage[]>()  // peerId -> queued messages

function queueMessage(peerId: string, message: NeonP2PMessage): void {
  const queue = sendQueue.get(peerId) || []
  queue.push({
    message,
    attempts: 0,
    firstAttempt: Date.now(),
    lastAttempt: Date.now()
  })
  sendQueue.set(peerId, queue)
}

// Flush queue when peer reconnects
function flushQueue(peerId: string, dataChannel: RTCDataChannel): void {
  const queue = sendQueue.get(peerId) || []
  for (const item of queue) {
    dataChannel.send(JSON.stringify(item.message))
  }
  sendQueue.delete(peerId)
}
```

### Message Ordering

- Messages within a DataChannel are ordered (reliable mode)
- Cross-peer message ordering in group chats is **not guaranteed**
- Display messages sorted by `timestamp` (sender's clock)
- For conflicting timestamps, secondary sort by `id`

---

## Delivery Receipts

### Flow

```
  Sender                           Receiver
    |                                 |
    |--- TEXT (id: "abc") ---------->|
    |                                 |
    |                                 | Message received & stored
    |                                 |
    |<-- TEXT_ACK (messageId: "abc",  |
    |     status: "delivered") ------|
    |                                 |
    | Show single checkmark (✓)       |
    |                                 |
    |                                 | User opens chat / scrolls to message
    |                                 |
    |<-- TEXT_ACK (messageId: "abc",  |
    |     status: "read") -----------|
    |                                 |
    | Show double checkmark (✓✓)      |
```

### Receipt Rules

1. Send `delivered` ACK immediately when a TEXT is received and persisted
2. Send `read` ACK when the message is visible in the active chat view
3. `read` implies `delivered` — no need to send both if the user is already viewing the chat
4. In group chats, each peer sends their own ACK independently
5. Store receipt status per-peer in group chats

### Receipt Status Display

| Status | Display | Condition |
|--------|---------|-----------|
| `sent` | No checkmark | Message sent, no ACK received |
| `delivered` | ✓ (single) | At least one `delivered` ACK received |
| `read` | ✓✓ (double) | At least one `read` ACK received |

For group chats, show the "worst" status across all members:
- All read → ✓✓
- Some delivered, none read → ✓
- None acknowledged → no checkmark

---

## Offline Reconnection Sync

When two peers reconnect after being offline, they sync missed messages:

```
  Peer A (reconnecting)           Peer B (was online)
    |                               |
    | [HELLO / HELLO_ACK exchange]  |
    |                               |
    |--- CHAT_SYNC (request) ----->|
    |    chatId: "chat-123"         |
    |    lastMessageId: "msg-50"    |
    |                               |
    |                               | Query IndexedDB for messages
    |                               | after "msg-50" in "chat-123"
    |                               |
    |<-- CHAT_SYNC (response) -----|
    |    messages: [msg-51..msg-55] |
    |                               |
    | Store synced messages          |
    | Display in chat                |
```

### Sync Rules

1. After HELLO/HELLO_ACK, each peer sends `CHAT_SYNC` requests for all shared chats
2. Include `lastMessageId` — the ID of the most recent message from that peer
3. Responder returns all messages sent after `lastMessageId`
4. Limit sync response to **100 messages** per request (paginate if needed)
5. Deduplicate by message `id` on the receiving side

---

## IndexedDB Persistence

### Database Schema

```typescript
// Database name: 'neon-peeper-chat'
// Version: 1

interface ChatDatabase {
  messages: StoredMessage
  chats: StoredChat
}
```

### StoredMessage

```typescript
interface StoredMessage {
  /** Message ID (UUIDv4) — primary key */
  id: string

  /** Chat session this message belongs to — indexed */
  chatId: string

  /** Sender's peer ID */
  from: string

  /** Message content */
  content: string

  /** Unix timestamp (ms) — indexed */
  timestamp: number

  /** Delivery status */
  status: 'sent' | 'delivered' | 'read'

  /** Per-peer receipt status (for group chats) */
  receipts?: Record<string, 'delivered' | 'read'>

  /** ID of message being replied to */
  replyTo?: string

  /** Edit metadata */
  edited?: {
    editedAt: number
    originalContent: string
  }

  /** Soft delete flag */
  deleted?: boolean
}
```

### StoredChat

```typescript
interface StoredChat {
  /** Chat session ID — primary key */
  id: string

  /** Chat type */
  type: 'direct' | 'group'

  /** Group name (null for direct chats) */
  name: string | null

  /** Member peer IDs */
  members: string[]

  /** Chat state */
  state: 'created' | 'active' | 'archived' | 'left'

  /** Timestamp of last activity — indexed */
  lastActivity: number

  /** ID of the last message (for sync) */
  lastMessageId: string | null

  /** Unread message count */
  unreadCount: number

  /** Creation timestamp */
  createdAt: number
}
```

### IndexedDB Setup

```typescript
import { openDB, IDBPDatabase } from 'idb'

async function openChatDatabase(): Promise<IDBPDatabase<ChatDatabase>> {
  return openDB('neon-peeper-chat', 1, {
    upgrade(db) {
      // Messages store
      const messageStore = db.createObjectStore('messages', { keyPath: 'id' })
      messageStore.createIndex('by-chat', 'chatId')
      messageStore.createIndex('by-timestamp', 'timestamp')
      messageStore.createIndex('by-chat-timestamp', ['chatId', 'timestamp'])

      // Chats store
      const chatStore = db.createObjectStore('chats', { keyPath: 'id' })
      chatStore.createIndex('by-last-activity', 'lastActivity')
      chatStore.createIndex('by-state', 'state')
    }
  })
}
```

### Common Queries

```typescript
// Get recent messages for a chat (paginated)
async function getMessages(chatId: string, limit = 50, before?: number): Promise<StoredMessage[]> {
  const db = await openChatDatabase()
  const tx = db.transaction('messages', 'readonly')
  const index = tx.store.index('by-chat-timestamp')

  const upperBound = before || Date.now()
  const range = IDBKeyRange.bound([chatId, 0], [chatId, upperBound])

  const messages = await index.getAll(range)
  return messages.slice(-limit)  // Last N messages
}

// Get all active chats, sorted by last activity
async function getActiveChats(): Promise<StoredChat[]> {
  const db = await openChatDatabase()
  const chats = await db.getAllFromIndex('chats', 'by-state', 'active')
  return chats.sort((a, b) => b.lastActivity - a.lastActivity)
}

// Store a new message
async function storeMessage(message: StoredMessage): Promise<void> {
  const db = await openChatDatabase()
  const tx = db.transaction(['messages', 'chats'], 'readwrite')

  await tx.objectStore('messages').put(message)

  // Update chat's last activity
  const chat = await tx.objectStore('chats').get(message.chatId)
  if (chat) {
    chat.lastActivity = message.timestamp
    chat.lastMessageId = message.id
    if (message.from !== localPeerId) {
      chat.unreadCount++
    }
    await tx.objectStore('chats').put(chat)
  }

  await tx.done
}
```

---

## Chat Store

Zustand store for chat state. Follows existing patterns from `ui-store.ts` and `toast-store.ts`.

```typescript
import { create } from 'zustand'

interface ChatMessage {
  id: string
  chatId: string
  from: string
  content: string
  timestamp: number
  status: 'sent' | 'delivered' | 'read'
  replyTo?: string
  edited?: { editedAt: number; originalContent: string }
  deleted?: boolean
}

interface Chat {
  id: string
  type: 'direct' | 'group'
  name: string | null
  members: string[]
  state: 'created' | 'active' | 'archived' | 'left'
  lastActivity: number
  lastMessageId: string | null
  unreadCount: number
}

interface ChatState {
  /** All chat sessions */
  chats: Map<string, Chat>

  /** Messages loaded in memory (per chat, most recent N) */
  messages: Map<string, ChatMessage[]>

  /** Currently active/visible chat ID */
  activeChatId: string | null

  /** Peers currently typing, per chat */
  typing: Map<string, Set<string>>

  // --- Actions ---

  /** Set the active chat and mark as read */
  setActiveChat: (chatId: string | null) => void

  /** Add or update a chat session */
  upsertChat: (chat: Chat) => void

  /** Add a message to a chat */
  addMessage: (message: ChatMessage) => void

  /** Update message status (delivery receipt) */
  updateMessageStatus: (messageId: string, chatId: string, status: 'delivered' | 'read') => void

  /** Edit a message */
  editMessage: (messageId: string, chatId: string, newContent: string) => void

  /** Soft-delete a message */
  deleteMessage: (messageId: string, chatId: string) => void

  /** Set typing state for a peer in a chat */
  setTyping: (chatId: string, peerId: string, isTyping: boolean) => void

  /** Mark all messages in a chat as read */
  markAsRead: (chatId: string) => void

  /** Load older messages (pagination) */
  loadOlderMessages: (chatId: string, messages: ChatMessage[]) => void

  /** Archive a chat */
  archiveChat: (chatId: string) => void

  /** Leave a group chat */
  leaveChat: (chatId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: new Map(),
  messages: new Map(),
  activeChatId: null,
  typing: new Map(),

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId })
    if (chatId) get().markAsRead(chatId)
  },

  upsertChat: (chat) => set((state) => {
    const chats = new Map(state.chats)
    chats.set(chat.id, chat)
    return { chats }
  }),

  addMessage: (message) => set((state) => {
    const messages = new Map(state.messages)
    const chatMessages = [...(messages.get(message.chatId) || []), message]
    messages.set(message.chatId, chatMessages)

    // Update chat metadata
    const chats = new Map(state.chats)
    const chat = chats.get(message.chatId)
    if (chat) {
      chats.set(message.chatId, {
        ...chat,
        lastActivity: message.timestamp,
        lastMessageId: message.id,
        unreadCount: message.chatId === state.activeChatId
          ? chat.unreadCount
          : chat.unreadCount + 1
      })
    }

    return { messages, chats }
  }),

  updateMessageStatus: (messageId, chatId, status) => set((state) => {
    const messages = new Map(state.messages)
    const chatMessages = (messages.get(chatId) || []).map(msg =>
      msg.id === messageId ? { ...msg, status } : msg
    )
    messages.set(chatId, chatMessages)
    return { messages }
  }),

  editMessage: (messageId, chatId, newContent) => set((state) => {
    const messages = new Map(state.messages)
    const chatMessages = (messages.get(chatId) || []).map(msg =>
      msg.id === messageId
        ? {
            ...msg,
            content: newContent,
            edited: { editedAt: Date.now(), originalContent: msg.content }
          }
        : msg
    )
    messages.set(chatId, chatMessages)
    return { messages }
  }),

  deleteMessage: (messageId, chatId) => set((state) => {
    const messages = new Map(state.messages)
    const chatMessages = (messages.get(chatId) || []).map(msg =>
      msg.id === messageId ? { ...msg, deleted: true } : msg
    )
    messages.set(chatId, chatMessages)
    return { messages }
  }),

  setTyping: (chatId, peerId, isTyping) => set((state) => {
    const typing = new Map(state.typing)
    const chatTyping = new Set(typing.get(chatId) || [])
    if (isTyping) {
      chatTyping.add(peerId)
    } else {
      chatTyping.delete(peerId)
    }
    typing.set(chatId, chatTyping)
    return { typing }
  }),

  markAsRead: (chatId) => set((state) => {
    const chats = new Map(state.chats)
    const chat = chats.get(chatId)
    if (chat) {
      chats.set(chatId, { ...chat, unreadCount: 0 })
    }
    return { chats }
  }),

  loadOlderMessages: (chatId, olderMessages) => set((state) => {
    const messages = new Map(state.messages)
    const existing = messages.get(chatId) || []
    messages.set(chatId, [...olderMessages, ...existing])
    return { messages }
  }),

  archiveChat: (chatId) => set((state) => {
    const chats = new Map(state.chats)
    const chat = chats.get(chatId)
    if (chat) {
      chats.set(chatId, { ...chat, state: 'archived' })
    }
    return { chats }
  }),

  leaveChat: (chatId) => set((state) => {
    const chats = new Map(state.chats)
    const chat = chats.get(chatId)
    if (chat) {
      chats.set(chatId, { ...chat, state: 'left' })
    }
    return { chats }
  }),
}))
```

---

## Group Chat Routing

### Mesh Fan-Out

In mesh topology, the sender is responsible for delivering to all group members:

```typescript
function sendGroupMessage(chatId: string, message: NeonP2PMessage): void {
  const chat = chatStore.getState().chats.get(chatId)
  if (!chat) return

  // Send to each member except self
  for (const memberId of chat.members) {
    if (memberId === localPeerId) continue

    const channel = connectionManager.getDataChannel(memberId)
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({
        ...message,
        to: memberId  // Address to specific peer (even though it's a group message)
      }))
    } else {
      // Queue for later delivery
      queueMessage(memberId, message)
    }
  }
}
```

### Deduplication

Group messages can potentially arrive twice (e.g., during reconnection sync). Deduplicate by message ID:

```typescript
const seenMessageIds = new Set<string>()

function handleIncomingMessage(msg: NeonP2PMessage<TextPayload>): void {
  if (seenMessageIds.has(msg.id)) return  // Already processed

  seenMessageIds.add(msg.id)
  // Process message...

  // Prune old IDs periodically (keep last 10,000)
  if (seenMessageIds.size > 10_000) {
    const ids = Array.from(seenMessageIds)
    seenMessageIds.clear()
    ids.slice(-5_000).forEach(id => seenMessageIds.add(id))
  }
}
```

### Member Management

```typescript
// When a peer is invited to a group
function handleChatInvite(msg: NeonP2PMessage<ChatInvitePayload>): void {
  const { chatId, chatName, members } = msg.payload

  // Create local chat session
  chatStore.getState().upsertChat({
    id: chatId,
    type: 'group',
    name: chatName || null,
    members,
    state: 'active',
    lastActivity: msg.timestamp,
    lastMessageId: null,
    unreadCount: 0
  })

  // Announce join to all members
  broadcastToChat(chatId, {
    type: 'CHAT_JOIN',
    payload: { chatId, peerId: localPeerId, displayName: localDisplayName }
  })
}

// When a peer leaves a group
function handleChatLeave(msg: NeonP2PMessage<ChatLeavePayload>): void {
  const { chatId, peerId } = msg.payload
  const chat = chatStore.getState().chats.get(chatId)
  if (!chat) return

  // Remove from member list
  chatStore.getState().upsertChat({
    ...chat,
    members: chat.members.filter(id => id !== peerId)
  })
}
```

---

## Signaling Room Coordination

Group chats use signaling server rooms for online member discovery and crash detection. Direct chats never use rooms.

### When Rooms Are Used

Only **group chats** (`type: 'group'`) interact with signaling rooms. The `roomId` equals the `chatId`. Direct chats operate entirely over their single RTCPeerConnection.

### Room Join Triggers

| Trigger | Location |
|---------|----------|
| User creates a group chat | `CreateGroupChat.tsx` — after sending `CHAT_CREATE` to peers |
| `CHAT_CREATE` received from another peer | `MessageRouter.handleChatCreate` — after upserting chat |
| `CHAT_INVITE` received | `MessageRouter.handleChatInvite` — after upserting chat |
| Signaling server reconnect | `App.tsx` — on `connected-and-registered` event, rejoins all active group rooms |

### Room Leave Triggers

| Trigger | Location |
|---------|----------|
| `CHAT_LEAVE` for local peer | `MessageRouter.handleChatLeave` — when `peerId === localId` |
| Signaling disconnect | `SignalingClient.disconnect()` — clears `joinedRooms` set |

### Crash Detection Flow

```
1. Peer crashes (app killed, network drops)
2. Signaling server heartbeat times out (~40s)
3. Server broadcasts peer-left with roomId to remaining room members
4. Client receives room-peer-left event
5. UI logs disconnect — NO membership change (peer didn't voluntarily leave)
6. Crashed peer restarts app → reconnects to signaling → rejoins rooms
7. Peer sends CHAT_SYNC to catch up on missed messages
```

The key distinction: **`peer-left` with `roomId`** means crash/disconnect (transient), while **`CHAT_LEAVE`** means voluntary departure (permanent membership change).

### Signaling Unavailable

When the signaling server is unreachable, all room operations (`joinRoom`, `leaveRoom`) silently no-op because `send()` checks `ws.readyState === WebSocket.OPEN`. Chat still works fully over existing DataChannel connections — only room-based crash detection is lost.

---

*Previous: [Signaling Server ←](./04-signaling-server.md) · Next: [Media →](./06-media.md)*
