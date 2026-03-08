import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { MainLayout } from './components/layout/MainLayout'
import { DemoSuite } from './components/demo/DemoSuite'
import { ToastContainer } from './components/ui/Toast'
import { NeonButton } from './components/ui/NeonButton'
import { NeonInput } from './components/ui/NeonInput'
import { Toggle } from './components/ui/Toggle'
import { Tabs, TabList, Tab, TabPanel } from './components/ui/Tabs'
import { Avatar } from './components/ui/Avatar'
import { ImageEditor } from './components/ui/ImageEditor'
import { PeerInvite } from './components/peers/PeerInvite'
import { PeerList } from './components/peers/PeerList'
import { ChatList } from './components/chat/ChatList'
import { ChatView } from './components/chat/ChatView'
import { CreateGroupChat } from './components/chat/CreateGroupChat'
import { EmojiManager } from './components/settings/EmojiManager'
import { MediaSettings } from './components/settings/MediaSettings'
import { QualitySettings } from './components/settings/QualitySettings'
import { NetworkSettings } from './components/settings/NetworkSettings'
import { toast } from './store/toast-store'
import { useUIStore } from './store/ui-store'
import { usePeerStore } from './store/peer-store'
import { useChatStore } from './store/chat-store'
import { useSettingsStore } from './store/settings-store'
import { useMediaStore } from './store/media-store'
import { useConnectionStore } from './store/connection-store'
import { useEmojiStore } from './store/emoji-store'
import { getConnectionManager } from './services/ConnectionManager'
import { getMessageRouter } from './services/MessageRouter'
import { getPersistenceManager } from './services/PersistenceManager'
import { getSignalingClient } from './services/SignalingClient'
import { getMediaManager } from './services/MediaManager'
import { getCryptoManager } from './services/CryptoManager'
import { getPerformanceMonitor } from './services/PerformanceMonitor'
import { generateDirectChatId } from './types/chat'
import { createMessage } from './types/protocol'
import { DEFAULT_RECONNECTION_CONFIG } from './types/peer'
import type { QualityPreset } from './types/protocol'
import './App.css'

type AppTab = 'chats' | 'peers' | 'demo' | 'settings'

const SIDEBAR_TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'peers', label: 'Peers' },
  { id: 'demo', label: 'Demo' },
  { id: 'settings', label: 'Settings' },
]

