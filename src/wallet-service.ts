import { ethers } from 'ethers'
import { addEnsContracts } from '@ensdomains/ensjs'
import { setRecords } from '@ensdomains/ensjs/wallet'
import { getRecords } from '@ensdomains/ensjs/public'
import { createWalletClient, http, createPublicClient } from 'viem'
import { sepolia } from 'viem/chains'

// ENS Registrar Controller contract address (Ethereum Sepolia Testnet)
const ENS_REGISTRAR_CONTROLLER = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968' // ETH Registrar Controller
// ENS Registry contract
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

// ENS Record Types
export interface ENSTextRecord {
  key: string
  value: string
}

export interface ENSCoinRecord {
  coin: string
  value: string
}

export interface ENSRecordUpdate {
  name: string
  texts?: ENSTextRecord[]
  coins?: ENSCoinRecord[]
  resolverAddress?: string
}

/**
 * Secure Wallet Service for blockchain interactions
 * This service encapsulates wallet functionality and should not be exposed via API
 */
export class WalletService {
  private wallet: ethers.Wallet | null = null
  private provider: ethers.JsonRpcProvider | null = null
  private viemWalletClient: any = null
  private viemPublicClient: any = null
  private readonly rpcUrl: string

  constructor(privateKey?: string, rpcUrl?: string) {
    this.rpcUrl = rpcUrl || 'https://eth-sepolia.g.alchemy.com/v2/demo' // Default to Sepolia for ENS testing
    
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl)
      
