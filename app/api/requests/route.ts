import { NextRequest, NextResponse } from 'next/server'
import { Request } from '@/lib/types'
import { saveRequest, getAllRequests } from '@/lib/storage'
import { getUserFromRequest } from '@/lib/auth'

// POST /api/requests - Create new request
export async function POST(request: NextRequest) {
  try {
    console.log('📥 API: Received POST request to create new request')
    const requestData: Request = await request.json()
    
    console.log('📊 API: Parsed request data:', {
      id: requestData.id,
      requesterName: requestData.requesterName,
      status: requestData.status,
      itemCount: requestData.items?.length
    })
    
    // Validate required fields
    if (!requestData.id || !requestData.requesterName || !requestData.items?.length) {
      console.error('❌ API: Validation failed - missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: id, requesterName, or items' },
        { status: 400 }
      )
    }
    
    console.log('💾 API: Saving request to storage...')
    // Save request to storage with overwrite protection for new requests
    const savedRequest = await saveRequest(requestData, false) // Don't allow overwrites for new requests
    console.log('✅ API: Request saved successfully:', savedRequest.id)
    
    return NextResponse.json(savedRequest, { status: 201 })
  } catch (error) {
    console.error('❌ API: Error creating request:', error)
    
    // Provide specific error messages for different failure types
    let errorMessage = 'Failed to create request'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        // This should be extremely rare with UUID system - likely a storage timing issue
        errorMessage = 'Request ID conflict detected. Please try submitting again.'
        statusCode = 409 // Conflict
      } else if (error.message.includes('Failed to generate unique sequential request ID')) {
        // Sequential ID generation system failed completely
        errorMessage = 'Unable to generate sequential request ID. Please try again in a moment.'
        statusCode = 503 // Service Unavailable
      } else if (error.message.includes('validation')) {
        errorMessage = 'Invalid request data. Please check all required fields.'
        statusCode = 400 // Bad Request
      } else {
        errorMessage = 'Unable to process request. Please try again.'
        statusCode = 500
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        retryable: statusCode !== 400 // Client can retry unless it's a validation error
      },
      { status: statusCode }
    )
  }
}

// GET /api/requests - Get requests filtered by user role
export async function GET(request: NextRequest) {
  try {
    console.log('📤 API: Received GET request to fetch requests')
    
    // Get user from session
    const user = getUserFromRequest(request)
    
    if (!user) {
      console.error('❌ API: No authenticated user found')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('👤 API: Authenticated user:', user.email, 'Role:', user.role)

    // Get all requests first
    const allRequests = await getAllRequests()
    console.log('📚 API: Retrieved', allRequests.length, 'total requests from storage')
    
    if (allRequests.length > 0) {
      console.log('📋 API: All requests requesterNames:', allRequests.map(r => r.requesterName))
    }
    
    // Filter requests based on user role
    let filteredRequests = allRequests
    
    switch (user.role) {
      case 'requester':
        // Requesters see only their own requests (all statuses including drafts)
        console.log('🔍 API: Filtering for requester - looking for requesterName:', user.email)
        filteredRequests = allRequests.filter(req => req.requesterName === user.email)
        console.log('✅ API: Found', filteredRequests.length, 'requests for requester')
        break
        
      case 'purchaser':
      case 'ceo':
        // Purchasers and CEOs see all requests except drafts
        console.log('🔍 API: Filtering for', user.role, '- excluding draft status')
        filteredRequests = allRequests.filter(req => req.status !== 'draft')
        console.log('✅ API: Found', filteredRequests.length, 'non-draft requests')
        break
        
      default:
        // Fallback: show only user's own requests
        console.log('🔍 API: Using fallback filter for unknown role')
        filteredRequests = allRequests.filter(req => req.requesterName === user.email)
    }
    
    console.log('📤 API: Returning', filteredRequests.length, 'filtered requests')
    return NextResponse.json(filteredRequests)
  } catch (error) {
    console.error('❌ API: Error fetching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}