import { Router } from 'express'
import sqlite3 from 'sqlite3'
import { MerkleTree } from '../merkle-tree'
import path from 'path'

const router = Router()

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'groups.db')
const db = new sqlite3.Database(dbPath)

// Create groups table if it doesn't exist
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
})

interface Group {
  id: number
  name: string
  members: string // JSON string of array
  tree_root: string | null
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
    const { name, members = [] } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Group name is required and must be a string'
      })
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
    const treeRoot = updateTreeRoot(uniqueMembers)

    const stmt = db.prepare(`
      INSERT INTO groups (name, members, tree_root)
      VALUES (?, ?, ?)
    `)

    stmt.run(name, membersJson, treeRoot, function(this: sqlite3.RunResult, err: Error | null) {
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

      res.status(201).json({
        name,
        members: uniqueMembers,
        tree_root: treeRoot,
        member_count: uniqueMembers.length,
        created_at: new Date().toISOString()
      })
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
    const { userId } = req.body

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
