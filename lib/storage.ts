import { Request } from './types'

// Storage utility that works both locally and on Vercel
let kvInstance: any = null
let sampleDataInitialized = false

// Initialize KV connection (works in Vercel, falls back to memory locally)
const initKV = async () => {
  if (kvInstance) return kvInstance
  
  console.log('🔧 Storage: Initializing KV connection...')
  console.log('🌍 Storage: Environment:', process.env.NODE_ENV || 'unknown')
  
  // Debug environment variables (without exposing sensitive data)
  const hasKvUrl = !!process.env.KV_REST_API_URL
  const hasKvToken = !!process.env.KV_REST_API_TOKEN
  const kvUrlLength = process.env.KV_REST_API_URL?.length || 0
  const kvTokenLength = process.env.KV_REST_API_TOKEN?.length || 0
  
  console.log(`🔑 Storage: KV_REST_API_URL present: ${hasKvUrl} (length: ${kvUrlLength})`)
  console.log(`🔑 Storage: KV_REST_API_TOKEN present: ${hasKvToken} (length: ${kvTokenLength})`)
  
  if (hasKvUrl && hasKvToken && 
      !process.env.KV_REST_API_URL?.includes('your-current-kv-url') &&
      !process.env.KV_REST_API_TOKEN?.includes('your-current-kv-token')) {
    
    try {
      console.log('☁️ Storage: Attempting to connect to Vercel KV...')
      const { kv } = await import('@vercel/kv')
      kvInstance = kv
      console.log('✅ Storage: Successfully connected to Vercel KV')
      
      // Test the connection
      try {
        await kv.set('storage_test_key', 'test_value', { ex: 10 })
        await kv.get('storage_test_key')
        await kv.del('storage_test_key')
        console.log('✅ Storage: KV connection test successful')
      } catch (testError) {
        console.error('❌ Storage: KV connection test failed:', testError)
        throw testError
      }
      
    } catch (error) {
      console.error('❌ Storage: Failed to connect to Vercel KV:', error)
      console.log('🔄 Storage: Falling back to file-based storage...')
      kvInstance = await createFileStorage()
    }
  } else {
    if (!hasKvUrl || !hasKvToken) {
      console.log('⚠️ Storage: Missing KV credentials')
    } else {
      console.log('⚠️ Storage: Placeholder KV credentials detected')
    }
    console.log('🔄 Storage: Using file-based storage for persistence...')
    kvInstance = await createFileStorage()
  }
  
  // DEV ONLY: Auto-create sample data for development
  if (process.env.NODE_ENV === 'development' && !sampleDataInitialized) {
    sampleDataInitialized = true
    
    try {
      const existingRequests = await getAllRequestsInternal()
      if (existingRequests.length === 0) {
        const { createSampleRequests } = await import('./sampleData')
        await createSampleRequests()
        console.log('📝 Storage: Sample data created')
      }
    } catch (error) {
      // Failed to create sample data - continue without it
    }
  }
  
  return kvInstance
}

// File-based storage for persistent data across server restarts
const createFileStorage = async () => {
  const fs = await import('fs/promises')
  const path = await import('path')
  
  // Create storage directory if it doesn't exist
  const storageDir = path.join(process.cwd(), '.storage')
  try {
    await fs.access(storageDir)
  } catch {
    await fs.mkdir(storageDir, { recursive: true })
    console.log('📁 Storage: Created .storage directory')
  }
  
  const getFilePath = (key: string) => path.join(storageDir, `${key.replace(/[^a-zA-Z0-9-_:]/g, '_')}.json`)
  
  return {
    async set(key: string, value: any) {
      try {
        const filePath = getFilePath(key)
        await fs.writeFile(filePath, JSON.stringify({ key, value, timestamp: Date.now() }), 'utf8')
        console.log(`💾 FileStorage: Saved key "${key}" to file`)
        return 'OK'
      } catch (error) {
        console.error(`❌ FileStorage: Failed to save key "${key}":`, error)
        throw error
      }
    },
    
    async get(key: string) {
      try {
        const filePath = getFilePath(key)
        const content = await fs.readFile(filePath, 'utf8')
        const data = JSON.parse(content)
        console.log(`📂 FileStorage: Retrieved key "${key}" from file`)
        return data.value
      } catch (error) {
        // File not found is normal, don't log as error
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return null
        }
        console.error(`❌ FileStorage: Failed to retrieve key "${key}":`, error)
        return null
      }
    },
    
    async del(key: string) {
      try {
        const filePath = getFilePath(key)
        await fs.unlink(filePath)
        console.log(`🗑️ FileStorage: Deleted key "${key}"`)
        return 1
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return 0 // File didn't exist
        }
        console.error(`❌ FileStorage: Failed to delete key "${key}":`, error)
        return 0
      }
    },
    
    async keys(pattern?: string) {
      try {
        const files = await fs.readdir(storageDir)
        let keys = files
          .filter(file => file.endsWith('.json'))
          .map(file => file.replace('.json', '').replace(/_/g, ':'))
        
        if (pattern) {
          const regex = new RegExp(pattern.replace('*', '.*'))
          keys = keys.filter(key => regex.test(key))
        }
        
        console.log(`🔍 FileStorage: Found ${keys.length} keys matching pattern "${pattern || '*'}"`)
        return keys
      } catch (error) {
        console.error('❌ FileStorage: Failed to list keys:', error)
        return []
      }
    }
  }
}

// In-memory storage fallback (only used if file storage fails)
let memoryStore: { [key: string]: any } = {}
const createMemoryStorage = () => {
  console.log('⚠️ Storage: Using in-memory storage - data will be lost on restart!')
  return {
    async set(key: string, value: any) {
      memoryStore[key] = value
      console.log(`💭 MemoryStorage: Stored key "${key}" in memory`)
      return 'OK'
    },
    async get(key: string) {
      const value = memoryStore[key] || null
      if (value) console.log(`💭 MemoryStorage: Retrieved key "${key}" from memory`)
      return value
    },
    async del(key: string) {
      delete memoryStore[key]
      console.log(`💭 MemoryStorage: Deleted key "${key}" from memory`)
      return 1
    },
    async keys(pattern?: string) {
      const allKeys = Object.keys(memoryStore)
      if (!pattern) return allKeys
      
      // Simple pattern matching for keys like "request:*"
      const regex = new RegExp(pattern.replace('*', '.*'))
      return allKeys.filter(key => regex.test(key))
    }
  }
}

export const saveRequest = async (request: Request): Promise<Request> => {
  console.log('💾 Storage: Saving request:', request.id, 'for requester:', request.requesterName)
  const kv = await initKV()
  const key = `request:${request.id}`
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

