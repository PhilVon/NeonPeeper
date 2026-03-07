import { openDB, type IDBPDatabase } from 'idb'
import type { StoredMessage, StoredChat } from '../types/chat'

const DB_NAME = 'neon-peeper-chat'
const DB_VERSION = 1

interface NeonPeeperDB {
  messages: {
    key: string
    value: StoredMessage
    indexes: {
      'by-chat': string
      'by-timestamp': number
      'by-chat-timestamp': [string, number]
    }
  }
  chats: {
    key: string
    value: StoredChat
    indexes: {
      'by-last-activity': number
      'by-state': string
    }
  }
}

class PersistenceManager {
  private db: IDBPDatabase<NeonPeeperDB> | null = null

  async init(): Promise<void> {
    this.db = await openDB<NeonPeeperDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Messages store
        const messagesStore = db.createObjectStore('messages', { keyPath: 'id' })
        messagesStore.createIndex('by-chat', 'chatId')
        messagesStore.createIndex('by-timestamp', 'timestamp')
        messagesStore.createIndex('by-chat-timestamp', ['chatId', 'timestamp'])

        // Chats store
        const chatsStore = db.createObjectStore('chats', { keyPath: 'id' })
        chatsStore.createIndex('by-last-activity', 'lastActivity')
        chatsStore.createIndex('by-state', 'state')
      },
    })
  }

  private ensureDb(): IDBPDatabase<NeonPeeperDB> {
    if (!this.db) throw new Error('PersistenceManager not initialized')
    return this.db
  }

  // --- Messages ---

  async storeMessage(message: StoredMessage): Promise<void> {
    const db = this.ensureDb()
    await db.put('messages', message)
  }

  async getMessages(chatId: string, limit = 50, before?: number): Promise<StoredMessage[]> {
    const db = this.ensureDb()
    const index = db.transaction('messages', 'readonly').store.index('by-chat-timestamp')

    const upperBound: [string, number] = [chatId, before ?? Date.now()]
    const lowerBound: [string, number] = [chatId, 0]

    const results: StoredMessage[] = []
    let cursor = await index.openCursor(
      IDBKeyRange.bound(lowerBound, upperBound, false, before != null),
      'prev'
    )

    while (cursor && results.length < limit) {
      results.push(cursor.value)
      cursor = await cursor.continue()
    }

    return results.reverse()
  }

  async updateMessageStatus(messageId: string, status: StoredMessage['status']): Promise<void> {
    const db = this.ensureDb()
    const msg = await db.get('messages', messageId)
    if (msg) {
      msg.status = status
      await db.put('messages', msg)
    }
  }

  async updateMessageContent(messageId: string, content: string, editedAt: number): Promise<void> {
    const db = this.ensureDb()
    const msg = await db.get('messages', messageId)
    if (msg) {
      msg.edited = { editedAt, originalContent: msg.edited?.originalContent ?? msg.content }
      msg.content = content
      await db.put('messages', msg)
    }
  }

  async markMessageDeleted(messageId: string): Promise<void> {
    const db = this.ensureDb()
    const msg = await db.get('messages', messageId)
    if (msg) {
      msg.deleted = true
      msg.content = ''
      await db.put('messages', msg)
    }
  }

  // --- Chats ---

  async storeChat(chat: StoredChat): Promise<void> {
    const db = this.ensureDb()
    await db.put('chats', chat)
  }

  async getActiveChats(): Promise<StoredChat[]> {
    const db = this.ensureDb()
    const index = db.transaction('chats', 'readonly').store.index('by-last-activity')
    const results: StoredChat[] = []
    let cursor = await index.openCursor(null, 'prev')

    while (cursor) {
      if (cursor.value.state !== 'left' && cursor.value.state !== 'archived') {
        results.push(cursor.value)
      }
      cursor = await cursor.continue()
    }

    return results
  }

  async getChat(chatId: string): Promise<StoredChat | undefined> {
    const db = this.ensureDb()
    return db.get('chats', chatId)
  }

  async updateChatLastActivity(chatId: string, lastActivity: number, lastMessageId: string): Promise<void> {
    const db = this.ensureDb()
    const chat = await db.get('chats', chatId)
    if (chat) {
      chat.lastActivity = lastActivity
      chat.lastMessageId = lastMessageId
      await db.put('chats', chat)
    }
  }
}

// Singleton
let instance: PersistenceManager | null = null

export function getPersistenceManager(): PersistenceManager {
  if (!instance) {
    instance = new PersistenceManager()
  }
  return instance
}