export function App() {
  const crtEnabled = useUIStore((state) => state.crtEnabled)
  const [activeTab, setActiveTab] = useState<AppTab>('peers')
  const [showPeerInvite, setShowPeerInvite] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const localProfile = usePeerStore((s) => s.localProfile)
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const activeChat = activeChatId ? chats.get(activeChatId) : undefined
  const isAnyVideoSharing = useMediaStore((s) => s.videoSharingChatIds.size > 0)

  // Settings
  const displayName = useSettingsStore((s) => s.displayName)
  const signalingUrl = useSettingsStore((s) => s.signalingUrl)
  const autoConnect = useSettingsStore((s) => s.autoConnect)

  // Initialize local profile on mount
  useEffect(() => {
    if (!localProfile) {
      const id = uuidv4().replace(/-/g, '').slice(0, 32)
      const profile = {
        id,
        displayName: useSettingsStore.getState().displayName,
        avatarDataUrl: useSettingsStore.getState().avatarDataUrl || undefined,
        publicKey: '',
        capabilities: ['text', 'media', 'screen-share'],
      }
      usePeerStore.getState().setLocalProfile(profile)

      // Generate crypto keypair and update publicKey
      getCryptoManager().generateKeyPair()
        .then(() => getCryptoManager().getPublicKeyHex())
        .then((publicKey) => {
          const current = usePeerStore.getState().localProfile
          if (current) {
            usePeerStore.getState().setLocalProfile({ ...current, publicKey })
          }
        })
        .catch((err) => console.error('Failed to generate keypair:', err))
    }
  }, [localProfile])

  // Sync display name
  useEffect(() => {
    const profile = usePeerStore.getState().localProfile
    if (profile && profile.displayName !== displayName) {
      usePeerStore.getState().setLocalProfile({ ...profile, displayName })
    }
  }, [displayName])

  // Sync avatar and broadcast PROFILE_UPDATE to connected peers
  const avatarDataUrl = useSettingsStore((s) => s.avatarDataUrl)
  useEffect(() => {
    const profile = usePeerStore.getState().localProfile
    if (profile) {
      usePeerStore.getState().setLocalProfile({ ...profile, avatarDataUrl: avatarDataUrl || undefined })

      // Broadcast to all connected peers
      const cm = getConnectionManager()
      for (const peerId of cm.getConnectedPeerIds()) {
        const msg = createMessage('PROFILE_UPDATE', profile.id, peerId, {
          displayName: profile.displayName,
          avatarDataUrl: avatarDataUrl || undefined,
        })
        cm.sendMessage(peerId, msg)
      }
    }
  }, [avatarDataUrl])

  // Initialize PersistenceManager, load chats, and load emoji store
  useEffect(() => {
    const pm = getPersistenceManager()
    pm.init().then(async () => {
      const storedChats = await pm.getActiveChats()
      for (const chat of storedChats) {
        useChatStore.getState().upsertChat({
          ...chat,
          lastMessagePreview: null,
        })
        const msgs = await pm.getMessages(chat.id, 50)
        for (const msg of msgs) {
          useChatStore.getState().addMessage({
            ...msg,
            status: msg.status ?? 'read',
          })
        }
      }
      // Load custom emojis
      await useEmojiStore.getState().loadEmojis()
    }).catch((err) => {
      console.error('Failed to init PersistenceManager:', err)
    })
  }, [])

  // Wire up ConnectionManager → MessageRouter
  useEffect(() => {
    const cm = getConnectionManager()
    const router = getMessageRouter()

    const handleMessage = (_peerId: unknown, rawData: unknown) => {
      if (typeof rawData === 'string') {
        router.routeMessage(_peerId as string, rawData)
      }
    }

    cm.on('data-channel-message', handleMessage)

    // Handle remote tracks for video calls
    const handleRemoteTrack = (peerId: unknown, streams: unknown) => {
      const streamArr = streams as MediaStream[]
      if (streamArr && streamArr.length > 0) {
        const pid = peerId as string
        const stream = streamArr[0]
        const mediaState = useMediaStore.getState()
        const existingCamera = mediaState.remoteStreams.get(pid)

        // If we already have a camera stream for this peer and the incoming
        // stream has a different ID, it's a screen share
        if (existingCamera && existingCamera.stream.id !== stream.id) {
          mediaState.addRemoteScreenStream(pid, stream)
        } else {
          mediaState.addRemoteStream(pid, stream)
        }
      }
    }
    cm.on('remote-track', handleRemoteTrack)

    return () => {
      cm.off('data-channel-message', handleMessage)
      cm.off('remote-track', handleRemoteTrack)
    }
  }, [])

  // Auto-connect to signaling server
  useEffect(() => {
    if (autoConnect && signalingUrl && localProfile) {
      const client = getSignalingClient()
      client.connect(signalingUrl)
      return () => {
        client.disconnect()
      }
    }
  }, [autoConnect, signalingUrl, localProfile])

  // Signaling room event wiring — rejoin rooms on reconnect, crash detection
  useEffect(() => {
    const client = getSignalingClient()

    // Rejoin rooms for all active group chats on (re)connect
    const handleRegistered = () => {
      const allChats = useChatStore.getState().chats
      for (const [chatId, chat] of allChats) {
        if (chat.type === 'group' && chat.state === 'active') {
          client.joinRoom(chatId)
        }
      }
    }

    // Crash detection: peer left room without sending CHAT_LEAVE
    const handleRoomPeerLeft = (roomId: unknown, peerId: unknown) => {
      const chatId = roomId as string
      const chat = useChatStore.getState().chats.get(chatId)
      if (!chat || chat.type !== 'group') return
      // No membership change — peer crashed, didn't voluntarily leave
      console.log(`[App] Peer ${peerId} disconnected from group ${chat.name || chatId}`)
    }

    client.on('connected-and-registered', handleRegistered)
    client.on('room-peer-left', handleRoomPeerLeft)

    return () => {
      client.off('connected-and-registered', handleRegistered)
      client.off('room-peer-left', handleRoomPeerLeft)
    }
  }, [])

  // Adaptive bitrate wiring (Feature 8)
  const qualityPreset = useSettingsStore((s) => s.qualityPreset)
  const qualityLadderRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!isAnyVideoSharing || qualityPreset !== 'adaptive') return

    const QUALITY_LADDER: QualityPreset[] = ['low', 'medium', 'high', 'ultra']
    const pm = getPerformanceMonitor()
    pm.start(2000)

    const unsubscribe = pm.onStats((stats) => {
      const mm = getMediaManager()
      for (const [peerId, peerStats] of stats) {
        const currentIdx = qualityLadderRef.current[peerId] ?? 2 // default to 'high'

        if (pm.shouldDowngrade(peerId, peerStats.packetLoss, peerStats.rttMs)) {
          const newIdx = Math.max(0, currentIdx - 1)
          if (newIdx !== currentIdx) {
            qualityLadderRef.current[peerId] = newIdx
            mm.applyQualityPreset(QUALITY_LADDER[newIdx], peerId)
          }
        } else if (pm.shouldUpgrade(peerId, peerStats.packetLoss, peerStats.rttMs)) {
          const newIdx = Math.min(QUALITY_LADDER.length - 1, currentIdx + 1)
          if (newIdx !== currentIdx) {
            qualityLadderRef.current[peerId] = newIdx
            mm.applyQualityPreset(QUALITY_LADDER[newIdx], peerId)
          }
        }
      }
    })

    return () => {
      unsubscribe()
      pm.stop()
      qualityLadderRef.current = {}
    }
  }, [isAnyVideoSharing, qualityPreset])

  // Auto-reconnection (Feature 10)
  const reconnectTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const cm = getConnectionManager()

    const handleDisconnect = (peerId: unknown) => {
      const pid = peerId as string

      // Clean up video state for disconnected peer
      const mediaState = useMediaStore.getState()
      for (const [chatId, participants] of mediaState.chatVideoParticipants) {
        if (participants.has(pid)) {
          mediaState.removeChatVideoParticipant(chatId, pid)
        }
      }
      mediaState.removeRemoteStream(pid)

      // Skip user-initiated disconnections
      if (cm.wasUserInitiated(pid)) {
        cm.clearUserInitiated(pid)
        return
      }

      const connInfo = useConnectionStore.getState().getConnection(pid)
      const attempts = connInfo?.reconnectAttempts ?? 0
      const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = DEFAULT_RECONNECTION_CONFIG

      if (attempts >= maxAttempts) {
        useConnectionStore.getState().setConnectionState(pid, 'failed')
        toast.error(`Connection to peer lost after ${maxAttempts} reconnection attempts`)
        return
      }

      useConnectionStore.getState().setConnectionState(pid, 'reconnecting')
      useConnectionStore.getState().incrementReconnectAttempts(pid)

      const delay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempts), maxDelayMs)
      const timer = setTimeout(() => {
        reconnectTimers.current.delete(pid)
        const client = getSignalingClient()
        if (client.getState() === 'connected') {
          client.connectToPeer(pid)
        }
      }, delay)
      reconnectTimers.current.set(pid, timer)
    }

    cm.on('peer-disconnected', handleDisconnect)

    return () => {
      cm.off('peer-disconnected', handleDisconnect)
      for (const timer of reconnectTimers.current.values()) {
        clearTimeout(timer)
      }
      reconnectTimers.current.clear()
    }
  }, [])

  const handleStartChat = useCallback((peerId: string) => {
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    const chatId = generateDirectChatId(localId, peerId)
    const peer = usePeerStore.getState().peers.get(peerId)

    if (!useChatStore.getState().chats.has(chatId)) {
      const now = Date.now()
      useChatStore.getState().upsertChat({
        id: chatId,
        type: 'direct',
        name: null,
        members: [localId, peerId],
        state: 'active',
        lastActivity: now,
        lastMessageId: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: now,
      })

      getPersistenceManager().storeChat({
        id: chatId,
        type: 'direct',
        name: peer?.displayName ?? null,
        members: [localId, peerId],
        state: 'active',
        lastActivity: now,
        lastMessageId: null,
        unreadCount: 0,
        createdAt: now,
      }).catch(() => {})
    }

    useChatStore.getState().setActiveChat(chatId)
    setActiveTab('chats')
  }, [])

  const handleConnectPeer = useCallback((peerId: string) => {
    const client = getSignalingClient()
    if (client.getState() === 'connected') {
      client.connectToPeer(peerId)
    }
  }, [])

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'chats':
        if (activeChat) {
          return (
            <ChatView
              key={activeChat.id}
              chat={activeChat}
            />
          )
        }
        return (
          <div className="app-placeholder">
            <p className="text-muted">Select a conversation or start a new chat from the Peers tab.</p>
          </div>
        )
      case 'peers':
        return (
          <PeerList
            onChat={handleStartChat}
            onConnect={handleConnectPeer}
            onManualConnect={() => setShowPeerInvite(true)}
          />
        )
      case 'demo':
        return <DemoSuite />
      case 'settings':
        return <SettingsPage />
    }
  }, [activeTab, activeChat, handleStartChat, handleConnectPeer])

  const renderSidebarContent = () => {
    if (activeTab === 'chats') {
      return <ChatList onNewChat={() => setShowCreateGroup(true)} />
    }
    return null
  }

  return (
    <div className={`app-container${crtEnabled ? ' crt-effect' : ''}`}>
      <MainLayout
        showSidebar={true}
        sidebarProps={{
          tabs: SIDEBAR_TABS,
          activeTab,
          onTabChange: (id) => setActiveTab(id as AppTab),
          children: renderSidebarContent(),
        }}
      >
        {renderContent()}
      </MainLayout>
      <ToastContainer />
      <PeerInvite isOpen={showPeerInvite} onClose={() => setShowPeerInvite(false)} />
      <CreateGroupChat
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(chatId) => {
          useChatStore.getState().setActiveChat(chatId)
          setActiveTab('chats')
        }}
      />
    </div>
  )
}

