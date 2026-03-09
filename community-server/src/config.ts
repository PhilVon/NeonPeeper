import dotenv from 'dotenv'
dotenv.config()

export interface CommunityConfig {
  serverId: string
  serverName: string
  serverDescription: string
  ownerId: string
  port: number
  signalingUrl: string
  dbBackend: 'sqlite' | 'mysql'
  sqlitePath: string
  mysqlHost: string
  mysqlPort: number
  mysqlUser: string
  mysqlPassword: string
  mysqlDatabase: string
  defaultChannels: string[]
}

export function loadConfig(): CommunityConfig {
  return {
    serverId: process.env.SERVER_ID || 'community-server-1',
    serverName: process.env.SERVER_NAME || 'Community Server',
    serverDescription: process.env.SERVER_DESCRIPTION || 'A Neon Peeper community server',
    ownerId: process.env.SERVER_OWNER_ID || '',
    port: parseInt(process.env.PORT || '8090', 10),
    signalingUrl: process.env.SIGNALING_URL || 'ws://localhost:8080',
    dbBackend: (process.env.DB_BACKEND as 'sqlite' | 'mysql') || 'sqlite',
    sqlitePath: process.env.SQLITE_PATH || './data/community.db',
    mysqlHost: process.env.MYSQL_HOST || 'localhost',
    mysqlPort: parseInt(process.env.MYSQL_PORT || '3306', 10),
    mysqlUser: process.env.MYSQL_USER || 'neonpeeper',
    mysqlPassword: process.env.MYSQL_PASSWORD || '',
    mysqlDatabase: process.env.MYSQL_DATABASE || 'neon_community',
    defaultChannels: (process.env.DEFAULT_CHANNELS || 'general,random')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  }
}
