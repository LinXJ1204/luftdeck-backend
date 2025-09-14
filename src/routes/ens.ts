import { Router } from 'express'
import { WalletService } from '../wallet-service'

const router = Router()

// Initialize a read-only wallet service for ENS operations
let ensService: WalletService | null = null

// Initialize ENS service (read-only, no private key needed)
const initializeENSService = () => {
  if (!ensService) {
    try {
      const RPC_URL = process.env.RPC_URL
      ensService = new WalletService(undefined, RPC_URL)
      console.log('✅ ENS Service initialized (read-only mode)')
    } catch (error) {
      console.error('❌ Failed to initialize ENS Service:', error)
    }
  }
  return ensService
}

/**
 * GET /ens/available/:ensName
 * Check if an ENS name is available for registration
 */
router.get('/available/:ensName', async (req, res) => {
  try {
    const { ensName } = req.params
    
    // Validate ENS name format
    if (!ensName || !ensName.endsWith('.eth')) {
      return res.status(400).json({ 
        error: 'Invalid ENS name format. Must end with .eth',
        example: 'myname.eth'
      })
    }

    const service = initializeENSService()
    if (!service) {
      return res.status(503).json({
        error: 'ENS service unavailable',
        message: 'Unable to connect to blockchain network'
      })
    }

    const isAvailable = await service.isENSAvailable(ensName)
    
    res.json({
      ensName,
      available: isAvailable,
      checked_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('ENS availability check error:', error)
    res.status(500).json({ 
      error: 'Failed to check ENS availability',
      message: (error as Error).message 
    })
  }
})

/**
 * GET /ens/price/:ensName?years=1
 * Get the registration price for an ENS name
 */
router.get('/price/:ensName', async (req, res) => {
  try {
    const { ensName } = req.params
    const { years = '1' } = req.query
    
    // Validate ENS name format
    if (!ensName || !ensName.endsWith('.eth')) {
      return res.status(400).json({ 
        error: 'Invalid ENS name format. Must end with .eth',
        example: 'myname.eth'
      })
    }

    // Validate years parameter
    const durationInYears = parseInt(years as string, 10)
    if (isNaN(durationInYears) || durationInYears < 1 || durationInYears > 10) {
      return res.status(400).json({ 
        error: 'Invalid duration. Must be between 1 and 10 years',
        provided: years
      })
    }

    const service = initializeENSService()
    if (!service) {
      return res.status(503).json({
        error: 'ENS service unavailable',
        message: 'Unable to connect to blockchain network'
      })
    }

    const priceInEth = await service.getENSRegistrationPrice(ensName, durationInYears)
    
    res.json({
      ensName,
      duration_years: durationInYears,
      price_eth: priceInEth,
      checked_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('ENS price check error:', error)
    res.status(500).json({ 
      error: 'Failed to get ENS registration price',
      message: (error as Error).message 
    })
  }
})

/**
 * GET /ens/resolve/:ensName
 * Resolve an ENS name to its corresponding Ethereum address
 */
router.get('/resolve/:ensName', async (req, res) => {
  try {
    const { ensName } = req.params
    
    // Validate ENS name format (allow any .eth name for resolution)
    if (!ensName || !ensName.includes('.')) {
      return res.status(400).json({ 
        error: 'Invalid ENS name format',
        example: 'vitalik.eth'
      })
    }

    const service = initializeENSService()
    if (!service) {
      return res.status(503).json({
        error: 'ENS service unavailable',
        message: 'Unable to connect to blockchain network'
      })
    }

    const resolvedAddress = await service.resolveENS(ensName)
    
    if (resolvedAddress) {
      res.json({
        ensName,
        address: resolvedAddress,
        resolved_at: new Date().toISOString()
      })
    } else {
      res.status(404).json({
        ensName,
        error: 'ENS name not found or not configured',
        resolved_at: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('ENS resolution error:', error)
    res.status(500).json({ 
      error: 'Failed to resolve ENS name',
      message: (error as Error).message 
    })
  }
})

/**
 * GET /ens/reverse/:address
 * Reverse resolve an Ethereum address to its ENS name
 */
router.get('/reverse/:address', async (req, res) => {
  try {
    const { address } = req.params
    
    // Basic address validation
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({ 
        error: 'Invalid Ethereum address format',
        example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      })
    }

    const service = initializeENSService()
    if (!service) {
      return res.status(503).json({
        error: 'ENS service unavailable',
        message: 'Unable to connect to blockchain network'
      })
    }

    const ensName = await service.reverseResolveENS(address)
    
    if (ensName) {
      res.json({
        address,
        ensName,
        resolved_at: new Date().toISOString()
      })
    } else {
      res.status(404).json({
        address,
        error: 'No ENS name found for this address',
        resolved_at: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('ENS reverse resolution error:', error)
    res.status(500).json({ 
      error: 'Failed to reverse resolve address',
      message: (error as Error).message 
    })
  }
})

export default router