// Settings page component
function SettingsPage() {
  const displayName = useSettingsStore((s) => s.displayName)
  const signalingUrl = useSettingsStore((s) => s.signalingUrl)
  const autoConnect = useSettingsStore((s) => s.autoConnect)
  const setDisplayName = useSettingsStore((s) => s.setDisplayName)
  const setSignalingUrl = useSettingsStore((s) => s.setSignalingUrl)
  const setAutoConnect = useSettingsStore((s) => s.setAutoConnect)
  const localProfile = usePeerStore((s) => s.localProfile)

  const settingsAvatarDataUrl = useSettingsStore((s) => s.avatarDataUrl)
  const setAvatarDataUrl = useSettingsStore((s) => s.setAvatarDataUrl)
  const [showAvatarEditor, setShowAvatarEditor] = useState(false)

  const giphyApiKey = useSettingsStore((s) => s.giphyApiKey)
  const setGiphyApiKey = useSettingsStore((s) => s.setGiphyApiKey)
  const signalingClient = getSignalingClient()
  const [signalingState, setSignalingState] = useState(signalingClient.getState())

  useEffect(() => {
    const handler = (state: unknown) => setSignalingState(state as typeof signalingState)
    signalingClient.on('state-change', handler)
    return () => signalingClient.off('state-change', handler)
  }, [signalingClient])

  return (
    <div className="app-settings">
      <h2 className="text-cyan">Settings</h2>

      <Tabs defaultTab="profile">
        <TabList>
          <Tab id="profile">Profile</Tab>
          <Tab id="media">Media</Tab>
          <Tab id="network">Network</Tab>
        </TabList>

        <TabPanel id="profile">
          <section className="app-settings-section">
            <h3>Profile</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <Avatar
                name={displayName}
                src={settingsAvatarDataUrl || undefined}
                size="large"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <NeonButton size="small" variant="secondary" onClick={() => setShowAvatarEditor(true)}>
                  {settingsAvatarDataUrl ? 'Change Avatar' : 'Set Avatar'}
                </NeonButton>
                {settingsAvatarDataUrl && (
                  <NeonButton size="small" variant="danger" onClick={() => setAvatarDataUrl('')}>
                    Remove
                  </NeonButton>
                )}
              </div>
            </div>
            <NeonInput
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {localProfile && (
              <div className="app-settings-field">
                <label className="app-settings-label">Peer ID</label>
                <code className="app-settings-code">{localProfile.id}</code>
              </div>
            )}
          </section>

          <section className="app-settings-section">
            <EmojiManager />
          </section>

          <section className="app-settings-section">
            <h3>Signaling Server</h3>
            <NeonInput
              label="Server URL"
              value={signalingUrl}
              onChange={(e) => setSignalingUrl(e.target.value)}
              placeholder="ws://localhost:8080"
            />
            <Toggle
              label="Auto-connect"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
              color="cyan"
            />
            <div className="app-settings-field">
              <label className="app-settings-label">Status: {signalingState}</label>
              {signalingState !== 'connected' && (
                <NeonButton
                  size="small"
                  variant="secondary"
                  onClick={() => getSignalingClient().connect(signalingUrl)}
                >
                  Connect
                </NeonButton>
              )}
              {signalingState === 'connected' && (
                <NeonButton
                  size="small"
                  variant="danger"
                  onClick={() => getSignalingClient().disconnect()}
                >
                  Disconnect
                </NeonButton>
              )}
            </div>
          </section>

          <section className="app-settings-section">
            <h3>Integrations</h3>
            <NeonInput
              label="Giphy API Key"
              type="password"
              value={giphyApiKey}
              onChange={(e) => setGiphyApiKey(e.target.value)}
              placeholder="Enter your Giphy API key"
            />
            <p className="text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
              Get a free API key at{' '}
              <a href="https://developers.giphy.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--neon-cyan)' }}>
                developers.giphy.com
              </a>
            </p>
          </section>

          <section className="app-settings-section app-settings-danger">
            <h3>Danger Zone</h3>
            <p className="text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
              Clear all stored chats, messages, and settings. This cannot be undone.
            </p>
            <NeonButton
              variant="danger"
              size="small"
              onClick={async () => {
                if (!confirm('Clear all data? This will remove all chats, messages, and settings.')) return
                try {
                  await getPersistenceManager().clearAll()
                  useChatStore.getState().clearAll()
                  localStorage.removeItem('neon-peeper-settings')
                  toast.success('All data cleared. Reloading...')
                  setTimeout(() => window.location.reload(), 1000)
                } catch (err) {
                  console.error('Failed to clear data:', err)
                  toast.error('Failed to clear data')
                }
              }}
            >
              Clear All Data
            </NeonButton>
          </section>
        </TabPanel>

        <TabPanel id="media">
          <section className="app-settings-section">
            <MediaSettings />
          </section>

          <section className="app-settings-section">
            <QualitySettings />
          </section>
        </TabPanel>

        <TabPanel id="network">
          <section className="app-settings-section">
            <NetworkSettings />
          </section>
        </TabPanel>
      </Tabs>
      <ImageEditor
        isOpen={showAvatarEditor}
        onClose={() => setShowAvatarEditor(false)}
        onSave={(dataUrl) => setAvatarDataUrl(dataUrl)}
        mode="avatar"
        initialImage={settingsAvatarDataUrl || undefined}
      />
    </div>
  )
}
