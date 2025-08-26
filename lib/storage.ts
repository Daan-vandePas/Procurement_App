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
        // Initialize global counter to 4 since sample data has REQ-001 through REQ-004
        await kvInstance.set('global_request_counter', '4')
        console.log('🔢 Storage: Sample data created, global counter set to 4')
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
  const kv = await initKV()
  const globalCounterKey = 'global_request_counter'
  const maxRetries = 10
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔢 Storage: Generating global sequential request ID (attempt ${attempt + 1}/${maxRetries})...`)
      
      // Get current global counter value (shared across ALL users)
      let currentCounterStr = await kv.get(globalCounterKey)
      let currentCounter = currentCounterStr ? parseInt(currentCounterStr as string, 10) : 0
      
      // If counter is 0 or not set, initialize by scanning existing requests
      if (currentCounter === 0) {
        console.log('🔍 Storage: Initializing global counter by scanning existing requests...')
        const existingKeys = await kv.keys('request:*')
        
        if (existingKeys && existingKeys.length > 0) {
          console.log(`📊 Storage: Found ${existingKeys.length} existing requests, finding highest ID...`)
          
          const existingIds = existingKeys
            .map((key: string) => {
              const requestId = key.replace('request:', '')
              const match = requestId.match(/^REQ-(\d+)$/)
              return match ? parseInt(match[1], 10) : 0
            })
            .filter((id: number) => id > 0)
          
          if (existingIds.length > 0) {
            currentCounter = Math.max(...existingIds)
            console.log(`📈 Storage: Found highest existing sequential ID: REQ-${currentCounter.toString().padStart(3, '0')}`)
            // Set the global counter to the highest found value
            await kv.set(globalCounterKey, currentCounter.toString())
          }
        }
        
        console.log(`🎯 Storage: Global counter initialized to: ${currentCounter}`)
      }
      
      // Generate next sequential ID
      const nextCounter = currentCounter + 1
      const candidateId = `REQ-${nextCounter.toString().padStart(3, '0')}`
      const candidateKey = `request:${candidateId}`
      
      console.log(`🎯 Storage: Candidate sequential ID: ${candidateId} (global counter: ${currentCounter} → ${nextCounter})`)
      
      // Double-check that this ID doesn't exist (safety net for race conditions)
      const existingRequest = await kv.get(candidateKey)
      if (existingRequest) {
        console.warn(`⚠️ Storage: ID ${candidateId} already exists! Finding next available ID...`)
        
        // Find the next truly available ID by scanning forward
        let skipCounter = nextCounter
        let foundAvailable = false
        
        for (let skip = 0; skip < 100; skip++) {
          skipCounter++
          const skipId = `REQ-${skipCounter.toString().padStart(3, '0')}`
          const skipKey = `request:${skipId}`
          const skipCheck = await kv.get(skipKey)
          
          if (!skipCheck) {
            console.log(`🔄 Storage: Found available ID: ${skipId} (skipped ${skip + 1} taken IDs)`)
            // Update the global counter to this available number
            await kv.set(globalCounterKey, skipCounter.toString())
            foundAvailable = true
            return skipId
          }
        }
        
        if (!foundAvailable) {
          console.error(`❌ Storage: Could not find available sequential ID after checking 100 candidates`)
          continue // This will trigger the retry logic
        }
      }
      
      // Atomically update the global counter for ALL users
      await kv.set(globalCounterKey, nextCounter.toString())
      
      console.log(`✅ Storage: Generated global sequential ID: ${candidateId}`)
      return candidateId
      
    } catch (error) {
      console.error(`❌ Storage: Error in global sequential ID generation attempt ${attempt + 1}:`, error)
      
      if (attempt === maxRetries - 1) {
        // Emergency fallback with timestamp to ensure uniqueness
        const emergency = `REQ-${Date.now()}`
        console.log(`🚨 Storage: Using emergency timestamp ID: ${emergency}`)
        return emergency
      }
      
      // Wait briefly before retrying to avoid tight loops in race conditions
      await new Promise(resolve => setTimeout(resolve, 50 + attempt * 50))
    }
  }
  
  throw new Error('Failed to generate unique sequential request ID after maximum retries')
}