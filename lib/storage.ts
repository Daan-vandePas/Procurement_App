import { Request } from './types'

// Storage utility that works both locally and on Vercel
let kvInstance: any = null
let sampleDataInitialized = false

// Initialize KV connection (works in Vercel, falls back to memory locally)
const initKV = async () => {
  if (kvInstance) return kvInstance
  
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      kvInstance = kv
    } else {
      // Fallback to in-memory storage for local development
      kvInstance = createMemoryStorage()
    }
  } catch (error) {
    // KV not available, using memory storage
    kvInstance = createMemoryStorage()
  }
  
  // DEV ONLY: Auto-create sample data for development
  if (process.env.NODE_ENV === 'development' && !sampleDataInitialized) {
    sampleDataInitialized = true
    
    try {
      const existingRequests = await getAllRequestsInternal()
      if (existingRequests.length === 0) {
        const { createSampleRequests } = await import('./sampleData')
        await createSampleRequests()
        // Initialize request counter to 4 since sample data has REQ-001 through REQ-004
        await kvInstance.set('request_counter', '4')
      }
    } catch (error) {
      // Failed to create sample data - continue without it
    }
  }
  
  return kvInstance
}

// In-memory storage fallback for local development
let memoryStore: { [key: string]: any } = {}
const createMemoryStorage = () => ({
  async set(key: string, value: any) {
    memoryStore[key] = value
    return 'OK'
  },
  async get(key: string) {
    return memoryStore[key] || null
  },
  async del(key: string) {
    delete memoryStore[key]
    return 1
  },
  async keys(pattern?: string) {
    const allKeys = Object.keys(memoryStore)
    if (!pattern) return allKeys
    
    // Simple pattern matching for keys like "request:*"
    const regex = new RegExp(pattern.replace('*', '.*'))
    return allKeys.filter(key => regex.test(key))
  }
})

export const saveRequest = async (request: Request, allowOverwrite = true): Promise<Request> => {
  console.log('💾 Storage: Saving request:', request.id, 'for requester:', request.requesterName)
  const kv = await initKV()
  const key = `request:${request.id}`
  
  // Check for existing request if overwrite protection is enabled
  if (!allowOverwrite) {
    const existingRequest = await kv.get(key)
    if (existingRequest) {
      console.error(`❌ Storage: Request ${request.id} already exists and overwrites are not allowed`)
      throw new Error(`Request ${request.id} already exists. Cannot overwrite existing request.`)
    }
  }
  
  const result = await kv.set(key, JSON.stringify(request))
  console.log('✅ Storage: Request saved with result:', result)
  return request
}

export const getRequest = async (id: string): Promise<Request | null> => {
  const kv = await initKV()
  const key = `request:${id}`
  const data = await kv.get(key)
  
  if (!data) return null
  
  try {
    return typeof data === 'string' ? JSON.parse(data) : data
  } catch (error) {
    console.error('Error parsing request data:', error)
    return null
  }
}

// Internal function to get requests without triggering initKV initialization
const getAllRequestsInternal = async (): Promise<Request[]> => {
  if (!kvInstance) return []
  
  const keys = await kvInstance.keys('request:*')
  
  if (!keys || keys.length === 0) return []
  
  const requests: Request[] = []
  
  for (const key of keys) {
    try {
      const data = await kvInstance.get(key)
      if (data) {
        const request = typeof data === 'string' ? JSON.parse(data) : data
        requests.push(request)
      }
    } catch (error) {
      console.error(`Error retrieving request ${key}:`, error)
    }
  }
  
  // Sort by request date (newest first)
  return requests.sort((a, b) => 
    new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
  )
}

export const getAllRequests = async (): Promise<Request[]> => {
  console.log('📚 Storage: Getting all requests...')
  const kv = await initKV()
  const keys = await kv.keys('request:*')
  
  console.log('🔑 Storage: Found', keys?.length || 0, 'request keys:', keys)
  
  if (!keys || keys.length === 0) {
    console.log('📭 Storage: No requests found')
    return []
  }
  
  const requests: Request[] = []
  
  for (const key of keys) {
    try {
      const data = await kv.get(key)
      if (data) {
        const request = typeof data === 'string' ? JSON.parse(data) : data
        console.log('📄 Storage: Retrieved request:', request.id, 'requesterName:', request.requesterName)
        requests.push(request)
      }
    } catch (error) {
      console.error(`❌ Storage: Error retrieving request ${key}:`, error)
    }
  }
  
  console.log('📊 Storage: Total requests retrieved:', requests.length)
  
  // Sort by request date (newest first)
  return requests.sort((a, b) => 
    new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
  )
}

export const updateRequest = async (id: string, updates: Partial<Request>): Promise<Request | null> => {
  const existingRequest = await getRequest(id)
  if (!existingRequest) return null
  
  const updatedRequest = { ...existingRequest, ...updates }
  await saveRequest(updatedRequest)
  return updatedRequest
}

export const deleteRequest = async (id: string): Promise<boolean> => {
  const kv = await initKV()
  const key = `request:${id}`
  const result = await kv.del(key)
  return result > 0
}

export const getNextRequestId = async (): Promise<string> => {
  try {
    console.log('🆔 Storage: Generating UUID-based request ID...')
    
    // Generate UUID-based ID for guaranteed uniqueness
    const uuid = crypto.randomUUID()
    const suffix = uuid.replace(/-/g, '').slice(0, 8).toUpperCase()
    const candidateId = `REQ-${suffix}`
    
    console.log(`🎯 Storage: Generated candidate ID: ${candidateId}`)
    
    // Safety check: verify ID doesn't exist (extremely unlikely with UUID)
    const kv = await initKV()
    const candidateKey = `request:${candidateId}`
    const existingRequest = await kv.get(candidateKey)
    
    if (existingRequest) {
      // Astronomically unlikely (1 in ~4 billion chance)
      console.warn(`⚠️ Storage: UUID collision detected for ${candidateId} - generating new one`)
      
      // Generate fallback with timestamp
      const timestamp = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).slice(2, 5).toUpperCase()
      const fallbackId = `REQ-${timestamp}${random}`
      
      console.log(`🔄 Storage: Using fallback ID: ${fallbackId}`)
      return fallbackId
    }
    
    console.log(`✅ Storage: Generated unique UUID-based ID: ${candidateId}`)
    return candidateId
    
  } catch (error) {
    console.error('❌ Storage: Error in UUID generation:', error)
    
    // Emergency fallback: timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    const emergencyId = `REQ-${timestamp}${random}`
    
    console.log(`🚨 Storage: Using emergency ID: ${emergencyId}`)
    return emergencyId
  }
}