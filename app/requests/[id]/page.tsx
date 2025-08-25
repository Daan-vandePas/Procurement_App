'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Request, RequestItem, Priority, User, ItemProcessingData, ProcessingUpdate, ItemApprovalData, ApprovalUpdate } from '@/lib/types'
import PurchaserProcessingInterface from '@/components/PurchaserProcessingInterface'
import CEOApprovalInterface from '@/components/CEOApprovalInterface'

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<Request | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [processingItems, setProcessingItems] = useState<{[itemId: string]: ItemProcessingData}>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [approvalItems, setApprovalItems] = useState<{[itemId: string]: ItemApprovalData}>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user info
        const userResponse = await fetch('/api/auth/me')
        if (!userResponse.ok) {
          throw new Error('Authentication required')
        }
        const userData = await userResponse.json()
        setUser(userData)

        // Get request data
        const response = await fetch(`/api/requests/${requestId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Request not found')
          } else {
            throw new Error('Failed to fetch request')
          }
          return
        }
        const data = await response.json()
        setRequest(data)

        // Initialize processing state for purchasers
        if (userData.role === 'purchaser' && data.status === 'requested') {
          const initialProcessing: {[itemId: string]: ItemProcessingData} = {}
          data.items.forEach((item: RequestItem) => {
            initialProcessing[item.id] = {
              itemStatus: item.itemStatus || 'pending',
              actualCost: item.actualCost,
              costProof: item.costProof,
              costProofType: item.costProofType,
              rejectionReason: item.rejectionReason,
              supplierName: item.supplierName,
              supplierReference: item.supplierReference
            }
          })
          setProcessingItems(initialProcessing)
        }

        // Initialize approval state for CEOs
        if (userData.role === 'ceo' && data.status === 'waiting_for_approval') {
          const initialApproval: {[itemId: string]: ItemApprovalData} = {}
          data.items.forEach((item: RequestItem) => {
            initialApproval[item.id] = {
              approvalStatus: item.approvalStatus || 'pending_approval',
              ceoRejectionReason: item.ceoRejectionReason,
              approvedBy: item.approvedBy,
              approvedDate: item.approvedDate
            }
          })
          setApprovalItems(initialApproval)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    if (requestId) {
      fetchData()
    }
  }, [requestId])

  const handleDelete = async () => {
    if (!request || !confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete request')
      }

      // Redirect to requests list after successful deletion
      router.push('/requests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete request')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleItemUpdate = async (update: ProcessingUpdate) => {
    try {
      const response = await fetch(`/api/requests/${requestId}/process`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(update)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update item')
      }

      const updatedRequest = await response.json()
      setRequest(updatedRequest)
    } catch (error) {
      throw error
    }
  }

  // Pre-submit validation: Check database state before submitting
  const validateRequestForSubmission = async () => {
    try {
      console.log('🔍 Pre-submit: Validating request state in database...')
      
      // Fetch current request state from database
      const response = await fetch(`/api/requests/${requestId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch request state')
      }
      
      const currentRequest = await response.json()
      console.log('📊 Pre-submit: Current request items:', currentRequest.items.map((item: any) => ({
        id: item.id,
        itemName: item.itemName,
        itemStatus: item.itemStatus || 'pending'
      })))
      
      // Check all items are processed
      const unprocessedItems = currentRequest.items.filter((item: any) => 
        !item.itemStatus || item.itemStatus === 'pending'
      )
      
      if (unprocessedItems.length > 0) {
        const itemNames = unprocessedItems.map((item: any) => item.itemName).join(', ')
        return {
          isValid: false,
          errorMessage: `${unprocessedItems.length} item(s) still need processing: ${itemNames}. Please either add pricing information or reject these items.`
        }
      }
      
      console.log('✅ Pre-submit: All items are processed in database')
      return { isValid: true, errorMessage: null }
      
    } catch (error) {
      console.error('❌ Pre-submit validation error:', error)
      return {
        isValid: false,
        errorMessage: 'Unable to verify request state. Please try again.'
      }
    }
  }

  const handleSubmitForApproval = async () => {
    setIsSubmitting(true)
    try {
      console.log('🚀 Submit: Starting submission process...')
      
      // Step 1: Validate database state
      const validation = await validateRequestForSubmission()
      if (!validation.isValid) {
        console.error('❌ Submit: Pre-validation failed:', validation.errorMessage)
        setError(validation.errorMessage!)
        return
      }
      
      console.log('✅ Submit: Pre-validation passed, proceeding with submission...')
      
      // Step 2: Proceed with actual submission
      const response = await fetch(`/api/requests/${requestId}/process`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit for approval')
      }

      const result = await response.json()
      setRequest(result.request)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit for approval')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprovalUpdate = async (update: ApprovalUpdate) => {
    try {
      const response = await fetch(`/api/requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(update)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update approval')
      }

      const updatedRequest = await response.json()
      setRequest(updatedRequest)
      
      // Sync the local approval state with the updated request data
      const updatedApprovalItems: {[itemId: string]: ItemApprovalData} = {}
      updatedRequest.items.forEach((item: RequestItem) => {
        updatedApprovalItems[item.id] = {
          approvalStatus: item.approvalStatus || 'pending_approval',
          ceoRejectionReason: item.ceoRejectionReason,
          approvedBy: item.approvedBy,
          approvedDate: item.approvedDate
        }
      })
      setApprovalItems(updatedApprovalItems)
      
    } catch (error) {
      throw error
    }
  }

  const handleCompleteReview = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/requests/${requestId}/approve`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete review')
      }

      const result = await response.json()
      setRequest(result.request)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to complete review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-blue-100 text-blue-800'
      case 'waiting_for_approval':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'priced':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // Permission checks
  const canEditOriginal = user?.role === 'requester' && request?.requesterName === user.email && request?.status === 'draft'
  const canDeleteOriginal = user?.role === 'requester' && request?.requesterName === user.email && request?.status === 'draft'
  const canProcess = user?.role === 'purchaser' && request?.status === 'requested'
  const canApprove = user?.role === 'ceo' && request?.status === 'waiting_for_approval'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Request Details</h2>
          <Link
            href="/requests"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Requests
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading request</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!request) {
    return null
  }

  // Note: canEdit was redefined incorrectly, using permission checks from above

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Request Details</h2>
          <p className="text-gray-600">Request ID: {request.id}</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/requests"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Requests
          </Link>
          {canEditOriginal && (
            <>
              <Link
                href={`/requests/${request.id}/edit`}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Request
              </Link>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Request'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* CEO Approval Interface */}
      {canApprove && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Review Request Items</h3>
            <p className="text-sm text-gray-600 mt-1">
              Review each item and approve or reject based on business requirements.
            </p>
          </div>
          <div className="p-6">
            <CEOApprovalInterface
              items={request.items}
              onItemUpdate={handleApprovalUpdate}
              onCompleteReview={handleCompleteReview}
              approvalItems={approvalItems}
              setApprovalItems={setApprovalItems}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Request Info - Only show for non-purchasers and non-CEOs or non-processable/approvable requests */}
      {!canProcess && !canApprove && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Requester</h3>
              <div className="mt-1">
                <div className="text-sm text-gray-900">{request.requesterName.split('@')[0]}</div>
                <div className="text-xs text-gray-500">@{request.requesterName.split('@')[1]}</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`} style={{whiteSpace: 'pre-line', textAlign: 'center'}}>
                {request.status === 'waiting_for_approval' 
                  ? 'Waiting for\nApproval'
                  : request.status.replace('_', ' ').split(' ').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
                }
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Date Submitted</h3>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(request.requestDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Requested Items</h3>
            <div className="space-y-6">
              {request.items.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-base font-medium text-gray-900">
                      Item {index + 1}: {item.itemName}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority as string)}`}>
                      {item.priority}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-500">Quantity</h5>
                      <p className="mt-1 text-sm text-gray-900">{item.quantity}</p>
                    </div>
                    
                    {Number(item.estimatedCost) > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Estimated Cost</h5>
                        <p className="mt-1 text-sm text-gray-900">€{item.estimatedCost}</p>
                      </div>
                    )}
                    
                    {item.actualCost && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Actual Cost</h5>
                        <p className="mt-1 text-sm text-gray-900">€{item.actualCost}</p>
                      </div>
                    )}
                    
                    {item.itemStatus && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Item Status</h5>
                        <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getItemStatusColor(item.itemStatus)}`}>
                          {item.itemStatus}
                        </span>
                      </div>
                    )}
                    
                    {item.supplierName && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Supplier</h5>
                        <p className="mt-1 text-sm text-gray-900">{item.supplierName}</p>
                      </div>
                    )}
                    
                    {item.supplierReference && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Supplier Reference</h5>
                        <p className="mt-1 text-sm text-gray-900 break-all">{item.supplierReference}</p>
                      </div>
                    )}
                    
                    {item.neededByDate && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-500">Needed By</h5>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(item.neededByDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-500">Justification</h5>
                    <p className="mt-1 text-sm text-gray-900">{item.justification}</p>
                  </div>
                  
                  {item.rejectionReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <h5 className="text-sm font-medium text-red-800">Rejection Reason</h5>
                      <p className="mt-1 text-sm text-red-700">{item.rejectionReason}</p>
                    </div>
                  )}
                  
                  {item.costProof && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-500">Cost Proof</h5>
                      {item.costProofType === 'link' ? (
                        <a href={item.costProof} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-blue-600 hover:underline break-all">
                          {item.costProof}
                        </a>
                      ) : (
                        <a href={item.costProof} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-blue-600 hover:underline" download>
                          View/Download uploaded file
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Purchaser Processing Interface */}
      {canProcess && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Process Request Items</h3>
            <p className="text-sm text-gray-600 mt-1">
              Review each item and either add pricing information or reject the item.
            </p>
          </div>
          <div className="p-6">
            <PurchaserProcessingInterface
              items={request.items}
              requestId={requestId}
              onItemUpdate={handleItemUpdate}
              onSubmitForApproval={handleSubmitForApproval}
              processingItems={processingItems}
              setProcessingItems={setProcessingItems}
              isSubmitting={isSubmitting}
              uploadingFile={uploadingFile}
              setUploadingFile={setUploadingFile}
            />
          </div>
        </div>
      )}

      {/* Status Info */}
      {!canEditOriginal && !canProcess && !canApprove && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                {user?.role === 'requester' && request.status !== 'draft' 
                  ? 'This request cannot be edited or deleted because it has already been submitted.'
                  : user?.role === 'ceo' && request.status === 'waiting_for_approval'
                  ? 'This request is waiting for your approval.'
                  : 'This request is being processed.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}