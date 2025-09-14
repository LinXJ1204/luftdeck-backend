import { ethers } from 'ethers'

// ENS Registrar Controller contract address (Ethereum Sepolia Testnet)
const ENS_REGISTRAR_CONTROLLER = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968'

/**
 * Secure Wallet Service for blockchain interactions
 * This service encapsulates wallet functionality and should not be exposed via API
 */
export class WalletService {
  private wallet: ethers.Wallet | null = null
  private provider: ethers.JsonRpcProvider | null = null
  private readonly rpcUrl: string

  constructor(privateKey?: string, rpcUrl?: string) {
    this.rpcUrl = rpcUrl || 'https://eth-mainnet.g.alchemy.com/v2/demo'
    
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl)
      
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider)
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

    // Validate ENS name format
    if (!ensName.endsWith('.eth')) {
      throw new Error('ENS name must end with .eth')
    }

    const name = ensName.replace('.eth', '')
    
    // Check if name is available
    const isAvailable = await this.isENSAvailable(ensName)
    if (!isAvailable) {
      throw new Error(`ENS name ${ensName} is not available`)
    }
    
    // ENS Registrar Controller ABI (simplified for registration)
    const registrarABI = [
      'function rentPrice(string name, uint duration) view returns (uint)',
      'function available(string name) view returns (bool)',
      'function makeCommitment(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint32 fuses, uint64 wrapperExpiry) pure returns (bytes32)',
      'function commit(bytes32 commitment)',
      'function register(string name, address owner, uint duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint32 fuses, uint64 wrapperExpiry) payable',
      'function minCommitmentAge() view returns (uint)',
      'function maxCommitmentAge() view returns (uint)'
    ]

    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.wallet)

    // Calculate registration duration in seconds
    const duration = durationInYears * 365 * 24 * 60 * 60

    // Get registration price
    const price = await registrarContract.rentPrice(name, duration)
    
    // Generate a random secret for the commitment
    const secret = ethers.randomBytes(32)
    
    // Public resolver address (Ethereum Sepolia Testnet)
    const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5'
    
    // Make commitment
    const commitment = await registrarContract.makeCommitment(
      name,
      targetAddress,
      duration,
      secret,
      PUBLIC_RESOLVER,
      [], // No additional data
      false, // Don't set reverse record
      0, // No fuses
      0 // No wrapper expiry
    )

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
    const registerTx = await registrarContract.register(
      name,
      targetAddress,
      duration,
      secret,
      PUBLIC_RESOLVER,
      [], // No additional data
      false, // Don't set reverse record
      0, // No fuses
      0, // No wrapper expiry
      { value: price }
    )

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

    if (!ensName.endsWith('.eth')) {
      throw new Error('ENS name must end with .eth')
    }

    const name = ensName.replace('.eth', '')
    
    const registrarABI = ['function available(string name) view returns (bool)']
    
    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.provider)
    
    try {
      return await registrarContract.available(name)
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

    if (!ensName.endsWith('.eth')) {
      throw new Error('ENS name must end with .eth')
    }

    const name = ensName.replace('.eth', '')
    const duration = durationInYears * 365 * 24 * 60 * 60

    const registrarABI = ['function rentPrice(string name, uint duration) view returns (uint)']
    
    const registrarContract = new ethers.Contract(ENS_REGISTRAR_CONTROLLER, registrarABI, this.provider)
    
    try {
      const price = await registrarContract.rentPrice(name, duration)
      return ethers.formatEther(price)
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
}
