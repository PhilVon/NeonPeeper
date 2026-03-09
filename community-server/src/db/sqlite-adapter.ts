import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { DatabaseAdapter } from './adapter'
import type { Channel, StoredMessage, ChannelMember, Ban } from '../types'
import { MIGRATION_001_UP_SQLITE } from './migrations/001-initial'

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async init(): Promise<void> {
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    // Run migrations
    const statements = MIGRATION_001_UP_SQLITE
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      this.db.exec(stmt)
    }

    // Migration: add custom_emojis_json column
    try {
      this.db.exec('ALTER TABLE messages ADD COLUMN custom_emojis_json TEXT')
    } catch {
      // Column already exists
    }

    console.log('[SQLite] Database initialized at', this.dbPath)
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }

  // Channels
  async createChannel(channel: Channel): Promise<void> {
    this.getDb()
      .prepare(
        'INSERT OR IGNORE INTO channels (id, name, description, topic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(channel.id, channel.name, channel.description, channel.topic || null, channel.createdAt, channel.updatedAt)
  }

  async getChannels(): Promise<Channel[]> {
    const rows = this.getDb().prepare('SELECT * FROM channels ORDER BY name').all() as Array<Record<string, unknown>>
    return rows.map(this.rowToChannel)
  }

  async getChannel(id: string): Promise<Channel | null> {
    const row = this.getDb().prepare('SELECT * FROM channels WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return row ? this.rowToChannel(row) : null
  }

  async updateChannel(
    id: string,
    updates: Partial<Pick<Channel, 'name' | 'description' | 'topic'>>
  ): Promise<void> {
    const sets: string[] = []
    const values: unknown[] = []
    if (updates.name !== undefined) {
      sets.push('name = ?')
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      sets.push('description = ?')
      values.push(updates.description)
    }
    if (updates.topic !== undefined) {
      sets.push('topic = ?')
      values.push(updates.topic)
    }
    if (sets.length === 0) return
    sets.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)
    this.getDb().prepare(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  // Messages
  async storeMessage(message: StoredMessage): Promise<void> {
    this.getDb()
      .prepare(
        `INSERT INTO messages (id, channel_id, from_peer_id, from_display_name, content, content_type, meta_json, custom_emojis_json, reply_to, timestamp, edited_at, original_content, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.channelId,
        message.fromPeerId,
        message.fromDisplayName,
        message.content,
        message.contentType,
        message.metaJson || null,
        message.customEmojisJson || null,
        message.replyTo || null,
        message.timestamp,
        message.editedAt || null,
        message.originalContent || null,
        message.deleted ? 1 : 0
      )
  }

  async getMessages(channelId: string, before?: number, limit: number = 50): Promise<StoredMessage[]> {
    let query = 'SELECT * FROM messages WHERE channel_id = ? AND deleted = 0'
    const params: unknown[] = [channelId]
    if (before) {
      query += ' AND timestamp < ?'
      params.push(before)
    }
    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const rows = this.getDb().prepare(query).all(...params) as Array<Record<string, unknown>>
    return rows.map(this.rowToMessage).reverse()
  }

  async editMessage(id: string, content: string, editedAt: number, originalContent: string): Promise<void> {
    this.getDb()
      .prepare('UPDATE messages SET content = ?, edited_at = ?, original_content = ? WHERE id = ?')
      .run(content, editedAt, originalContent, id)
  }

  async deleteMessage(id: string): Promise<void> {
    this.getDb().prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(id)
  }

  // Members
  async addMember(member: ChannelMember): Promise<void> {
    this.getDb()
      .prepare(
        'INSERT OR REPLACE INTO channel_members (channel_id, peer_id, display_name, role, joined_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(member.channelId, member.peerId, member.displayName, member.role, member.joinedAt)
  }

  async removeMember(channelId: string, peerId: string): Promise<void> {
    this.getDb().prepare('DELETE FROM channel_members WHERE channel_id = ? AND peer_id = ?').run(channelId, peerId)
  }

  async getMembers(channelId: string): Promise<ChannelMember[]> {
    const rows = this.getDb()
      .prepare('SELECT * FROM channel_members WHERE channel_id = ? ORDER BY joined_at')
      .all(channelId) as Array<Record<string, unknown>>
    return rows.map(this.rowToMember)
  }

  async isMember(channelId: string, peerId: string): Promise<boolean> {
    const row = this.getDb()
      .prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND peer_id = ?')
      .get(channelId, peerId)
    return !!row
  }

  async getMemberCount(channelId: string): Promise<number> {
    const row = this.getDb()
      .prepare('SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?')
      .get(channelId) as { count: number }
    return row.count
  }

  // Bans
  async banUser(ban: Ban): Promise<void> {
    this.getDb()
      .prepare('INSERT OR REPLACE INTO bans (peer_id, channel_id, reason, banned_at, banned_by) VALUES (?, ?, ?, ?, ?)')
      .run(ban.peerId, ban.channelId, ban.reason || null, ban.bannedAt, ban.bannedBy)
  }

  async unbanUser(peerId: string, channelId: string): Promise<void> {
    this.getDb().prepare('DELETE FROM bans WHERE peer_id = ? AND channel_id = ?').run(peerId, channelId)
  }

  async isBanned(peerId: string, channelId: string): Promise<boolean> {
    const row = this.getDb()
      .prepare('SELECT 1 FROM bans WHERE peer_id = ? AND (channel_id = ? OR channel_id = ?)')
      .get(peerId, channelId, '*')
    return !!row
  }

  // Row mappers
  private rowToChannel(row: Record<string, unknown>): Channel {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      topic: (row.topic as string) || undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }
  }

  private rowToMessage(row: Record<string, unknown>): StoredMessage {
    return {
      id: row.id as string,
      channelId: row.channel_id as string,
      fromPeerId: row.from_peer_id as string,
      fromDisplayName: row.from_display_name as string,
      content: row.content as string,
      contentType: row.content_type as string,
      metaJson: (row.meta_json as string) || undefined,
      customEmojisJson: (row.custom_emojis_json as string) || undefined,
      replyTo: (row.reply_to as string) || undefined,
      timestamp: row.timestamp as number,
      editedAt: (row.edited_at as number) || undefined,
      originalContent: (row.original_content as string) || undefined,
      deleted: !!(row.deleted as number),
    }
  }

  private rowToMember(row: Record<string, unknown>): ChannelMember {
    return {
      channelId: row.channel_id as string,
      peerId: row.peer_id as string,
      displayName: row.display_name as string,
      role: row.role as 'owner' | 'member',
      joinedAt: row.joined_at as number,
    }
  }
}
