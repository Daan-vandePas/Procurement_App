import { NextRequest, NextResponse } from 'next/server'
import { Request } from '@/lib/types'
import { saveRequest, getAllRequests } from '@/lib/storage'

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

// GET /api/requests - Get all requests
export async function GET() {
  try {
    const requests = await getAllRequests()
    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}