import { MerkleTree } from './merkle-tree'

/**
 * Example usage of the Merkle Tree package for group management
 */

console.log('🌳 Merkle Tree Group Management Examples\n')

// Example 1: Basic group creation and root calculation
console.log('📝 Example 1: Basic Group Creation')
console.log('=====================================')

const groupMembers = ['alice123', 'bob456', 'charlie789', 'diana012']
const merkleTree = new MerkleTree(groupMembers)

console.log('Group members:', groupMembers)
console.log('Merkle root:', merkleTree.getRoot())
console.log('Tree stats:', merkleTree.getStats())
console.log()

// Example 2: Membership verification
console.log('🔍 Example 2: Membership Verification')
console.log('=====================================')

console.log('Is alice123 a member?', merkleTree.isMember('alice123'))
console.log('Is eve345 a member?', merkleTree.isMember('eve345'))
console.log()

// Example 3: Proof generation and verification
console.log('🔐 Example 3: Cryptographic Proof')
console.log('=================================')

try {
  const proof = merkleTree.generateProof('alice123')
  console.log('Generated proof for alice123:')
  console.log('- Leaf hash:', proof.leaf)
  console.log('- Root hash:', proof.root)
  console.log('- Proof steps:', proof.proof.length)
  console.log('- Proof valid:', MerkleTree.verifyProof(proof))
} catch (error) {
  console.log('Error generating proof:', error instanceof Error ? error.message : String(error))
}
console.log()

// Example 4: Dynamic group management
console.log('👥 Example 4: Dynamic Group Management')
console.log('======================================')

const dynamicGroup = new MerkleTree(['user1', 'user2', 'user3'])
console.log('Initial group size:', dynamicGroup.getUserIds().length)
console.log('Initial root:', dynamicGroup.getRoot().substring(0, 16) + '...')

// Add a new member
dynamicGroup.addMember('user4')
console.log('After adding user4:')
console.log('- Group size:', dynamicGroup.getUserIds().length)
console.log('- New root:', dynamicGroup.getRoot().substring(0, 16) + '...')

// Remove a member
dynamicGroup.removeMember('user2')
console.log('After removing user2:')
console.log('- Group size:', dynamicGroup.getUserIds().length)
console.log('- New root:', dynamicGroup.getRoot().substring(0, 16) + '...')
console.log()

// Example 5: Large group handling
console.log('📊 Example 5: Large Group Handling')
console.log('===================================')

const largeGroup = Array.from({ length: 1000 }, (_, i) => `user${i.toString().padStart(4, '0')}`)
const largeMerkleTree = new MerkleTree(largeGroup)

console.log('Large group stats:', largeMerkleTree.getStats())

// Generate proof for a random member
const randomMember = largeGroup[Math.floor(Math.random() * largeGroup.length)]
const largeGroupProof = largeMerkleTree.generateProof(randomMember)
console.log(`Proof for ${randomMember} has ${largeGroupProof.proof.length} steps`)
console.log('Proof verification:', MerkleTree.verifyProof(largeGroupProof))
console.log()

// Example 6: Group comparison
console.log('⚖️  Example 6: Group Comparison')
console.log('===============================')

const group1 = new MerkleTree(['alice', 'bob', 'charlie'])
const group2 = new MerkleTree(['alice', 'bob', 'charlie'])
const group3 = new MerkleTree(['alice', 'bob', 'david'])

console.log('Group 1 root:', group1.getRoot().substring(0, 16) + '...')
console.log('Group 2 root:', group2.getRoot().substring(0, 16) + '...')
console.log('Group 3 root:', group3.getRoot().substring(0, 16) + '...')

console.log('Group 1 === Group 2?', group1.getRoot() === group2.getRoot())
console.log('Group 1 === Group 3?', group1.getRoot() === group3.getRoot())
console.log()

// Example 7: Real-world scenario - Team management
console.log('🏢 Example 7: Team Management Scenario')
console.log('======================================')

class TeamManager {
  private teams: Map<string, MerkleTree> = new Map()

  createTeam(teamName: string, members: string[]): string {
    const tree = new MerkleTree(members)
    this.teams.set(teamName, tree)
    return tree.getRoot()
  }

  addTeamMember(teamName: string, userId: string): string {
    const team = this.teams.get(teamName)
    if (!team) throw new Error('Team not found')
    
    team.addMember(userId)
    return team.getRoot()
  }

  verifyTeamMembership(teamName: string, userId: string): boolean {
    const team = this.teams.get(teamName)
    if (!team) return false
    
    return team.isMember(userId)
  }

  getTeamProof(teamName: string, userId: string) {
    const team = this.teams.get(teamName)
    if (!team) throw new Error('Team not found')
    
    return team.generateProof(userId)
  }

  getTeamStats(teamName: string) {
    const team = this.teams.get(teamName)
    if (!team) throw new Error('Team not found')
    
    return team.getStats()
  }
}

const teamManager = new TeamManager()

// Create development team
const devTeamRoot = teamManager.createTeam('development', [
  'dev001', 'dev002', 'dev003', 'dev004'
])
console.log('Created development team with root:', devTeamRoot.substring(0, 16) + '...')

// Add new developer
const newDevTeamRoot = teamManager.addTeamMember('development', 'dev005')
console.log('Added new developer, new root:', newDevTeamRoot.substring(0, 16) + '...')

// Verify membership
console.log('Is dev003 in development team?', teamManager.verifyTeamMembership('development', 'dev003'))
console.log('Is marketing001 in development team?', teamManager.verifyTeamMembership('development', 'marketing001'))

// Get team stats
console.log('Development team stats:', teamManager.getTeamStats('development'))

console.log('\n✅ All examples completed successfully!')
