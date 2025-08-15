import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getRequest, updateRequest } from '@/lib/storage'
import { ProcessingUpdate, ItemProcessingData } from '@/lib/types'

interface RouteParams {
  params: {
    id: string
  }
}

// PUT: Update individual item processing
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and permissions
    const user = getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only purchasers can process requests
    if (user.role !== 'purchaser') {
      return NextResponse.json(
        { error: 'Only purchasers can process requests' },
        { status: 403 }
      )
    }

    const requestId = params.id
    const processingUpdate: ProcessingUpdate = await request.json()

    // Get existing request
    const existingRequest = await getRequest(requestId)
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Security check: Only 'requested' status can be processed
    if (existingRequest.status !== 'requested') {
      return NextResponse.json(
        { error: 'Request is not in processable status' },
        { status: 400 }
      )
    }

    // Find the item to update
    const itemIndex = existingRequest.items.findIndex(item => item.id === processingUpdate.itemId)
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found in request' },
        { status: 404 }
      )
    }

    // Validate processing data
    const validationError = validateProcessingData(processingUpdate.data)
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    // Create updated request (preserving all original data)
    const updatedRequest = {
      ...existingRequest,
      items: existingRequest.items.map((item, index) => {
        if (index === itemIndex) {
          return {
            ...item, // Preserve all original item data
            // Only update purchaser-related fields
            actualCost: processingUpdate.data.actualCost,
            costProof: processingUpdate.data.costProof,
            costProofType: processingUpdate.data.costProofType,
            rejectionReason: processingUpdate.data.rejectionReason,
            itemStatus: processingUpdate.data.itemStatus
          }
        }
        return item
      })
    }

    // Save updated request
    const savedRequest = await updateRequest(requestId, updatedRequest)
    
    return NextResponse.json(savedRequest)

  } catch (error) {
    console.error('Error processing item:', error)
    return NextResponse.json(
      { error: 'Failed to process item' },
      { status: 500 }
    )
  }
}

// POST: Submit entire request for approval
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and permissions
    const user = getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only purchasers can submit for approval
    if (user.role !== 'purchaser') {
      return NextResponse.json(
        { error: 'Only purchasers can submit requests for approval' },
        { status: 403 }
      )
    }

    const requestId = params.id

    // Get existing request
    const existingRequest = await getRequest(requestId)
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Security check: Only 'requested' status can be submitted
    if (existingRequest.status !== 'requested') {
      return NextResponse.json(
        { error: 'Request is not in processable status' },
        { status: 400 }
      )
    }

    // Validate all items are processed
    const unprocessedItems = existingRequest.items.filter(item => 
      !item.itemStatus || item.itemStatus === 'pending'
    )

    if (unprocessedItems.length > 0) {
      return NextResponse.json(
        { error: `${unprocessedItems.length} items still need to be processed` },
        { status: 400 }
      )
    }

    // Update request status and add processing metadata
    const updatedRequest = {
      ...existingRequest,
      status: 'waiting_for_approval' as const,
      processedBy: user.email,
      processedDate: new Date().toISOString()
    }

    // Save updated request
    const savedRequest = await updateRequest(requestId, updatedRequest)
    
    return NextResponse.json({
      message: 'Request submitted for approval successfully',
      request: savedRequest
    })

  } catch (error) {
    console.error('Error submitting request for approval:', error)
    return NextResponse.json(
      { error: 'Failed to submit request for approval' },
      { status: 500 }
    )
  }
}

// Validation function for processing data
function validateProcessingData(data: ItemProcessingData): string | null {
  // If rejecting, must have rejection reason
  if (data.itemStatus === 'rejected') {
    if (!data.rejectionReason || data.rejectionReason.trim().length === 0) {
      return 'Rejection reason is required when rejecting an item'
    }
    // Rejected items don't need cost information
    return null
  }

  // If pricing, must have actual cost
  if (data.itemStatus === 'priced') {
    if (!data.actualCost || data.actualCost <= 0) {
      return 'Actual cost is required and must be greater than 0 when pricing an item'
    }
    
    // Must have cost proof (either file or link)
    if (!data.costProof || data.costProof.trim().length === 0) {
      return 'Cost proof (file or link) is required when pricing an item'
    }

    // Must specify proof type
    if (!data.costProofType) {
      return 'Cost proof type must be specified'
    }
  }

  return null
}