import { NextRequest, NextResponse } from 'next/server'
import { getNextRequestId } from '@/lib/storage'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/requests/next-id - Get the next sequential request ID
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only requesters can create new requests, so only they need new IDs
    if (user.role !== 'requester') {
      return NextResponse.json(
        { error: 'Only requesters can generate new request IDs' },
        { status: 403 }
      )
    }

    const nextId = await getNextRequestId()
    
    return NextResponse.json({ id: nextId })
  } catch (error) {
    console.error('Error generating next request ID:', error)
    return NextResponse.json(
      { error: 'Failed to generate request ID' },
      { status: 500 }
    )
  }
}