      // Initialize Viem clients for ENS operations
      this.viemPublicClient = createPublicClient({
        chain: addEnsContracts(sepolia),
        transport: http(this.rpcUrl)
      })
      
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider)
        
        // Create Viem wallet client for ENS record operations
        const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
        this.viemWalletClient = createWalletClient({
          chain: addEnsContracts(sepolia),
          transport: http(this.rpcUrl),
          account: formattedPrivateKey as `0x${string}`
        })
        
        console.log('✅ WalletService initialized successfully')
        console.log('📍 Wallet address:', this.wallet.address)
      } else {
        console.warn('⚠️  WalletService initialized without private key - read-only mode')
      }
    } catch (error) {
      console.error('❌ Failed to initialize WalletService:', error)
      throw error
    }
  }

  /**
   * Get wallet address
   */
  public getAddress(): string {
    if (!this.wallet) {
      throw new Error('Wallet not initialized')
    }
    return this.wallet.address
  }

  /**
   * Get balance for an address (or wallet address if not provided)
   */
  public async getBalance(address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    
    const targetAddress = address || this.wallet?.address
    if (!targetAddress) {
      throw new Error('No address provided and wallet not initialized')
    }
    
    const balance = await this.provider.getBalance(targetAddress)
    return ethers.formatEther(balance)
  }

  /**
   * Send ETH transaction
   */
  public async sendTransaction(to: string, value: string, data?: string): Promise<ethers.TransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized for sending transactions')
    }
    
    const tx = {
      to,
      value: ethers.parseEther(value),
      data: data || '0x'
    }
    
    return await this.wallet.sendTransaction(tx)
  }

  /**
   * Send transaction with gas estimation
   */
  public async sendTransactionWithGasEstimation(
    to: string, 
    value: string, 
    data?: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized for sending transactions')
    }
    
    const tx = {
      to,
      value: ethers.parseEther(value),
      data: data || '0x'
    }
    
    // Estimate gas
    const gasEstimate = await this.wallet.estimateGas(tx)
    const gasPrice = await this.provider!.getFeeData()
    
    const txWithGas = {
      ...tx,
      gasLimit: gasEstimate,
      gasPrice: gasPrice.gasPrice
    }
    
    return await this.wallet.sendTransaction(txWithGas)
  }

  /**
   * Sign a message
   */
  public async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized for signing')
    }
    
    return await this.wallet.signMessage(message)
  }

  /**
   * Get transaction receipt
   */
  public async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    
    return await this.provider.getTransactionReceipt(txHash)
  }

  /**
   * Wait for transaction confirmation
   */
  public async waitForTransaction(txHash: string, confirmations: number = 1): Promise<ethers.TransactionReceipt | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    
    return await this.provider.waitForTransaction(txHash, confirmations)
  }

  /**
   * Get current gas price
   */
  public async getGasPrice(): Promise<bigint | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    
    const feeData = await this.provider.getFeeData()
    return feeData.gasPrice
  }

  /**
   * Check if wallet is initialized and ready for transactions
   */
  public isReady(): boolean {
    return this.wallet !== null && this.provider !== null
  }

  /**
   * Get wallet info (for internal use only)
   */
  public getWalletInfo(): { address: string; rpcUrl: string; isReady: boolean } {
    return {
      address: this.wallet?.address || 'Not initialized',
      rpcUrl: this.rpcUrl,
      isReady: this.isReady()
    }
  }

  // ENS Registration Methods

  /**
   * Register a new ENS name for the specified address
   * @param ensName The ENS name to register (e.g., "myname.eth")
   * @param targetAddress The address to point the ENS name to
   * @param durationInYears How many years to register for (default: 1)
   * @returns Transaction response for the registration
   */
  public async registerENS(
    ensName: string, 
    targetAddress: string, 
    durationInYears: number = 1
  ): Promise<ethers.TransactionResponse> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet and provider must be initialized for ENS registration')
    }

    const name = ensName.replace('.eth', '')
    
    // Check if name is available
    const isAvailable = await this.isENSAvailable(ensName)
    if (!isAvailable) {
      throw new Error(`ENS name ${ensName} is not available`)
    }
    
    // ENS Registrar Controller ABI (Registration tuple + Price struct)
    const registrarABI = [
      'function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium) price)',
      'function available(string label) view returns (bool)',
      'function makeCommitment((string label,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,uint8 reverseRecord,bytes32 referrer) registration) pure returns (bytes32 commitment)',
      'function commit(bytes32 commitment)',
      'function register((string label,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,uint8 reverseRecord,bytes32 referrer) registration) payable',
      'function minCommitmentAge() view returns (uint256)',
      'function maxCommitmentAge() view returns (uint256)'
    ]

    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.wallet)

    // Calculate registration duration in seconds
    const duration = durationInYears * 365 * 24 * 60 * 60

    // Query price (base + premium)
    const priceStruct = await registrarContract.rentPrice(name, duration)
    const totalPrice: bigint = (priceStruct.base as bigint) + (priceStruct.premium as bigint)
    
    // Generate a random secret for the commitment
    const secret = ethers.randomBytes(32)
    
    // Public resolver address (Ethereum Sepolia Testnet)
    const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' // Public Resolver
    
    // Build registration tuple
    const registration = {
      label: name,
      owner: targetAddress,
      duration,
      secret,
      resolver: PUBLIC_RESOLVER,
      data: [] as `0x${string}`[],
      reverseRecord: 0,
      referrer: ethers.ZeroHash
    }

    // Make commitment
    const commitment = await registrarContract.makeCommitment(registration)

    // Step 1: Commit
    console.log('🔄 Committing ENS registration...')
    const commitTx = await registrarContract.commit(commitment)
    await commitTx.wait()
    
    // Wait for minimum commitment age (usually 1 minute)
    const minCommitmentAge = await registrarContract.minCommitmentAge()
    console.log(`⏳ Waiting ${minCommitmentAge} seconds for commitment to mature...`)
    
    // Wait for commitment to mature
    await new Promise(resolve => setTimeout(resolve, Number(minCommitmentAge) * 1000 + 5000)) // Add 5 seconds buffer

    // Step 2: Register
    console.log('🔄 Registering ENS name...')
    const registerTx = await registrarContract.register(registration, { value: totalPrice })

    console.log(`✅ ENS registration transaction sent: ${registerTx.hash}`)
    return registerTx
  }

  /**
   * Check if an ENS name is available for registration
   * @param ensName The ENS name to check (e.g., "myname.eth")
   * @returns True if available, false if taken
   */
  public async isENSAvailable(ensName: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }
    
    const registrarABI = ['function available(string label) view returns (bool)']
    
    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.provider)
    
    try {
      const label = ensName.replace('.eth', '')
      return await registrarContract.available(label)
    } catch (error) {
      console.error('Error checking ENS availability:', error)
      return false
    }
  }

  /**
   * Get the registration price for an ENS name
   * @param ensName The ENS name to check pricing for
   * @param durationInYears Registration duration in years
   * @returns Price in ETH as string
   */
  public async getENSRegistrationPrice(ensName: string, durationInYears: number = 1): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    const label = ensName.replace('.eth', '')
    const duration = durationInYears * 365 * 24 * 60 * 60

    const registrarABI = ['function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium) price)']
    
    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.provider)
    
    try {
      const priceStruct = await registrarContract.rentPrice(label, duration)
      const total: bigint = (priceStruct.base as bigint) + (priceStruct.premium as bigint)
      return ethers.formatEther(total)
    } catch (error) {
      console.error('Error getting ENS price:', error)
      throw error
    }
  }

  /**
   * Resolve an ENS name to an address
   * @param ensName The ENS name to resolve (e.g., "vitalik.eth")
   * @returns The resolved address or null if not found
   */
  public async resolveENS(ensName: string): Promise<string | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    try {
      return await this.provider.resolveName(ensName)
    } catch (error) {
      console.error('Error resolving ENS name:', error)
      return null
    }
  }

  /**
   * Get the ENS name for an address (reverse resolution)
   * @param address The address to look up
   * @returns The ENS name or null if not found
   */
  public async reverseResolveENS(address: string): Promise<string | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    try {
      return await this.provider.lookupAddress(address)
    } catch (error) {
      console.error('Error reverse resolving ENS:', error)
      return null
    }
  }

  // ENS Record Management Methods

  /**
   * Set ENS records for a domain name
   * @param recordUpdate The record update configuration
   * @returns Transaction hash
   */
  public async setENSRecords(recordUpdate: ENSRecordUpdate): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized for ENS record operations')
    }

    try {
      // Default resolver address for Sepolia testnet
      const defaultResolver = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5'
      
      const resolverAddr = recordUpdate.resolverAddress || defaultResolver
      
      // ENS Resolver ABI with setText function only
      const resolverABI = [
        'function setText(bytes32 node, string key, string value) external'
      ]
      
      const resolver = new ethers.Contract(resolverAddr, resolverABI, this.wallet)
      
      // Calculate the namehash for the ENS name
      if (!recordUpdate.name.endsWith('.eth')) {
        recordUpdate.name = `${recordUpdate.name}.eth`
      }
      const namehash = ethers.namehash(recordUpdate.name)
      
      const transactions: Promise<ethers.TransactionResponse>[] = []
      
      // Set text records only
      if (recordUpdate.texts && recordUpdate.texts.length > 0) {
        for (const textRecord of recordUpdate.texts) {
          transactions.push(resolver.setText(namehash, textRecord.key, textRecord.value))
        }
      }
      
      // Execute the first transaction and return its hash
      if (transactions.length > 0) {
        const tx = await transactions[0]
        console.log(`✅ ENS text records set for ${recordUpdate.name}: ${tx.hash}`)
        
        // Wait for subsequent transactions if any
        if (transactions.length > 1) {
          console.log(`🔄 Setting ${transactions.length - 1} additional text records...`)
          await Promise.all(transactions.slice(1))
        }
        
        return tx.hash
      } else {
        throw new Error('No text records to set')
      }
    } catch (error) {
      console.error('Error setting ENS records:', error)
      throw error
    }
  }

  /**
   * Set a single text record for an ENS name
   * @param ensName The ENS name (e.g., "myname.eth")
   * @param key The record key (e.g., "email", "url", "avatar")
   * @param value The record value
   * @param resolverAddress Optional resolver address
   * @returns Transaction hash
   */
  public async setENSTextRecord(
    ensName: string, 
    key: string, 
    value: string, 
    resolverAddress?: string
  ): Promise<string> {
    return this.setENSRecords({
      name: ensName,
      texts: [{ key, value }],
      resolverAddress
    })
  }

  /**
   * Set multiple text records for an ENS name
   * @param ensName The ENS name
   * @param textRecords Array of text records
   * @param resolverAddress Optional resolver address
   * @returns Transaction hash
   */
  public async setENSTextRecords(
    ensName: string,
    textRecords: ENSTextRecord[],
    resolverAddress?: string
  ): Promise<string> {
    return this.setENSRecords({
      name: ensName,
      texts: textRecords,
      resolverAddress
    })
  }

  /**
   * Set a coin address record for an ENS name
   * @param ensName The ENS name
   * @param coin The coin type (e.g., "ETH", "BTC")
   * @param address The wallet address for that coin
   * @param resolverAddress Optional resolver address
   * @returns Transaction hash
   */
  public async setENSCoinRecord(
    ensName: string,
    coin: string,
    address: string,
    resolverAddress?: string
  ): Promise<string> {
    return this.setENSRecords({
      name: ensName,
      coins: [{ coin, value: address }],
      resolverAddress
    })
  }

  /**
   * Get ENS records for a domain name
   * @param ensName The ENS name to query
   * @param textKeys Array of text record keys to fetch
   * @param coinTypes Array of coin types to fetch
   * @returns ENS records
   */
  public async getENSRecords(
    ensName: string,
    textKeys?: string[],
    coinTypes?: string[]
  ): Promise<any> {
    if (!this.viemPublicClient) {
      throw new Error('Public client not initialized')
    }

    try {
      const records = await getRecords(this.viemPublicClient, {
        name: ensName,
        texts: textKeys || [],
        coins: coinTypes || []
      })

      return records
    } catch (error) {
      console.error('Error getting ENS records:', error)
      throw error
    }
  }

  /**
   * Get a specific text record from an ENS name
   * @param ensName The ENS name
   * @param key The text record key
   * @returns The text record value or null if not found
   */
  public async getENSTextRecord(ensName: string, key: string): Promise<string | null> {
    try {
      const records = await this.getENSRecords(ensName, [key])
      return records.texts?.[0]?.value || null
    } catch (error) {
      console.error(`Error getting ENS text record ${key}:`, error)
      return null
    }
  }

  /**
   * Get multiple text records from an ENS name
   * @param ensName The ENS name
   * @param keys Array of text record keys
   * @returns Object with key-value pairs of text records
   */
  public async getENSTextRecords(ensName: string, keys: string[]): Promise<Record<string, string | null>> {
    try {
      const records = await this.getENSRecords(ensName, keys)
      const result: Record<string, string | null> = {}
      
      if (records.texts) {
        for (const textRecord of records.texts) {
          result[textRecord.key] = textRecord.value
        }
      }
      
      // Ensure all requested keys are in the result
      for (const key of keys) {
        if (!(key in result)) {
          result[key] = null
        }
      }
      
      return result
    } catch (error) {
      console.error('Error getting ENS text records:', error)
      throw error
    }
  }

  /**
   * Get a coin address record from an ENS name
   * @param ensName The ENS name
   * @param coin The coin type (e.g., "ETH", "BTC")
   * @returns The coin address or null if not found
   */
  public async getENSCoinRecord(ensName: string, coin: string): Promise<string | null> {
    try {
      const records = await this.getENSRecords(ensName, [], [coin])
      return records.coins?.[0]?.value || null
    } catch (error) {
      console.error(`Error getting ENS coin record ${coin}:`, error)
      return null
    }
  }

  // ENS Ownership Management Methods

  /**
   * Get the owner of an ENS name
   * @param ensName The ENS name to check ownership for
   * @returns The owner address or null if not found
   */
  public async getENSOwner(ensName: string): Promise<string | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    if (!ensName.endsWith('.eth')) {
      ensName = `${ensName}.eth`
    }

    try {
      const registryABI = [
        'function owner(bytes32 node) view returns (address)'
      ]

      const registry = new ethers.Contract(ENS_REGISTRY, registryABI, this.provider)
      
      // Calculate the namehash for the ENS name
      const namehash = ethers.namehash(ensName)
      console.log('namehash', namehash)
      const owner = await registry.owner(namehash)

      // Return null if owner is zero address (unregistered)
      return owner === ethers.ZeroAddress ? null : owner
    } catch (error) {
      console.error('Error getting ENS owner:', error)
      return null
    }
  }

  /**
   * Transfer ENS ownership to a new address
   * @param ensName The ENS name to transfer
   * @param newOwner The address to transfer ownership to
   * @returns Transaction response
   */
  public async transferENSOwnership(ensName: string, newOwner: string): Promise<ethers.TransactionResponse> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet and provider must be initialized for ENS ownership transfer')
    }

    if (!ensName.endsWith('.eth')) {
      ensName = `${ensName}.eth`
    }

    if (!ethers.isAddress(newOwner)) {
      throw new Error('Invalid new owner address')
    }

    try {
      // Check if we own the ENS name
      const currentOwner = await this.getENSOwner(ensName)
      if (!currentOwner) {
        throw new Error(`ENS name ${ensName} is not registered or not found in registry`)
      }

      if (currentOwner.toLowerCase() !== this.wallet.address.toLowerCase()) {
        throw new Error(`Only the current owner can transfer ENS ownership. Current owner: ${currentOwner}, Wallet: ${this.wallet.address}`)
      }

      const registryABI = [
        'function setOwner(bytes32 node, address owner)',
        'function owner(bytes32 node) view returns (address)'
      ]

      const registry = new ethers.Contract(ENS_REGISTRY, registryABI, this.wallet)
      
      // Calculate the namehash for the ENS name
      const namehash = ethers.namehash(ensName)
      
      // Transfer ownership
      const tx = await registry.setOwner(namehash, newOwner)
      
      console.log(`✅ ENS ownership transfer initiated for ${ensName} to ${newOwner}: ${tx.hash}`)
      return tx
    } catch (error) {
      console.error('Error transferring ENS ownership:', error)
      throw error
    }
  }

  /**
   * Register ENS and immediately transfer ownership to target address
   * @param ensName The ENS name to register
   * @param targetAddress The address to point the ENS to AND transfer ownership to
   * @param durationInYears How many years to register for
   * @returns Object with both transaction hashes
   */
  public async registerENSAndTransfer(
    ensName: string, 
    targetAddress: string, 
    durationInYears: number = 1,
    treeRoot: string
  ): Promise<{registrationTx: string, transferTx: string}> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet and provider must be initialized for ENS registration and transfer')
    }

    try {
      console.log(`🔄 Starting ENS registration and transfer for ${ensName}...`)
      
      // Step 1: Register ENS name (system wallet becomes owner, ENS points to target)
      const registrationTx = await this.registerENS(ensName, this.wallet.address, durationInYears)
      console.log(`✅ Registration transaction: ${registrationTx.hash}`)
      
      // Wait for registration to be confirmed
      console.log('⏳ Waiting for registration confirmation...')
      await registrationTx.wait()
      
      // Wait for ENS registry to propagate the ownership change
      console.log('⏳ Waiting for ENS registry to update...')
      let attempts = 0
      const maxAttempts = 30 // 30 attempts with 2 second delays = 1 minute max wait
      while (attempts < maxAttempts) {
        try {
          const currentOwner = await this.getENSOwner(ensName)
          if (currentOwner && currentOwner.toLowerCase() === this.wallet.address.toLowerCase()) {
            console.log(`✅ ENS ownership confirmed for ${ensName}`)
            break
          }
        } catch (error) {
          // Continue trying
        }
        
        attempts++
        if (attempts >= maxAttempts) {
          throw new Error(`ENS registration did not propagate after ${maxAttempts * 2} seconds`)
        }
        
        console.log(`⏳ Attempt ${attempts}/${maxAttempts} - waiting for ENS registry update...`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      }

      // Step 2: Set text record for the ENS name
      console.log(`🔄 Setting text record for ${ensName}...`)
      const textRecordTx = await this.setENSTextRecord(ensName, 'sema:group:root', treeRoot)
      console.log(`✅ Text record transaction: ${textRecordTx}`)
      
      // Step 3: Transfer ownership to target address
      console.log(`🔄 Transferring ownership to ${targetAddress}...`)
      const transferTx = await this.transferENSOwnership(ensName, targetAddress)
      console.log(`✅ Transfer transaction: ${transferTx.hash}`)
      
      return {
        registrationTx: registrationTx.hash,
        transferTx: transferTx.hash
      }
    } catch (error) {
      console.error('Error in registerENSAndTransfer:', error)
      throw error
    }
  }

  /**
   * Check if the current wallet owns a specific ENS name
   * @param ensName The ENS name to check
   * @returns True if current wallet owns the ENS name
   */
  public async isENSOwner(ensName: string, ownerAddress?: string): Promise<boolean> {
    if (!this.wallet) {
      return false
    }

    if (!ensName.endsWith('.eth')) {
      ensName = `${ensName}.eth`
    }

    try {
      const owner = await this.getENSOwner(ensName)
      return owner?.toLowerCase() === (ownerAddress || this.wallet.address).toLowerCase()
    } catch (error) {
      console.error('Error checking ENS ownership:', error)
      return false
    }
  }

  /**
   * Get ENS ownership information
   * @param ensName The ENS name to check
   * @returns Ownership information object
   */
  public async getENSOwnershipInfo(ensName: string): Promise<{
    ensName: string
    owner: string | null
    isOwnedByWallet: boolean
    resolvedAddress: string | null
  }> {
    try {
      const owner = await this.getENSOwner(ensName)
      const resolvedAddress = await this.resolveENS(ensName)
      const isOwnedByWallet = this.wallet ? 
        owner?.toLowerCase() === this.wallet.address.toLowerCase() : false

      return {
        ensName,
        owner,
        isOwnedByWallet,
        resolvedAddress
      }
    } catch (error) {
      console.error('Error getting ENS ownership info:', error)
      throw error
    }
  }
}
