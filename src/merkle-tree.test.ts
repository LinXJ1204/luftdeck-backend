import { MerkleTree, MerkleProof } from './merkle-tree'

/**
 * Simple test runner
 */
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = []
  private passed = 0
  private failed = 0

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn })
  }

  run() {
    console.log('🌳 Running Merkle Tree Tests...\n')
    
    for (const test of this.tests) {
      try {
        test.fn()
        console.log(`✅ ${test.name}`)
        this.passed++
      } catch (error) {
        console.log(`❌ ${test.name}`)
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
        this.failed++
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`)
    
    if (this.failed > 0) {
      process.exit(1)
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

// Test suite
const runner = new TestRunner()

runner.test('should create empty tree', () => {
  const tree = new MerkleTree()
  assert(tree.getUserIds().length === 0, 'Empty tree should have no user IDs')
})

runner.test('should build tree from single user', () => {
  const userIds = ['user1']
  const tree = new MerkleTree(userIds)
  
  assertEquals(tree.getUserIds().length, 1, 'Tree should have 1 user')
  assertEquals(tree.getUserIds()[0], 'user1', 'User ID should match')
  assert(tree.getRoot().length === 64, 'Root hash should be 64 characters (SHA-256)')
})

runner.test('should build tree from multiple users', () => {
  const userIds = ['user1', 'user2', 'user3', 'user4']
  const tree = new MerkleTree(userIds)
  
  assertEquals(tree.getUserIds().length, 4, 'Tree should have 4 users')
  assert(tree.getRoot().length === 64, 'Root hash should be 64 characters')
  
  const stats = tree.getStats()
  assertEquals(stats.totalMembers, 4, 'Stats should show 4 members')
  assertEquals(stats.treeDepth, 2, 'Tree depth should be 2 for 4 members')
})

runner.test('should handle odd number of users', () => {
  const userIds = ['user1', 'user2', 'user3']
  const tree = new MerkleTree(userIds)
  
  assertEquals(tree.getUserIds().length, 3, 'Tree should have 3 users')
  assert(tree.getRoot().length === 64, 'Root hash should be valid')
})

runner.test('should check membership correctly', () => {
  const userIds = ['alice', 'bob', 'charlie']
  const tree = new MerkleTree(userIds)
  
  assert(tree.isMember('alice'), 'Alice should be a member')
  assert(tree.isMember('bob'), 'Bob should be a member')
  assert(tree.isMember('charlie'), 'Charlie should be a member')
  assert(!tree.isMember('david'), 'David should not be a member')
})

runner.test('should generate and verify proof for existing member', () => {
  const userIds = ['alice', 'bob', 'charlie', 'david']
  const tree = new MerkleTree(userIds)
  
  const proof = tree.generateProof('alice')
  assert(proof.leaf.length === 64, 'Proof leaf should be valid hash')
  assert(proof.root === tree.getRoot(), 'Proof root should match tree root')
  assert(MerkleTree.verifyProof(proof), 'Proof should be valid')
})

runner.test('should fail to generate proof for non-member', () => {
  const userIds = ['alice', 'bob', 'charlie']
  const tree = new MerkleTree(userIds)
  
  try {
    tree.generateProof('david')
    assert(false, 'Should throw error for non-member')
  } catch (error) {
    assert(error instanceof Error && error.message.includes('not found'), 'Should throw appropriate error')
  }
})

runner.test('should add new member', () => {
  const userIds = ['alice', 'bob']
  const tree = new MerkleTree(userIds)
  const originalRoot = tree.getRoot()
  
  tree.addMember('charlie')
  
  assertEquals(tree.getUserIds().length, 3, 'Tree should have 3 members after adding')
  assert(tree.isMember('charlie'), 'Charlie should be a member')
  assert(tree.getRoot() !== originalRoot, 'Root should change after adding member')
})

runner.test('should not add duplicate member', () => {
  const userIds = ['alice', 'bob']
  const tree = new MerkleTree(userIds)
  
  try {
    tree.addMember('alice')
    assert(false, 'Should throw error for duplicate member')
  } catch (error) {
    assert(error instanceof Error && error.message.includes('already exists'), 'Should throw appropriate error')
  }
})

runner.test('should remove member', () => {
  const userIds = ['alice', 'bob', 'charlie']
  const tree = new MerkleTree(userIds)
  const originalRoot = tree.getRoot()
  
  tree.removeMember('bob')
  
  assertEquals(tree.getUserIds().length, 2, 'Tree should have 2 members after removal')
  assert(!tree.isMember('bob'), 'Bob should not be a member')
  assert(tree.getRoot() !== originalRoot, 'Root should change after removing member')
})

runner.test('should not remove non-existent member', () => {
  const userIds = ['alice', 'bob']
  const tree = new MerkleTree(userIds)
  
  try {
    tree.removeMember('charlie')
    assert(false, 'Should throw error for non-existent member')
  } catch (error) {
    assert(error instanceof Error && error.message.includes('not found'), 'Should throw appropriate error')
  }
})

runner.test('should update entire group', () => {
  const originalUsers = ['alice', 'bob']
  const tree = new MerkleTree(originalUsers)
  const originalRoot = tree.getRoot()
  
  const newUsers = ['charlie', 'david', 'eve']
  tree.updateGroup(newUsers)
  
  assertEquals(tree.getUserIds().length, 3, 'Tree should have 3 members')
  assert(!tree.isMember('alice'), 'Alice should no longer be a member')
  assert(!tree.isMember('bob'), 'Bob should no longer be a member')
  assert(tree.isMember('charlie'), 'Charlie should be a member')
  assert(tree.getRoot() !== originalRoot, 'Root should change after group update')
})

runner.test('should handle large group', () => {
  const userIds = Array.from({ length: 100 }, (_, i) => `user${i}`)
  const tree = new MerkleTree(userIds)
  
  assertEquals(tree.getUserIds().length, 100, 'Tree should have 100 members')
  assert(tree.getRoot().length === 64, 'Root should be valid')
  
  // Test proof generation for random member
  const randomUser = userIds[42]
  const proof = tree.generateProof(randomUser)
  assert(MerkleTree.verifyProof(proof), 'Proof should be valid for large tree')
})

runner.test('should maintain consistent root for same group', () => {
  const userIds = ['alice', 'bob', 'charlie']
  const tree1 = new MerkleTree(userIds)
  const tree2 = new MerkleTree(userIds)
  
  assertEquals(tree1.getRoot(), tree2.getRoot(), 'Same group should produce same root')
})

runner.test('should produce different roots for different groups', () => {
  const tree1 = new MerkleTree(['alice', 'bob', 'charlie'])
  const tree2 = new MerkleTree(['alice', 'bob', 'david'])
  
  assert(tree1.getRoot() !== tree2.getRoot(), 'Different groups should have different roots')
})

// Run all tests
if (require.main === module) {
  runner.run()
}

export { runner }
