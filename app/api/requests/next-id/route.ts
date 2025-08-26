import { NextRequest, NextResponse } from 'next/server'
import { getNextRequestId } from '@/lib/storage'

// GET /api/requests/next-id - Get unique sequential request ID
export async function GET(request: NextRequest) {
  try {
    console.log('🔢 API: Generating sequential request ID...')
    const nextId = await getNextRequestId()
    console.log('✅ API: Generated request ID:', nextId)
    
    return NextResponse.json({ id: nextId })
  } catch (error) {
    console.error('❌ API: Error generating request ID:', error)
    
    // UUID generation should never fail, but provide graceful fallback
    return NextResponse.json(
      { 
        error: 'Failed to generate request ID. Please refresh and try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}