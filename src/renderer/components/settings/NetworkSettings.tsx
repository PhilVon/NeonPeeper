import { NeonInput } from '../ui/NeonInput'
import { Toggle } from '../ui/Toggle'
import { useSettingsStore } from '../../store/settings-store'
import './NetworkSettings.css'

export function NetworkSettings() {
  const signalingUrl = useSettingsStore((s) => s.signalingUrl)
  const autoConnect = useSettingsStore((s) => s.autoConnect)
  const stunServers = useSettingsStore((s) => s.stunServers)
  const turnServer = useSettingsStore((s) => s.turnServer)
  const turnUsername = useSettingsStore((s) => s.turnUsername)
  const turnPassword = useSettingsStore((s) => s.turnPassword)

  const setSignalingUrl = useSettingsStore((s) => s.setSignalingUrl)
  const setAutoConnect = useSettingsStore((s) => s.setAutoConnect)
  const setStunServers = useSettingsStore((s) => s.setStunServers)
  const setTurnServer = useSettingsStore((s) => s.setTurnServer)
  const setTurnCredentials = useSettingsStore((s) => s.setTurnCredentials)

  return (
    <div className="network-settings">
      <h3>Network</h3>

      <NeonInput
        label="Signaling Server URL"
        value={signalingUrl}
        onChange={(e) => setSignalingUrl(e.target.value)}
        placeholder="ws://localhost:8080"
      />

      <Toggle
        label="Auto-connect on startup"
        checked={autoConnect}
        onChange={(e) => setAutoConnect(e.target.checked)}
        color="cyan"
      />

      <NeonInput
        label="STUN Servers (comma-separated)"
        value={stunServers.join(', ')}
        onChange={(e) =>
          setStunServers(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
        }
        placeholder="stun:stun.l.google.com:19302"
      />

      <NeonInput
        label="TURN Server"
        value={turnServer}
        onChange={(e) => setTurnServer(e.target.value)}
        placeholder="turn:turn.example.com:3478"
      />

      <NeonInput
        label="TURN Username"
        value={turnUsername}
        onChange={(e) => setTurnCredentials(e.target.value, turnPassword)}
      />

      <NeonInput
        label="TURN Password"
        type="password"
        value={turnPassword}
        onChange={(e) => setTurnCredentials(turnUsername, e.target.value)}
      />
    </div>
  )
}
