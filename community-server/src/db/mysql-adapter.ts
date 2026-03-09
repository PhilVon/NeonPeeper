import mysql from 'mysql2/promise'
import type { DatabaseAdapter } from './adapter'
import type { Channel, StoredMessage, ChannelMember, Ban } from '../types'
import { MIGRATION_001_UP_MYSQL } from './migrations/001-initial'

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null
  private config: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }

  constructor(config: { host: string; port: number; user: string; password: string; database: string }) {
    this.config = config
  }

  async init(): Promise<void> {
    this.pool = mysql.createPool({
      ...this.config,
      waitForConnections: true,
      connectionLimit: 10,
    })

    // Run migrations — split on semicolons but handle CREATE TABLE blocks
    const statements = MIGRATION_001_UP_MYSQL
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await this.pool.execute(stmt)
    }

    // Migration: add custom_emojis_json column
    try {
      await this.pool.execute('ALTER TABLE messages ADD COLUMN custom_emojis_json TEXT')
    } catch {
      // Column already exists
    }

    console.log('[MySQL] Database initialized at', this.config.host)
  }

  async close(): Promise<void> {
    await this.pool?.end()
    this.pool = null
  }

  private getPool(): mysql.Pool {
    if (!this.pool) throw new Error('Database not initialized')
    return this.pool
  }

  // Channels
  async createChannel(channel: Channel): Promise<void> {
    await this.getPool().execute(
      'INSERT IGNORE INTO channels (id, name, description, topic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [channel.id, channel.name, channel.description, channel.topic || null, channel.createdAt, channel.updatedAt]
    )
  }

  async getChannels(): Promise<Channel[]> {
    const [rows] = await this.getPool().execute('SELECT * FROM channels ORDER BY name')
    return (rows as Array<Record<string, unknown>>).map(this.rowToChannel)
  }

  async getChannel(id: string): Promise<Channel | null> {
    const [rows] = await this.getPool().execute('SELECT * FROM channels WHERE id = ?', [id])
    const arr = rows as Array<Record<string, unknown>>
    return arr.length > 0 ? this.rowToChannel(arr[0]) : null
  }

  async updateChannel(
    id: string,
    updates: Partial<Pick<Channel, 'name' | 'description' | 'topic'>>
  ): Promise<void> {
    const sets: string[] = []
    const values: (string | number | null)[] = []
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
    await this.getPool().execute(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, values)
  }

  // Messages
  async storeMessage(message: StoredMessage): Promise<void> {
    await this.getPool().execute(
      `INSERT INTO messages (id, channel_id, from_peer_id, from_display_name, content, content_type, meta_json, custom_emojis_json, reply_to, timestamp, edited_at, original_content, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        message.deleted ? 1 : 0,
      ]
    )
  }

  async getMessages(channelId: string, before?: number, limit: number = 50): Promise<StoredMessage[]> {
    let query = 'SELECT * FROM messages WHERE channel_id = ? AND deleted = 0'
    const params: (string | number)[] = [channelId]
    if (before) {
      query += ' AND timestamp < ?'
      params.push(before)
    }
    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const [rows] = await this.getPool().execute(query, params)
    return (rows as Array<Record<string, unknown>>).map(this.rowToMessage).reverse()
  }

  async editMessage(id: string, content: string, editedAt: number, originalContent: string): Promise<void> {
    await this.getPool().execute(
      'UPDATE messages SET content = ?, edited_at = ?, original_content = ? WHERE id = ?',
      [content, editedAt, originalContent, id]
    )
  }

  async deleteMessage(id: string): Promise<void> {
    await this.getPool().execute('UPDATE messages SET deleted = 1 WHERE id = ?', [id])
  }

  // Members
  async addMember(member: ChannelMember): Promise<void> {
    await this.getPool().execute(
      'REPLACE INTO channel_members (channel_id, peer_id, display_name, role, joined_at) VALUES (?, ?, ?, ?, ?)',
      [member.channelId, member.peerId, member.displayName, member.role, member.joinedAt]
    )
  }

  async removeMember(channelId: string, peerId: string): Promise<void> {
    await this.getPool().execute('DELETE FROM channel_members WHERE channel_id = ? AND peer_id = ?', [
      channelId,
      peerId,
    ])
  }

  async getMembers(channelId: string): Promise<ChannelMember[]> {
    const [rows] = await this.getPool().execute(
      'SELECT * FROM channel_members WHERE channel_id = ? ORDER BY joined_at',
      [channelId]
    )
    return (rows as Array<Record<string, unknown>>).map(this.rowToMember)
  }

  async isMember(channelId: string, peerId: string): Promise<boolean> {
    const [rows] = await this.getPool().execute(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND peer_id = ?',
      [channelId, peerId]
    )
    return (rows as Array<Record<string, unknown>>).length > 0
  }

  async getMemberCount(channelId: string): Promise<number> {
    const [rows] = await this.getPool().execute(
      'SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?',
      [channelId]
    )
    return (rows as Array<Record<string, unknown>>)[0].count as number
  }

  // Bans
  async banUser(ban: Ban): Promise<void> {
    await this.getPool().execute(
      'REPLACE INTO bans (peer_id, channel_id, reason, banned_at, banned_by) VALUES (?, ?, ?, ?, ?)',
      [ban.peerId, ban.channelId, ban.reason || null, ban.bannedAt, ban.bannedBy]
    )
  }

  async unbanUser(peerId: string, channelId: string): Promise<void> {
    await this.getPool().execute('DELETE FROM bans WHERE peer_id = ? AND channel_id = ?', [peerId, channelId])
  }

  async isBanned(peerId: string, channelId: string): Promise<boolean> {
    const [rows] = await this.getPool().execute(
      'SELECT 1 FROM bans WHERE peer_id = ? AND (channel_id = ? OR channel_id = ?)',
      [peerId, channelId, '*']
    )
    return (rows as Array<Record<string, unknown>>).length > 0
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
