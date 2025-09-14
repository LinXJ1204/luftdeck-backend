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
- ✅ **Blockchain Integration**: Built-in support for Ethereum blockchain interaction with ethers.js

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# Blockchain Configuration
# Your private key for blockchain interactions (without 0x prefix)
# NEVER commit your actual private key to version control
PRIVATE_KEY=your_private_key_here

# Optional: RPC URL for blockchain connection
# RPC_URL=https://your-rpc-endpoint-here
```

**Important**: Never commit your actual private key to version control. The `.env` file is already in `.gitignore` to prevent accidental commits.

## ENS API Endpoints

The application provides secure REST API endpoints for ENS (Ethereum Name Service) operations. These endpoints are read-only and do not expose sensitive wallet functionality.

### GET `/ens/available/:ensName`
Check if an ENS name is available for registration.

**Example:**
```bash
curl http://localhost:3000/ens/available/myname.eth
```

**Response:**
```json
{
  "ensName": "myname.eth",
  "available": true,
  "checked_at": "2024-01-15T10:30:00.000Z"
}
```

### GET `/ens/price/:ensName?years=1`
Get the registration price for an ENS name.

**Parameters:**
- `years` (optional): Registration duration in years (1-10, default: 1)

**Example:**
```bash
curl http://localhost:3000/ens/price/myname.eth?years=2
```

**Response:**
```json
{
  "ensName": "myname.eth",
  "duration_years": 2,
  "price_eth": "0.0062",
  "checked_at": "2024-01-15T10:30:00.000Z"
}
```

### GET `/ens/resolve/:ensName`
Resolve an ENS name to its Ethereum address.

**Example:**
```bash
curl http://localhost:3000/ens/resolve/vitalik.eth
```

**Response:**
```json
{
  "ensName": "vitalik.eth",
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "resolved_at": "2024-01-15T10:30:00.000Z"
}
```

### GET `/ens/reverse/:address`
Reverse resolve an Ethereum address to its ENS name.

**Example:**
```bash
curl http://localhost:3000/ens/reverse/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

**Response:**
```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "ensName": "vitalik.eth",
  "resolved_at": "2024-01-15T10:30:00.000Z"
}
```

## Secure Wallet Service

For security reasons, wallet functionality is **not exposed via API endpoints**. Instead, the `WalletService` class provides secure blockchain interaction capabilities for internal use only.

### Using WalletService

```typescript
import { WalletService } from './src/wallet-service'

// Initialize with private key and RPC URL
const walletService = new WalletService(privateKey, rpcUrl)

// Check if wallet is ready
if (walletService.isReady()) {
  // Get wallet address
  const address = walletService.getAddress()
  
  // Get balance
  const balance = await walletService.getBalance()
  
  // Send transaction
  const tx = await walletService.sendTransaction(
    "0x742d35Cc6634C0532925a3b8D8F7E4D9f45F8b5f", 
    "0.1"
  )
  
  // Wait for confirmation
  const receipt = await walletService.waitForTransaction(tx.hash)
}
```

### WalletService Methods

#### Core Wallet Operations
- `getAddress()`: Get wallet address
- `getBalance(address?)`: Get ETH balance for address
- `sendTransaction(to, value, data?)`: Send ETH transaction
- `sendTransactionWithGasEstimation(to, value, data?)`: Send transaction with automatic gas estimation
- `signMessage(message)`: Sign a message
- `getTransactionReceipt(txHash)`: Get transaction receipt
- `waitForTransaction(txHash, confirmations?)`: Wait for transaction confirmation
- `getGasPrice()`: Get current gas price
- `isReady()`: Check if wallet is initialized and ready

#### ENS (Ethereum Name Service) Operations
- `registerENS(ensName, targetAddress, durationInYears?)`: Register a new ENS name for an address
- `isENSAvailable(ensName)`: Check if an ENS name is available for registration
- `getENSRegistrationPrice(ensName, durationInYears?)`: Get the registration price for an ENS name
- `resolveENS(ensName)`: Resolve an ENS name to an address
- `reverseResolveENS(address)`: Get the ENS name for an address (reverse resolution)

### ENS Registration Example

```typescript
import { WalletService } from './src/wallet-service'

const walletService = new WalletService(privateKey, rpcUrl)

// Check if an ENS name is available
const isAvailable = await walletService.isENSAvailable('myname.eth')
console.log('Available:', isAvailable)

// Get registration price
const price = await walletService.getENSRegistrationPrice('myname.eth', 1) // 1 year
console.log('Registration price:', price, 'ETH')

// Register ENS name for a specific address
if (isAvailable) {
  const targetAddress = '0x742d35Cc6634C0532925a3b8D8F7E4D9f45F8b5f'
  const tx = await walletService.registerENS('myname.eth', targetAddress, 1)
  
  // Wait for registration to complete
  const receipt = await walletService.waitForTransaction(tx.hash)
  console.log('ENS registered successfully!', receipt?.status)
}

// Resolve ENS name to address
const resolvedAddress = await walletService.resolveENS('vitalik.eth')
console.log('vitalik.eth resolves to:', resolvedAddress)

// Reverse resolve address to ENS name
const ensName = await walletService.reverseResolveENS('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
console.log('Address resolves to ENS:', ensName)
```

**Important Notes for ENS Registration:**
- ENS registration requires a two-step process (commit-reveal) for security
- There's a mandatory waiting period (usually 1 minute) between commit and registration
- Registration requires payment in ETH - ensure your wallet has sufficient balance
- Only works on Ethereum mainnet (ENS contracts are not deployed on testnets in the same way)

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
