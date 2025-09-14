import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

// Export Merkle Tree package
export { MerkleTree, MerkleProof } from './merkle-tree'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Load OpenAPI spec
const openApiPath = path.join(__dirname, '../openapi.yaml')
const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8')) as object

// Serve OpenAPI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log('Server listening on http://localhost:' + port)
})
