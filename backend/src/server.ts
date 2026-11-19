import { createApp } from './app'
import { config } from './config'
import { sequelize } from './orm'

async function main() {
  await sequelize.authenticate()
  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`API on http://localhost:${config.port}/v2  (database ${config.db.database})`)
  })
  const stop = async (signal: string) => {
    console.log(`\n${signal}: shutting down`)
    server.close()
    await sequelize.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void stop('SIGINT'))
  process.on('SIGTERM', () => void stop('SIGTERM'))
}

main().catch(e => {
  console.error(`startup failed: ${(e as Error).message}`)
  process.exit(1)
})
