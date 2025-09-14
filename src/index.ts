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

// API Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log('Server listening on http://localhost:' + port)
})
