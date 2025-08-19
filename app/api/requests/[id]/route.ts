import { NextRequest, NextResponse } from 'next/server'
import { getRequest, updateRequest, deleteRequest } from '@/lib/storage'

// GET /api/requests/[id] - Get specific request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('📥 API: Fetching request by ID:', params.id)
    const requestData = await getRequest(params.id)
    
    if (!requestData) {
      console.log('❌ API: Request not found:', params.id)
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }
    
    console.log('✅ API: Request found, items status:', requestData.items.map((item: any) => ({
      id: item.id,
      itemName: item.itemName,
      itemStatus: item.itemStatus || 'pending'
    })))
    
    return NextResponse.json(requestData)
  } catch (error) {
    console.error('❌ API: Error fetching request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    )
  }
}

// PUT /api/requests/[id] - Update request
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json()
    
    const updatedRequest = await updateRequest(params.id, updates)
    
    if (!updatedRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Error updating request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

// DELETE /api/requests/[id] - Delete request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteRequest(params.id)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ message: 'Request deleted successfully' })
  } catch (error) {
    console.error('Error deleting request:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}