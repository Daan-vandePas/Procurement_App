import { Request } from './types'

// Storage utility that works both locally and on Vercel
let kvInstance: any = null

// Initialize KV connection (works in Vercel, falls back to memory locally)
const initKV = async () => {
  if (kvInstance) return kvInstance
  
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      kvInstance = kv
    } else {
      // Fallback to in-memory storage for local development
      console.log('Using in-memory storage (local development)')
      kvInstance = createMemoryStorage()
    }
  } catch (error) {
    console.log('KV not available, using memory storage')
    kvInstance = createMemoryStorage()
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

export const saveRequest = async (request: Request): Promise<Request> => {
  const kv = await initKV()
  const key = `request:${request.id}`
  await kv.set(key, JSON.stringify(request))
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

export const getAllRequests = async (): Promise<Request[]> => {
  const kv = await initKV()
  const keys = await kv.keys('request:*')
  
  if (!keys || keys.length === 0) return []
  
  const requests: Request[] = []
  
  for (const key of keys) {
    try {
      const data = await kv.get(key)
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