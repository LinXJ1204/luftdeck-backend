import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { WalletService } from './wallet-service'
import ensRouter from './routes/ens'
import groupRouter from './routes/group'

// Export Merkle Tree package and WalletService
export { MerkleTree, MerkleProof } from './merkle-tree'
export { WalletService } from './wallet-service'

dotenv.config()

// Initialize WalletService (for internal use only)
const PRIVATE_KEY = process.env.PRIVATE_KEY
const RPC_URL = process.env.RPC_URL

let walletService: WalletService | null = null

try {
  walletService = new WalletService(PRIVATE_KEY, RPC_URL)
} catch (error) {
  console.error('❌ Failed to initialize WalletService:', error)
}

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Load OpenAPI spec
const openApiPath = path.join(__dirname, '../openapi.yaml')
const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8')) as object

// Serve OpenAPI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

// Mount route modules
app.use('/ens', ensRouter)
app.use('/group', groupRouter)

// Health check and monitoring endpoints
app.get('/health', async (_req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {
      walletService: walletService ? 'connected' : 'disconnected',
      database: 'unknown' // Will be updated if database checks are added
    }
  }

  try {
    // Test database connection if available
    if (fs.existsSync(path.join(__dirname, '../groups.db'))) {
      healthCheck.services.database = 'connected'
    }
    
    res.status(200).json(healthCheck)
  } catch (error) {
    healthCheck.status = 'error'
    healthCheck.services.database = 'error'
    res.status(503).json(healthCheck)
  }
})

app.get('/health/ready', (_req, res) => {
  // Readiness probe - check if app is ready to serve traffic
  const ready = walletService !== null
  res.status(ready ? 200 : 503).json({ 
    ready,
    timestamp: new Date().toISOString()
  })
})

app.get('/health/live', (_req, res) => {
  // Liveness probe - check if app is alive
  res.status(200).json({ 
    alive: true,
    timestamp: new Date().toISOString()
  })
})

app.get('/metrics', (_req, res) => {
  // Basic metrics endpoint for monitoring
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  }
  
  res.json(metrics)
})

app.listen(port, () => {
  console.log('Server listening on http://localhost:' + port)
})
