import { loadConfig } from './config'
import { SQLiteAdapter } from './db/sqlite-adapter'
import { MySQLAdapter } from './db/mysql-adapter'
import type { DatabaseAdapter } from './db/adapter'
import { ChannelManager } from './channel-manager'
import { ModerationManager } from './moderation'
import { MessageHandler } from './message-handler'
import { ClientServer } from './client-server'
import { MediaRelay } from './media-relay'
import { SignalingBridge } from './signaling-bridge'
import { SFUBridge } from './sfu-bridge'

async function main(): Promise<void> {
  const config = loadConfig()

  console.log(`[Community] Starting "${config.serverName}" (${config.serverId})`)
  console.log(`[Community] Database backend: ${config.dbBackend}`)

  // Initialize database
  let db: DatabaseAdapter
  if (config.dbBackend === 'mysql') {
    db = new MySQLAdapter({
      host: config.mysqlHost,
      port: config.mysqlPort,
      user: config.mysqlUser,
      password: config.mysqlPassword,
      database: config.mysqlDatabase,
    })
  } else {
    db = new SQLiteAdapter(config.sqlitePath)
  }
  await db.init()

  // Initialize managers
  const channelManager = new ChannelManager(db)
  const moderation = new ModerationManager(db, config.ownerId)

  // Create default channels
  await channelManager.ensureDefaultChannels(config.defaultChannels)

  // Shared clients map — both ClientServer and MessageHandler reference the same instance
  const clients = new Map()
  const mediaRelay = new MediaRelay()
  const messageHandler = new MessageHandler(db, channelManager, moderation, config, clients, mediaRelay)
  const clientServer = new ClientServer(config, messageHandler, channelManager, clients, mediaRelay)
  clientServer.start()

  // Connect to signaling server for discovery
  const signalingBridge = new SignalingBridge(config)
  signalingBridge.connect()

  // SFU bridge (stub)
  const sfuBridge = new SFUBridge()
  await sfuBridge.init()

  console.log(`[Community] Server ready. Clients connect on ws://localhost:${config.port}`)

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Community] Shutting down...')
    signalingBridge.disconnect()
    clientServer.stop()
    sfuBridge.close()
    await db.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[Community] Fatal error:', err)
  process.exit(1)
})
