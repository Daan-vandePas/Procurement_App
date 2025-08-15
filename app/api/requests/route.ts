import { NextRequest, NextResponse } from 'next/server'
import { Request } from '@/lib/types'
import { saveRequest, getAllRequests } from '@/lib/storage'
import { getUserFromRequest } from '@/lib/auth'

// POST /api/requests - Create new request
export async function POST(request: NextRequest) {
  try {
    const requestData: Request = await request.json()
    
    // Validate required fields
    if (!requestData.id || !requestData.requesterName || !requestData.items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: id, requesterName, or items' },
        { status: 400 }
      )
    }
    
    // Save request to storage
    const savedRequest = await saveRequest(requestData)
    
    return NextResponse.json(savedRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating request:', error)
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}

// GET /api/requests - Get requests filtered by user role
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const user = getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get all requests first
    const allRequests = await getAllRequests()
    
    // Filter requests based on user role
    let filteredRequests = allRequests
    
    switch (user.role) {
      case 'requester':
        // Requesters see only their own requests (all statuses including drafts)
        filteredRequests = allRequests.filter(req => req.requesterName === user.email)
        break
        
      case 'purchaser':
      case 'ceo':
        // Purchasers and CEOs see all requests except drafts
        filteredRequests = allRequests.filter(req => req.status !== 'draft')
        break
        
      default:
        // Fallback: show only user's own requests
        filteredRequests = allRequests.filter(req => req.requesterName === user.email)
    }
    
    return NextResponse.json(filteredRequests)
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}