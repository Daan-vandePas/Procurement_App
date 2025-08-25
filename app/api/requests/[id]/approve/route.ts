import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getRequest, updateRequest } from '@/lib/storage'
import { ApprovalUpdate, ItemApprovalData, RequestStatus } from '@/lib/types'

interface RouteParams {
  params: {
    id: string
  }
}

// PUT: Update individual item approval status
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

    // Only CEOs can approve requests
    if (user.role !== 'ceo') {
      return NextResponse.json(
        { error: 'Only CEOs can approve requests' },
        { status: 403 }
      )
    }

    const requestId = params.id
    const approvalUpdate: ApprovalUpdate = await request.json()

    // Get existing request
    const existingRequest = await getRequest(requestId)
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Security check: Only 'waiting_for_approval' status can be approved
    if (existingRequest.status !== 'waiting_for_approval') {
      return NextResponse.json(
        { error: 'Request is not in approvable status' },
        { status: 400 }
      )
    }

    // Find the item to update
    const itemIndex = existingRequest.items.findIndex(item => item.id === approvalUpdate.itemId)
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found in request' },
        { status: 404 }
      )
    }

    // Validate approval data
    const validationError = validateApprovalData(approvalUpdate.data)
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
            // Only update CEO approval-related fields
            approvalStatus: approvalUpdate.data.approvalStatus,
            ceoRejectionReason: approvalUpdate.data.ceoRejectionReason,
            approvedBy: approvalUpdate.data.approvedBy || user.email,
            approvedDate: approvalUpdate.data.approvedDate || new Date().toISOString()
          }
        }
        return item
      })
    }

    // Save updated request
    const savedRequest = await updateRequest(requestId, updatedRequest)
    
    return NextResponse.json(savedRequest)

  } catch (error) {
    console.error('Error processing approval:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}

// POST: Complete CEO review and update request status
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

    // Only CEOs can complete approval
    if (user.role !== 'ceo') {
      return NextResponse.json(
        { error: 'Only CEOs can complete request approval' },
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

    // Security check: Only 'waiting_for_approval' status can be completed
    if (existingRequest.status !== 'waiting_for_approval') {
      return NextResponse.json(
        { error: 'Request is not in approvable status' },
        { status: 400 }
      )
    }

    // Validate all items have been reviewed
    const unprocessedItems = existingRequest.items.filter(item => 
      !item.approvalStatus || item.approvalStatus === 'pending_approval'
    )

    if (unprocessedItems.length > 0) {
      return NextResponse.json(
        { error: `${unprocessedItems.length} items still need to be reviewed` },
        { status: 400 }
      )
    }

    // Determine final request status based on item approvals
    const hasApprovedItems = existingRequest.items.some(item => item.approvalStatus === 'approved')
    const hasRejectedItems = existingRequest.items.some(item => item.approvalStatus === 'rejected')
    const allApproved = existingRequest.items.every(item => item.approvalStatus === 'approved')
    const allRejected = existingRequest.items.every(item => item.approvalStatus === 'rejected')
    
    // Business logic: 
    // - All approved -> 'approval_completed'
    // - All rejected -> 'rejected'  
    // - Mixed (some approved, some rejected) -> 'processed'
    let finalStatus: RequestStatus
    if (allApproved) {
      finalStatus = 'approval_completed'
    } else if (allRejected) {
      finalStatus = 'rejected'
    } else {
      // Mixed approvals/rejections
      finalStatus = 'processed'
    }

    // Update request status and add approval metadata
    const updatedRequest = {
      ...existingRequest,
      status: finalStatus,
      approvalCompletedBy: user.email,
      approvalCompletedDate: new Date().toISOString()
    }

    // Save updated request
    const savedRequest = await updateRequest(requestId, updatedRequest)
    
    return NextResponse.json({
      message: 'Request approval completed successfully',
      request: savedRequest
    })

  } catch (error) {
    console.error('Error completing approval:', error)
    return NextResponse.json(
      { error: 'Failed to complete approval' },
      { status: 500 }
    )
  }
}

// Validation function for approval data
function validateApprovalData(data: ItemApprovalData): string | null {
  // If rejecting, must have rejection reason
  if (data.approvalStatus === 'rejected') {
    if (!data.ceoRejectionReason || data.ceoRejectionReason.trim().length === 0) {
      return 'Rejection reason is required when rejecting an item'
    }
  }

  // Validate approval status
  if (!['pending_approval', 'approved', 'rejected'].includes(data.approvalStatus)) {
    return 'Invalid approval status'
  }

  return null
}