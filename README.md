# Luftdeck Backend - Merkle Tree Package

A comprehensive Merkle tree implementation for group membership management, where each node represents a group member identified by their userId.

## Features

- ✅ **Group Management**: Create trees from arrays of user IDs
- ✅ **Root Calculation**: Efficiently compute the Merkle root
- ✅ **Membership Verification**: Check if a user is part of the group
- ✅ **Cryptographic Proofs**: Generate and verify Merkle proofs for membership
- ✅ **Dynamic Updates**: Add/remove members and update groups
- ✅ **Large Group Support**: Handles groups of any size efficiently
- ✅ **TypeScript Support**: Full type safety and IntelliSense

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { MerkleTree } from './src/merkle-tree'

// Create a group with member user IDs
const groupMembers = ['alice123', 'bob456', 'charlie789', 'diana012']
const merkleTree = new MerkleTree(groupMembers)

// Get the Merkle root
const root = merkleTree.getRoot()
console.log('Merkle root:', root)

// Check membership
const isAliceMember = merkleTree.isMember('alice123')
console.log('Is Alice a member?', isAliceMember)

// Generate cryptographic proof
const proof = merkleTree.generateProof('alice123')
console.log('Proof valid:', MerkleTree.verifyProof(proof))
```

## API Reference

### `MerkleTree`

#### Constructor
```typescript
new MerkleTree(userIds?: string[])
```
Creates a new Merkle tree from an array of user IDs.

#### Methods

##### `buildTree(userIds: string[]): void`
Builds the Merkle tree from an array of user IDs.

##### `getRoot(): string`
Returns the Merkle root hash as a hex string.

##### `getUserIds(): string[]`
Returns a copy of the original user IDs array.

##### `getLeaves(): string[]`
Returns the leaf hashes (user IDs hashed) as hex strings.

##### `isMember(userId: string): boolean`
Checks if a user ID exists in the tree.

##### `generateProof(userId: string): MerkleProof`
Generates a Merkle proof for a given user ID.

##### `addMember(userId: string): void`
Adds a new member to the group and rebuilds the tree.

##### `removeMember(userId: string): void`
Removes a member from the group and rebuilds the tree.

##### `updateGroup(userIds: string[]): void`
Updates the entire group membership and rebuilds the tree.

##### `getStats(): object`
Returns tree statistics including total members, tree depth, and root hash.

#### Static Methods

##### `MerkleTree.verifyProof(proof: MerkleProof): boolean`
Verifies a Merkle proof without needing the original tree.

### `MerkleProof`

```typescript
interface MerkleProof {
  leaf: string          // The leaf hash being proved
  proof: Array<{        // Array of sibling hashes and positions
    hash: string
    position: 'left' | 'right'
  }>
  root: string          // The expected root hash
}
```

## Examples

### Basic Usage

```typescript
import { MerkleTree } from './src/merkle-tree'

// Create a group
const tree = new MerkleTree(['user1', 'user2', 'user3', 'user4'])

console.log('Root:', tree.getRoot())
console.log('Members:', tree.getUserIds().length)
console.log('Tree depth:', tree.getStats().treeDepth)
```

### Membership Verification

```typescript
const tree = new MerkleTree(['alice', 'bob', 'charlie'])

// Check membership
console.log(tree.isMember('alice'))    // true
console.log(tree.isMember('david'))    // false
```

### Cryptographic Proofs

```typescript
const tree = new MerkleTree(['alice', 'bob', 'charlie', 'david'])

// Generate proof for Alice
const proof = tree.generateProof('alice')

// Verify proof (can be done without the original tree)
const isValid = MerkleTree.verifyProof(proof)
console.log('Proof valid:', isValid)
```

### Dynamic Group Management

```typescript
const tree = new MerkleTree(['user1', 'user2'])

// Add a member
tree.addMember('user3')
console.log('Size after adding:', tree.getUserIds().length) // 3

// Remove a member
tree.removeMember('user1')
console.log('Size after removing:', tree.getUserIds().length) // 2

// Update entire group
tree.updateGroup(['newUser1', 'newUser2', 'newUser3'])
console.log('New size:', tree.getUserIds().length) // 3
```

### Large Groups

```typescript
// Create a large group
const largeGroup = Array.from({ length: 10000 }, (_, i) => `user${i}`)
const tree = new MerkleTree(largeGroup)

console.log('Large group stats:', tree.getStats())

// Proof generation is still efficient
const proof = tree.generateProof('user5000')
console.log('Proof steps:', proof.proof.length)
console.log('Proof valid:', MerkleTree.verifyProof(proof))
```

### Team Management Scenario

```typescript
class TeamManager {
  private teams = new Map<string, MerkleTree>()

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

  verifyMembership(teamName: string, userId: string): boolean {
    const team = this.teams.get(teamName)
    return team?.isMember(userId) ?? false
  }

  getTeamProof(teamName: string, userId: string) {
    const team = this.teams.get(teamName)
    if (!team) throw new Error('Team not found')
    return team.generateProof(userId)
  }
}

// Usage
const manager = new TeamManager()
const devTeamRoot = manager.createTeam('development', ['dev1', 'dev2', 'dev3'])
console.log('Dev team root:', devTeamRoot)
```

## Running Tests

```bash
npm test
```

## Running Examples

```bash
npm run example
```

## Technical Details

### Hash Function
The implementation uses SHA-256 for all hashing operations, providing 256-bit security.

### Tree Structure
- Leaf nodes contain hashed user IDs
- Internal nodes contain combined hashes of their children
- Odd numbers of nodes are handled by duplicating the last node
- Tree is built bottom-up for efficiency

### Proof Structure
Merkle proofs contain:
- The leaf hash being proved
- An array of sibling hashes with their positions (left/right)
- The expected root hash

### Performance
- Tree construction: O(n) where n is the number of members
- Proof generation: O(log n)
- Proof verification: O(log n)
- Memory usage: O(n)

## Use Cases

1. **Group Membership Verification**: Efficiently prove membership in large groups
2. **Access Control**: Verify user permissions without storing entire member lists
3. **Audit Trails**: Create tamper-evident logs of group membership
4. **Distributed Systems**: Synchronize group membership across nodes
5. **Privacy-Preserving Authentication**: Prove membership without revealing other members

## Security Considerations

- Uses SHA-256 for cryptographic security
- Merkle proofs provide mathematical certainty of membership
- Root hash serves as a compact group fingerprint
- Changes to any member result in a different root hash
- Proofs can be verified independently without the original tree

## License

ISC
