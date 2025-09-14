import { Router } from 'express'
import sqlite3 from 'sqlite3'
import { MerkleTree } from '../merkle-tree'
import { WalletService } from '../wallet-service'
import path from 'path'

const router = Router()

// Initialize wallet service for ENS registration
let walletService: WalletService | null = null

const initializeWalletService = () => {
  if (!walletService) {
    try {
      const PRIVATE_KEY = process.env.PRIVATE_KEY
      const RPC_URL = process.env.RPC_URL
      walletService = new WalletService(PRIVATE_KEY, RPC_URL)
      console.log('✅ Group WalletService initialized for ENS registration')
    } catch (error) {
      console.error('❌ Failed to initialize Group WalletService:', error)
    }
  }
  return walletService
}

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'groups.db')
const db = new sqlite3.Database(dbPath)

// Create groups table if it doesn't exist and add missing columns
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      members TEXT NOT NULL DEFAULT '[]',
      tree_root TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Add ENS-related columns if they don't exist (for existing databases)
  db.run(`ALTER TABLE groups ADD COLUMN ens_domain TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding ens_domain column:', err)
    }
  })
  
  db.run(`ALTER TABLE groups ADD COLUMN ens_registration_tx TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding ens_registration_tx column:', err)
    }
  })
  
  db.run(`ALTER TABLE groups ADD COLUMN ens_transfer_tx TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding ens_transfer_tx column:', err)
    }
  })
  
  db.run(`ALTER TABLE groups ADD COLUMN ens_owner_address TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding ens_owner_address column:', err)
    }
  })
})

interface Group {
  id: number
  name: string
  members: string // JSON string of array
  tree_root: string | null
  ens_domain: string | null
  ens_registration_tx: string | null
  ens_transfer_tx: string | null
  ens_owner_address: string | null
  created_at: string
  updated_at: string
}

/**
 * Helper function to update tree root for a group
 */
const updateTreeRoot = (members: string[]): string | null => {
  if (members.length === 0) {
    return null
  }
  
  const tree = new MerkleTree(members)
  return tree.getRoot()
}

/**
 * POST /group
 * Create a new group
 */
