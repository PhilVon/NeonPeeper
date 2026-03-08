import { useChatStore } from '../store/chat-store'
import { getPersistenceManager } from './PersistenceManager'
import type { ChatMessage } from '../types/chat'

const SWEEP_INTERVAL_MS = 5_000

interface ScheduledDeletion {
  chatId: string
  expiresAt: number
}

export class EphemeralMessageManager {
  private scheduled = new Map<string, ScheduledDeletion>()
  private intervalId: ReturnType<typeof setInterval> | null = null

  scheduleDelete(messageId: string, chatId: string, timestamp: number, ttl: number): void {
    if (!ttl || ttl <= 0) return
    this.scheduled.set(messageId, {
      chatId,
      expiresAt: timestamp + ttl,
    })
    this.ensureRunning()
  }

  rescheduleFromMessages(messages: ChatMessage[]): void {
    for (const msg of messages) {
      if (msg.ttl && msg.ttl > 0 && !msg.deleted) {
        this.scheduleDelete(msg.id, msg.chatId, msg.timestamp, msg.ttl)
      }
    }
  }

  private ensureRunning(): void {
    if (this.intervalId !== null) return
    if (this.scheduled.size === 0) return
    this.intervalId = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
  }

  private sweep(): void {
    const now = Date.now()
    const toDelete: Array<{ messageId: string; chatId: string }> = []

    for (const [messageId, entry] of this.scheduled) {
      if (now >= entry.expiresAt) {
        toDelete.push({ messageId, chatId: entry.chatId })
        this.scheduled.delete(messageId)
      }
    }

    for (const { messageId, chatId } of toDelete) {
      useChatStore.getState().deleteMessage(messageId, chatId)
      getPersistenceManager().markMessageDeleted(messageId).catch(() => {})
    }

    if (this.scheduled.size === 0) {
      this.stop()
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// Singleton
let instance: EphemeralMessageManager | null = null

export function getEphemeralMessageManager(): EphemeralMessageManager {
  if (!instance) {
    instance = new EphemeralMessageManager()
  }
  return instance
}
