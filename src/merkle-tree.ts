import crypto from 'crypto'

/**
 * Represents a node in the Merkle tree
 */
interface MerkleNode {
  hash: string
  left?: MerkleNode
  right?: MerkleNode
  data?: string // Original user ID for leaf nodes
}

/**
 * Merkle proof for verifying membership
 */
export interface MerkleProof {
  leaf: string
  proof: Array<{
    hash: string
    position: 'left' | 'right'
  }>
  root: string
}

/**
 * Merkle Tree implementation for group membership management
 * Each leaf node represents a group member identified by their userId
 */
export class MerkleTree {
  private root: MerkleNode | null = null
  private leaves: string[] = []

  constructor(userIds: string[] = []) {
    if (userIds.length > 0) {
      this.buildTree(userIds)
    }
  }

  /**
   * Creates a hash from the input data using SHA-256
   */
  private hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Combines two hashes to create a parent hash
   */
  private combineHashes(left: string, right: string): string {
    return this.hash(left + right)
  }

  /**
   * Builds the Merkle tree from an array of user IDs
   */
  public buildTree(userIds: string[]): void {
    if (userIds.length === 0) {
      throw new Error('Cannot build tree with empty user list')
    }

    // Store original user IDs
    this.leaves = [...userIds]

    // Create leaf nodes by hashing user IDs
    let currentLevel: MerkleNode[] = userIds.map(userId => ({
      hash: this.hash(userId),
      data: userId
    }))

    // If odd number of nodes, duplicate the last one
    if (currentLevel.length % 2 !== 0) {
      const lastNode = currentLevel[currentLevel.length - 1]
      currentLevel.push({
        hash: lastNode.hash,
        data: lastNode.data
      })
    }

    // Build tree bottom-up
    while (currentLevel.length > 1) {
      const nextLevel: MerkleNode[] = []

      // Handle odd number of nodes at this level
      if (currentLevel.length % 2 !== 0) {
        const lastNode = currentLevel[currentLevel.length - 1]
        currentLevel.push({
          hash: lastNode.hash,
          data: lastNode.data
        })
      }

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = currentLevel[i + 1]
        
        const parentHash = this.combineHashes(left.hash, right.hash)
        const parentNode: MerkleNode = {
          hash: parentHash,
          left,
          right
        }

        nextLevel.push(parentNode)
      }

      currentLevel = nextLevel
    }

    this.root = currentLevel[0]
  }

  /**
   * Gets the root hash of the tree
   */
  public getRoot(): string {
    if (!this.root) {
      throw new Error('Tree has not been built yet')
    }
    return this.root.hash
  }

  /**
   * Gets all leaf hashes (user IDs hashed)
   */
  public getLeaves(): string[] {
    return this.leaves.map(userId => this.hash(userId))
  }

  /**
   * Gets the original user IDs
   */
  public getUserIds(): string[] {
    return [...this.leaves]
  }

  /**
   * Generates a Merkle proof for a given user ID
   */
  public generateProof(userId: string): MerkleProof {
    if (!this.root) {
      throw new Error('Tree has not been built yet')
    }

    const leafIndex = this.leaves.indexOf(userId)
    if (leafIndex === -1) {
      throw new Error(`User ID ${userId} not found in tree`)
    }

    const leafHash = this.hash(userId)
    const proof = this.buildProofPath(leafIndex)
    
    return {
      leaf: leafHash,
      proof,
      root: this.root.hash
    }
  }

  /**
   * Builds the proof path by reconstructing the tree structure
   */
  private buildProofPath(leafIndex: number): Array<{ hash: string; position: 'left' | 'right' }> {
    const proof: Array<{ hash: string; position: 'left' | 'right' }> = []
    
    // Create leaf level - exactly as done in buildTree
    let currentLevel: string[] = this.leaves.map(userId => this.hash(userId))
    
    // If odd number of nodes, duplicate the last one (same as buildTree)
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1])
    }

    let currentIndex = leafIndex
    
    // Build proof by going up the tree level by level
    while (currentLevel.length > 1) {
      // Handle odd number of nodes at this level (same as buildTree)
      if (currentLevel.length % 2 !== 0) {
        currentLevel.push(currentLevel[currentLevel.length - 1])
      }

      // Find sibling and add to proof
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1
      
      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex],
          position: currentIndex % 2 === 0 ? 'right' : 'left'
        })
      }

      // Move to next level
      const nextLevel: string[] = []
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = currentLevel[i + 1]
        nextLevel.push(this.combineHashes(left, right))
      }

      currentLevel = nextLevel
      currentIndex = Math.floor(currentIndex / 2)
    }
    
    return proof
  }

  /**
   * Verifies a Merkle proof
   */
  public static verifyProof(proof: MerkleProof): boolean {
    let currentHash = proof.leaf

    for (const step of proof.proof) {
      if (step.position === 'left') {
        currentHash = crypto.createHash('sha256').update(step.hash + currentHash).digest('hex')
      } else {
        currentHash = crypto.createHash('sha256').update(currentHash + step.hash).digest('hex')
      }
    }

    return currentHash === proof.root
  }

  /**
   * Checks if a user ID exists in the tree
   */
  public isMember(userId: string): boolean {
    return this.leaves.includes(userId)
  }

  /**
   * Gets tree statistics
   */
  public getStats(): {
    totalMembers: number
    treeDepth: number
    rootHash: string
  } {
    if (!this.root) {
      throw new Error('Tree has not been built yet')
    }

    return {
      totalMembers: this.leaves.length,
      treeDepth: Math.ceil(Math.log2(this.leaves.length)),
      rootHash: this.root.hash
    }
  }

  /**
   * Adds a new member to the group and rebuilds the tree
   */
  public addMember(userId: string): void {
    if (this.leaves.includes(userId)) {
      throw new Error(`User ID ${userId} already exists in the group`)
    }
    
    this.leaves.push(userId)
    this.buildTree(this.leaves)
  }

  /**
   * Removes a member from the group and rebuilds the tree
   */
  public removeMember(userId: string): void {
    const index = this.leaves.indexOf(userId)
    if (index === -1) {
      throw new Error(`User ID ${userId} not found in the group`)
    }
    
    this.leaves.splice(index, 1)
    
    if (this.leaves.length === 0) {
      this.root = null
    } else {
      this.buildTree(this.leaves)
    }
  }

  /**
   * Updates the entire group membership and rebuilds the tree
   */
  public updateGroup(userIds: string[]): void {
    this.buildTree(userIds)
  }
}
