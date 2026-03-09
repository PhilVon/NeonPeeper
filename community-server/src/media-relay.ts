interface VoiceParticipant {
  peerId: string
  mediaType: string
}

interface VoiceSession {
  channelId: string
  participants: Map<string, VoiceParticipant>
}

export class MediaRelay {
  private sessions = new Map<string, VoiceSession>()

  joinSession(channelId: string, peerId: string, mediaType: string): void {
    let session = this.sessions.get(channelId)
    if (!session) {
      session = { channelId, participants: new Map() }
      this.sessions.set(channelId, session)
    }
    session.participants.set(peerId, { peerId, mediaType })
  }

  leaveSession(channelId: string, peerId: string): void {
    const session = this.sessions.get(channelId)
    if (!session) return
    session.participants.delete(peerId)
    if (session.participants.size === 0) {
      this.sessions.delete(channelId)
    }
  }

  leaveAllSessions(peerId: string): string[] {
    const leftChannels: string[] = []
    for (const [channelId, session] of this.sessions) {
      if (session.participants.has(peerId)) {
        session.participants.delete(peerId)
        leftChannels.push(channelId)
        if (session.participants.size === 0) {
          this.sessions.delete(channelId)
        }
      }
    }
    return leftChannels
  }

  getParticipants(channelId: string): VoiceParticipant[] {
    const session = this.sessions.get(channelId)
    if (!session) return []
    return Array.from(session.participants.values())
  }

  isInSession(channelId: string, peerId: string): boolean {
    const session = this.sessions.get(channelId)
    return session?.participants.has(peerId) ?? false
  }
}
