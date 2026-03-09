export const MIGRATION_001_UP_SQLITE = `
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topic TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  from_peer_id TEXT NOT NULL,
  from_display_name TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  meta_json TEXT,
  reply_to TEXT,
  timestamp INTEGER NOT NULL,
  edited_at INTEGER,
  original_content TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_ts ON messages (channel_id, timestamp);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, peer_id)
);

CREATE TABLE IF NOT EXISTS bans (
  peer_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  reason TEXT,
  banned_at INTEGER NOT NULL,
  banned_by TEXT NOT NULL,
  PRIMARY KEY (peer_id, channel_id)
);
`

export const MIGRATION_001_UP_MYSQL = `
CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  topic TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(128) PRIMARY KEY,
  channel_id VARCHAR(128) NOT NULL,
  from_peer_id VARCHAR(128) NOT NULL,
  from_display_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(32) NOT NULL DEFAULT 'text',
  meta_json TEXT,
  reply_to VARCHAR(128),
  timestamp BIGINT NOT NULL,
  edited_at BIGINT,
  original_content TEXT,
  deleted TINYINT NOT NULL DEFAULT 0,
  INDEX idx_messages_channel_ts (channel_id, timestamp)
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id VARCHAR(128) NOT NULL,
  peer_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (channel_id, peer_id)
);

CREATE TABLE IF NOT EXISTS bans (
  peer_id VARCHAR(128) NOT NULL,
  channel_id VARCHAR(128) NOT NULL,
  reason TEXT,
  banned_at BIGINT NOT NULL,
  banned_by VARCHAR(128) NOT NULL,
  PRIMARY KEY (peer_id, channel_id)
);
`
