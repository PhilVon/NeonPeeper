import { openDB, type IDBPDatabase } from 'idb'
import type { StoredMessage, StoredChat } from '../types/chat'
import type { CustomEmoji } from '../types/emoji'

const DB_NAME = 'neon-peeper-chat'
const DB_VERSION = 3

interface EmojiCacheEntry {
  id: string // peerId:shortcode
  peerId: string
  shortcode: string
  dataUrl: string
}

export interface StoredIdentityKeys {
  id: string                    // always 'local'
  signingPrivateKey: ArrayBuffer
  signingPublicKey: ArrayBuffer
  signingAlgorithm: 'Ed25519' | 'ECDSA-P256'
  dhPrivateKey: ArrayBuffer
  dhPublicKey: ArrayBuffer
  createdAt: number
}

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
  customEmojis: {
    key: string
    value: CustomEmoji
    indexes: {
      'by-shortcode': string
    }
  }
  emojiCache: {
    key: string
    value: EmojiCacheEntry
    indexes: {
      'by-peer': string
    }
  }
  identityKeys: {
    key: string
    value: StoredIdentityKeys
  }
}

class PersistenceManager {
  private db: IDBPDatabase<NeonPeeperDB> | null = null

  async init(): Promise<void> {
    this.db = await openDB<NeonPeeperDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          // Messages store
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' })
          messagesStore.createIndex('by-chat', 'chatId')
          messagesStore.createIndex('by-timestamp', 'timestamp')
          messagesStore.createIndex('by-chat-timestamp', ['chatId', 'timestamp'])

          // Chats store
          const chatsStore = db.createObjectStore('chats', { keyPath: 'id' })
          chatsStore.createIndex('by-last-activity', 'lastActivity')
          chatsStore.createIndex('by-state', 'state')
        }

        if (oldVersion < 2) {
          // Custom emojis store
          const emojiStore = db.createObjectStore('customEmojis', { keyPath: 'id' })
          emojiStore.createIndex('by-shortcode', 'shortcode', { unique: true })

          // Emoji cache store
          const cacheStore = db.createObjectStore('emojiCache', { keyPath: 'id' })
          cacheStore.createIndex('by-peer', 'peerId')
        }

        if (oldVersion < 3) {
          db.createObjectStore('identityKeys', { keyPath: 'id' })
        }
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

  // --- Custom Emojis ---

  async storeCustomEmoji(emoji: CustomEmoji): Promise<void> {
    const db = this.ensureDb()
    await db.put('customEmojis', emoji)
  }

  async deleteCustomEmoji(id: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('customEmojis', id)
  }

  async getAllCustomEmojis(): Promise<CustomEmoji[]> {
    const db = this.ensureDb()
    return db.getAll('customEmojis')
  }

  // --- Emoji Cache ---

  async cachePeerEmoji(peerId: string, shortcode: string, dataUrl: string): Promise<void> {
    const db = this.ensureDb()
    const entry: EmojiCacheEntry = {
      id: `${peerId}:${shortcode}`,
      peerId,
      shortcode,
      dataUrl,
    }
    await db.put('emojiCache', entry)

    // Evict oldest if >500 entries
    const count = await db.count('emojiCache')
    if (count > 500) {
      const tx = db.transaction('emojiCache', 'readwrite')
      let cursor = await tx.store.openCursor()
      let toDelete = count - 500
      while (cursor && toDelete > 0) {
        await cursor.delete()
        toDelete--
        cursor = await cursor.continue()
      }
      await tx.done
    }
  }

  async getCachedPeerEmoji(peerId: string, shortcode: string): Promise<string | undefined> {
    const db = this.ensureDb()
    const entry = await db.get('emojiCache', `${peerId}:${shortcode}`)
    return entry?.dataUrl
  }

  // --- Identity Keys ---

  async storeIdentityKeys(keys: StoredIdentityKeys): Promise<void> {
    const db = this.ensureDb()
    await db.put('identityKeys', keys)
  }

  async loadIdentityKeys(): Promise<StoredIdentityKeys | undefined> {
    const db = this.ensureDb()
    return db.get('identityKeys', 'local')
  }

  async clearAll(): Promise<void> {
    const db = this.ensureDb()
    const tx = db.transaction(['messages', 'chats', 'customEmojis', 'emojiCache', 'identityKeys'], 'readwrite')
    await tx.objectStore('messages').clear()
    await tx.objectStore('chats').clear()
    await tx.objectStore('customEmojis').clear()
    await tx.objectStore('emojiCache').clear()
    await tx.objectStore('identityKeys').clear()
    await tx.done
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
