import { NextRequest, NextResponse } from 'next/server'
import { getNextRequestId } from '@/lib/storage'

// GET /api/requests/next-id - Get the next sequential request ID
export async function GET(request: NextRequest) {
  try {
    console.log('🔢 API: Generating next request ID...')
    const nextId = await getNextRequestId()
    console.log('✅ API: Generated request ID:', nextId)
    
    return NextResponse.json({ id: nextId })
  } catch (error) {
    console.error('❌ API: Error generating next request ID:', error)
    return NextResponse.json(
      { error: 'Failed to generate request ID' },
      { status: 500 }
    )
  }
}