router.post('/', async (req, res) => {
  try {
    const { name, members = [], ownerAddress, skipEns = false } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Group name is required and must be a string'
      })
    }

    // Check if the name has Special characters like !@#$%^&*()_+-=[]{}|;:,.<>?
    if (name.includes('!') || name.includes('@') || name.includes('#') || name.includes('$') || name.includes('%') || name.includes('^') || name.includes('&') || name.includes('*') || name.includes('(') || name.includes(')') || name.includes('_') || name.includes('+') || name.includes('-') || name.includes('=') || name.includes('[') || name.includes(']') || name.includes('{') || name.includes('}') || name.includes('|') || name.includes(';') || name.includes(':') || name.includes(',') || name.includes('.') || name.includes('<') || name.includes('>')) {
      return res.status(400).json({
        error: 'Group name cannot contain Special characters'
      })
    }

    // Only validate owner address if ENS registration is not skipped
    if (!skipEns) {
      if (!ownerAddress || typeof ownerAddress !== 'string') {
        return res.status(400).json({
          error: 'Owner address is required for ENS registration'
        })
      }

      // Validate Ethereum address format
      if (!ownerAddress.startsWith('0x') || ownerAddress.length !== 42) {
        return res.status(400).json({
          error: 'Invalid Ethereum address format'
        })
      }
    }

    if (!Array.isArray(members)) {
      return res.status(400).json({
        error: 'Members must be an array'
      })
    }

    // Validate that all members are strings
    for (const member of members) {
      if (typeof member !== 'string') {
        return res.status(400).json({
          error: 'All members must be strings'
        })
      }
    }

    // Remove duplicates from members array
    const uniqueMembers = [...new Set(members)]
    const membersJson = JSON.stringify(uniqueMembers)
    const treeRoot = updateTreeRoot(uniqueMembers) || ''

    // Prepare ENS domain name
    const ensDomain = `${name}`
    
    let ensRegistrationTx = null
    let ensTransferTx = null
    let ensRegistrationError = null

    // Attempt ENS registration only if not skipped
    if (!skipEns) {
      // Initialize wallet service for ENS registration
      const wallet = initializeWalletService()
      if (!wallet) {
        console.warn('⚠️ ENS registration service unavailable, skipping ENS registration')
        ensRegistrationError = 'ENS registration service unavailable'
      } else {
        try {
          console.log(`🔄 Starting ENS registration for ${ensDomain}...`)
          
          // Check if ENS name is available
          const isAvailable = await wallet.isENSAvailable(ensDomain)
          if (!isAvailable) {
            console.warn(`⚠️ ENS domain ${ensDomain} is not available, skipping ENS registration`)
            ensRegistrationError = `ENS domain ${ensDomain} is not available`
          } else {
            // Register ENS and transfer ownership to the specified address
            const ensResult = await wallet.registerENSAndTransfer(ensDomain, ownerAddress, 1, treeRoot)
            ensRegistrationTx = ensResult.registrationTx
            
            console.log(`✅ ENS registration successful for ${ensDomain}`)
          }
        } catch (ensError) {
          console.error('ENS registration failed:', ensError)
          ensRegistrationError = (ensError as Error).message
          
          // Continue with group creation even if ENS registration fails
          // This ensures the group is still created for the user
        }
      }
    } else {
      console.log(`⏭️ Skipping ENS registration for ${ensDomain} as requested`)
    }

    // Create the group in database
    const stmt = db.prepare(`
      INSERT INTO groups (name, members, tree_root, ens_domain, ens_registration_tx, ens_transfer_tx, ens_owner_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(name, membersJson, treeRoot, ensDomain, ensRegistrationTx, ensTransferTx, ownerAddress, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            error: 'Group name already exists'
          })
        }
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to create group',
          message: err.message
        })
      }

      const response: any = {
        name,
        members: uniqueMembers,
        tree_root: treeRoot,
        member_count: uniqueMembers.length,
        ens_domain: ensDomain,
        ens_owner_address: ownerAddress,
        created_at: new Date().toISOString()
      }

      // Include ENS transaction details if registration was successful
      if (ensRegistrationTx && ensTransferTx) {
        response.ens_registration_tx = ensRegistrationTx
        response.ens_transfer_tx = ensTransferTx
        response.ens_status = 'registered'
      } else if (ensRegistrationError) {
        response.ens_status = 'failed'
        response.ens_error = ensRegistrationError
      }

      const statusCode = ensRegistrationError ? 207 : 201 // 207 Multi-Status if ENS failed but group created
      res.status(statusCode).json(response)
    })

    stmt.finalize()
  } catch (error) {
    console.error('Create group error:', error)
    res.status(500).json({
      error: 'Failed to create group',
      message: (error as Error).message
    })
  }
})

/**
 * GET /group/:name
 * Get group details
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Valid group name is required'
      })
    }

    const stmt = db.prepare('SELECT * FROM groups WHERE name = ?')
    
    stmt.get(name, (err, row: Group) => {
      if (err) {
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to retrieve group',
          message: err.message
        })
      }

      if (!row) {
        return res.status(404).json({
          error: 'Group not found'
        })
      }

      const members = JSON.parse(row.members)
      res.json({
        name: row.name,
        members,
        tree_root: row.tree_root,
        member_count: members.length,
        ens_domain: row.ens_domain,
        ens_registration_tx: row.ens_registration_tx,
        ens_transfer_tx: row.ens_transfer_tx,
        ens_owner_address: row.ens_owner_address,
        created_at: row.created_at,
        updated_at: row.updated_at
      })
    })

    stmt.finalize()
  } catch (error) {
    console.error('Get group error:', error)
    res.status(500).json({
      error: 'Failed to retrieve group',
      message: (error as Error).message
    })
  }
})

/**
 * POST /group/:name/member
 * Add a member to the group
 */
router.post('/:name/member', async (req, res) => {
  try {
    const { name } = req.params
    const { userId, ownerAddress } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Valid group name is required'
      })
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'User ID is required and must be a string'
      })
    }

    // Check the user is owner of the group by checking the ENS owner
    const wallet = initializeWalletService()
    if (!wallet) {
      return res.status(500).json({
        error: 'Wallet service unavailable'
      })
    }
    const isOwner = await wallet.isENSOwner(name, ownerAddress)
    if (!isOwner) {
      return res.status(403).json({
        error: 'User is not the owner of the group'
      })
    }

    // First, get the current group
    const getStmt = db.prepare('SELECT * FROM groups WHERE name = ?')
    
    getStmt.get(name, (err, row: Group) => {
      if (err) {
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to retrieve group',
          message: err.message
        })
      }

      if (!row) {
        return res.status(404).json({
          error: 'Group not found'
        })
      }

      const currentMembers = JSON.parse(row.members)
      
      // Check if user is already a member
      if (currentMembers.includes(userId)) {
        return res.status(409).json({
          error: 'User is already a member of this group'
        })
      }

      // Add the new member
      const updatedMembers = [...currentMembers, userId]
      const newTreeRoot = updateTreeRoot(updatedMembers)
      const membersJson = JSON.stringify(updatedMembers)

      // Update the group
      const updateStmt = db.prepare(`
        UPDATE groups 
        SET members = ?, tree_root = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `)

      updateStmt.run(membersJson, newTreeRoot, name, function(updateErr: Error | null) {
        if (updateErr) {
          console.error('Database error:', updateErr)
          return res.status(500).json({
            error: 'Failed to add member',
            message: updateErr.message
          })
        }

        res.json({
          name: row.name,
          members: updatedMembers,
          tree_root: newTreeRoot,
          member_count: updatedMembers.length,
          added_member: userId,
          updated_at: new Date().toISOString()
        })
      })

      updateStmt.finalize()
    })

    getStmt.finalize()
  } catch (error) {
    console.error('Add member error:', error)
    res.status(500).json({
      error: 'Failed to add member',
      message: (error as Error).message
    })
  }
})

/**
 * DELETE /group/:name/member/:userId
 * Remove a member from the group
 */
router.delete('/:name/member/:userId', async (req, res) => {
  try {
    const { name, userId } = req.params

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Valid group name is required'
      })
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Valid user ID is required'
      })
    }

    // First, get the current group
    const getStmt = db.prepare('SELECT * FROM groups WHERE name = ?')
    
    getStmt.get(name, (err, row: Group) => {
      if (err) {
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to retrieve group',
          message: err.message
        })
      }

      if (!row) {
        return res.status(404).json({
          error: 'Group not found'
        })
      }

      const currentMembers = JSON.parse(row.members)
      
      // Check if user is a member
      if (!currentMembers.includes(userId)) {
        return res.status(404).json({
          error: 'User is not a member of this group'
        })
      }

      // Remove the member
      const updatedMembers = currentMembers.filter((member: string) => member !== userId)
      const newTreeRoot = updateTreeRoot(updatedMembers)
      const membersJson = JSON.stringify(updatedMembers)

      // Update the group
      const updateStmt = db.prepare(`
        UPDATE groups 
        SET members = ?, tree_root = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `)

      updateStmt.run(membersJson, newTreeRoot, name, function(updateErr: Error | null) {
        if (updateErr) {
          console.error('Database error:', updateErr)
          return res.status(500).json({
            error: 'Failed to remove member',
            message: updateErr.message
          })
        }

        res.json({
          name: row.name,
          members: updatedMembers,
          tree_root: newTreeRoot,
          member_count: updatedMembers.length,
          removed_member: userId,
          updated_at: new Date().toISOString()
        })
      })

      updateStmt.finalize()
    })

    getStmt.finalize()
  } catch (error) {
    console.error('Remove member error:', error)
    res.status(500).json({
      error: 'Failed to remove member',
      message: (error as Error).message
    })
  }
})

/**
 * GET /group/:name/proof/:userId
 * Generate Merkle proof for a group member
 */
router.get('/:name/proof/:userId', async (req, res) => {
  try {
    const { name, userId } = req.params

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Valid group name is required'
      })
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Valid user ID is required'
      })
    }

    const stmt = db.prepare('SELECT * FROM groups WHERE name = ?')
    
    stmt.get(name, (err, row: Group) => {
      if (err) {
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to retrieve group',
          message: err.message
        })
      }

      if (!row) {
        return res.status(404).json({
          error: 'Group not found'
        })
      }

      const members = JSON.parse(row.members)
      
      if (!members.includes(userId)) {
        return res.status(404).json({
          error: 'User is not a member of this group'
        })
      }

      if (members.length === 0) {
        return res.status(400).json({
          error: 'Cannot generate proof for empty group'
        })
      }

      try {
        const tree = new MerkleTree(members)
        const proof = tree.generateProof(userId)

        res.json({
          group_name: row.name,
          user_id: userId,
          proof,
          generated_at: new Date().toISOString()
        })
      } catch (proofError) {
        console.error('Proof generation error:', proofError)
        res.status(500).json({
          error: 'Failed to generate proof',
          message: (proofError as Error).message
        })
      }
    })

    stmt.finalize()
  } catch (error) {
    console.error('Generate proof error:', error)
    res.status(500).json({
      error: 'Failed to generate proof',
      message: (error as Error).message
    })
  }
})

/**
 * GET /group
 * List all groups
 */
router.get('/', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM groups ORDER BY created_at DESC')
    
    stmt.all((err, rows: Group[]) => {
      if (err) {
        console.error('Database error:', err)
        return res.status(500).json({
          error: 'Failed to retrieve groups',
          message: err.message
        })
      }

      const groups = rows.map(row => {
        const members = JSON.parse(row.members)
        return {
          name: row.name,
          member_count: members.length,
          tree_root: row.tree_root,
          ens_domain: row.ens_domain,
          ens_owner_address: row.ens_owner_address,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      })

      res.json({
        groups,
        total: groups.length
      })
    })

    stmt.finalize()
  } catch (error) {
    console.error('List groups error:', error)
    res.status(500).json({
      error: 'Failed to retrieve groups',
      message: (error as Error).message
    })
  }
})

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err)
    } else {
      console.log('Database connection closed.')
    }
    process.exit(0)
  })
})

export default router
