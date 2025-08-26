import { NextRequest, NextResponse } from 'next/server'
import { getNextRequestId } from '@/lib/storage'

// GET /api/requests/next-id - Get the next sequential request ID
export async function GET(request: NextRequest) {
  const maxApiRetries = 3
  
  for (let attempt = 0; attempt < maxApiRetries; attempt++) {
    try {
      console.log(`🔢 API: Generating next request ID (attempt ${attempt + 1}/${maxApiRetries})...`)
      const nextId = await getNextRequestId()
      console.log('✅ API: Generated request ID:', nextId)
      
      return NextResponse.json({ id: nextId })
    } catch (error) {
      console.error(`❌ API: Error generating next request ID (attempt ${attempt + 1}):`, error)
      
      // If this was the last attempt, return error
      if (attempt === maxApiRetries - 1) {
        return NextResponse.json(
          { 
            error: error instanceof Error ? error.message : 'Failed to generate request ID',
            details: 'Maximum retry attempts exceeded'
          },
          { status: 500 }
        )
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 200))
    }
  }
}