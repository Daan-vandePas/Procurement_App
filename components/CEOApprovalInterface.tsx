'use client'

import { useState } from 'react'
import { RequestItem, ItemApprovalData, ApprovalUpdate } from '@/lib/types'

interface CEOApprovalInterfaceProps {
  items: RequestItem[]
  onItemUpdate: (update: ApprovalUpdate) => Promise<void>
  onCompleteReview: () => Promise<void>
  approvalItems: {[itemId: string]: ItemApprovalData}
  setApprovalItems: (items: {[itemId: string]: ItemApprovalData}) => void
  isSubmitting: boolean
}

export default function CEOApprovalInterface({
  items,
  onItemUpdate,
  onCompleteReview,
  approvalItems,
  setApprovalItems,
  isSubmitting
}: CEOApprovalInterfaceProps) {
  const [errors, setErrors] = useState<{[itemId: string]: string}>({})
  const [expandedItems, setExpandedItems] = useState<{[itemId: string]: boolean}>({})
  const [showingRejectionField, setShowingRejectionField] = useState<{[itemId: string]: boolean}>({})

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems({
      ...expandedItems,
      [itemId]: !expandedItems[itemId]
    })
  }

  const updateApprovalItem = (itemId: string, field: keyof ItemApprovalData, value: any) => {
    const currentItem = approvalItems[itemId] || { approvalStatus: 'pending_approval' }
    const updatedItem = { ...currentItem, [field]: value }
    
    setApprovalItems({
      ...approvalItems,
      [itemId]: updatedItem
    })
    
    // Clear any existing errors for this item
    if (errors[itemId]) {
      const newErrors = { ...errors }
      delete newErrors[itemId]
      setErrors(newErrors)
    }
  }

  const handleApprovalAction = async (itemId: string, action: 'approve' | 'reject' | 'pending') => {
    // If rejecting, just show the rejection field but don't submit yet
    if (action === 'reject') {
      setShowingRejectionField({
        ...showingRejectionField,
        [itemId]: true
      })
      return
    }

    try {
      let approvalData: ItemApprovalData
      
      if (action === 'approve') {
        approvalData = {
          approvalStatus: 'approved',
          approvedBy: 'CEO', // This will be set properly by the API
          approvedDate: new Date().toISOString()
        }
      } else {
        // Reset to pending (used for the reset button)
        approvalData = {
          approvalStatus: 'pending_approval'
        }
      }

      await onItemUpdate({
        itemId,
        data: approvalData
      })

      // Clear rejection field visibility and errors
      setShowingRejectionField({
        ...showingRejectionField,
        [itemId]: false
      })
      
      if (errors[itemId]) {
        const newErrors = { ...errors }
        delete newErrors[itemId]
        setErrors(newErrors)
      }

    } catch (error) {
      setErrors({
        ...errors,
        [itemId]: error instanceof Error ? error.message : 'Failed to update approval status'
      })
    }
  }

  const handleRejectSubmit = async (itemId: string) => {
    try {
      const rejectionReason = approvalItems[itemId]?.ceoRejectionReason?.trim()
      if (!rejectionReason) {
        setErrors({
          ...errors,
          [itemId]: 'Rejection reason is required when rejecting an item'
        })
        return
      }

      const approvalData: ItemApprovalData = {
        approvalStatus: 'rejected',
        ceoRejectionReason: rejectionReason,
        approvedBy: 'CEO',
        approvedDate: new Date().toISOString()
      }

      await onItemUpdate({
        itemId,
        data: approvalData
      })

      // Clear rejection field visibility and errors
      setShowingRejectionField({
        ...showingRejectionField,
        [itemId]: false
      })
      
      if (errors[itemId]) {
        const newErrors = { ...errors }
        delete newErrors[itemId]
        setErrors(newErrors)
      }

    } catch (error) {
      setErrors({
        ...errors,
        [itemId]: error instanceof Error ? error.message : 'Failed to reject item'
      })
    }
  }

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending_approval':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getApprovalSummary = () => {
    // Only consider items that need CEO approval (not rejected by purchaser)
    const itemsForApproval = items.filter(item => item.itemStatus !== 'rejected')
    
    const approved = itemsForApproval.filter(item => 
      (approvalItems[item.id]?.approvalStatus || item.approvalStatus) === 'approved'
    ).length
    const rejected = itemsForApproval.filter(item => 
      (approvalItems[item.id]?.approvalStatus || item.approvalStatus) === 'rejected'
    ).length
    const pending = itemsForApproval.length - approved - rejected
    const rejectedByPurchaser = items.filter(item => item.itemStatus === 'rejected').length

    return { approved, rejected, pending, rejectedByPurchaser, totalItems: itemsForApproval.length }
  }

  const canCompleteReview = () => {
    // Only items that need CEO approval (not rejected by purchaser) need to be reviewed
    const itemsForApproval = items.filter(item => item.itemStatus !== 'rejected')
    return itemsForApproval.every(item => {
      const status = approvalItems[item.id]?.approvalStatus || item.approvalStatus
      return status === 'approved' || status === 'rejected'
    })
  }

  const handleCompleteReview = async () => {
    if (!canCompleteReview()) {
      setErrors({
        ...errors,
        general: 'Please review all items before completing the approval process'
      })
      return
    }

    try {
      await onCompleteReview()
    } catch (error) {
      setErrors({
        ...errors,
        general: error instanceof Error ? error.message : 'Failed to complete review'
      })
    }
  }

  const summary = getApprovalSummary()

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              Review Progress: {summary.approved} approved, {summary.rejected} rejected, {summary.pending} pending
            </p>
            {summary.rejectedByPurchaser > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                ({summary.rejectedByPurchaser} items already rejected by purchaser - no action needed)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {items.filter(item => item.itemStatus !== 'rejected').map((item, filteredIndex) => {
          // Get original index for display
          const originalIndex = items.findIndex(originalItem => originalItem.id === item.id)
          // Use the most current approval status (prioritize local state if it exists)
          const currentApprovalStatus = approvalItems[item.id]?.approvalStatus || item.approvalStatus || 'pending_approval'
          const currentApproval = {
            approvalStatus: currentApprovalStatus,
            ceoRejectionReason: approvalItems[item.id]?.ceoRejectionReason || item.ceoRejectionReason,
            approvedBy: approvalItems[item.id]?.approvedBy || item.approvedBy,
            approvedDate: approvalItems[item.id]?.approvedDate || item.approvedDate
          }
          const isExpanded = expandedItems[item.id]
          const hasError = errors[item.id]

          return (
            <div key={item.id} className="border border-gray-200 rounded-lg bg-white">
              {/* Item Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleItemExpansion(item.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className={`w-5 h-5 transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <h3 className="text-base font-medium text-gray-900">
                      Item {originalIndex + 1}: {item.itemName}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getApprovalStatusColor(currentApproval.approvalStatus)}`}>
                    {currentApproval.approvalStatus === 'pending_approval' ? 'Pending Review' : 
                     currentApproval.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => handleApprovalAction(item.id, 'approve')}
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      currentApproval.approvalStatus === 'approved'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50'
                    }`}
                  >
                    {currentApproval.approvalStatus === 'approved' ? '✓ Approved' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleApprovalAction(item.id, 'reject')}
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      currentApproval.approvalStatus === 'rejected'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50'
                    }`}
                  >
                    {currentApproval.approvalStatus === 'rejected' ? '✗ Rejected' : 'Reject'}
                  </button>
                  {currentApproval.approvalStatus !== 'pending_approval' && (
                    <button
                      onClick={() => handleApprovalAction(item.id, 'pending')}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                    >
                      Reset to Pending
                    </button>
                  )}
                </div>

                {/* Rejection Reason Input */}
                {(currentApproval.approvalStatus === 'rejected' || showingRejectionField[item.id]) && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rejection Reason *
                    </label>
                    <textarea
                      value={approvalItems[item.id]?.ceoRejectionReason || ''}
                      onChange={(e) => updateApprovalItem(item.id, 'ceoRejectionReason', e.target.value)}
                      placeholder="Please provide a reason for rejecting this item..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    {currentApproval.approvalStatus !== 'rejected' && (
                      <div className="mt-2 flex space-x-3">
                        <button
                          onClick={() => handleRejectSubmit(item.id)}
                          disabled={isSubmitting}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                        >
                          Submit Rejection
                        </button>
                        <button
                          onClick={() => setShowingRejectionField({...showingRejectionField, [item.id]: false})}
                          disabled={isSubmitting}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {hasError && (
                  <div className="mt-2 text-sm text-red-600">
                    {hasError}
                  </div>
                )}
              </div>

              {/* Expanded Item Details */}
              {isExpanded && (
                <div className="p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Request Details</h4>
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Quantity:</span> {item.quantity}</p>
                        <p><span className="text-gray-500">Priority:</span> {item.priority}</p>
                        <p><span className="text-gray-500">Estimated Cost:</span> €{item.estimatedCost}</p>
                        <p><span className="text-gray-500">Needed By:</span> {new Date(item.neededByDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Purchaser Information</h4>
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Supplier:</span> {item.supplierName || 'Not specified'}</p>
                        <p><span className="text-gray-500">Reference:</span> {item.supplierReference || 'Not specified'}</p>
                        <p><span className="text-gray-500">Actual Cost:</span> {item.actualCost ? `€${item.actualCost}` : 'Not specified'}</p>
                        <p><span className="text-gray-500">Status:</span> 
                          <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                            item.itemStatus === 'priced' ? 'bg-green-100 text-green-800' : 
                            item.itemStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.itemStatus || 'pending'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-1">Justification</h4>
                    <p className="text-gray-700">{item.justification}</p>
                  </div>
                  {item.rejectionReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <h4 className="font-medium text-red-800 mb-1">Purchaser Rejection Reason</h4>
                      <p className="text-red-700 text-sm">{item.rejectionReason}</p>
                    </div>
                  )}
                  {item.costProof && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-900 mb-1">Cost Proof</h4>
                      {item.costProofType === 'link' ? (
                        <a href={item.costProof} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                          {item.costProof}
                        </a>
                      ) : (
                        <a href={item.costProof} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm" download>
                          View/Download uploaded file
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Complete Review Button */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div>
          {errors.general && (
            <p className="text-sm text-red-600">{errors.general}</p>
          )}
        </div>
        <button
          onClick={handleCompleteReview}
          disabled={!canCompleteReview() || isSubmitting}
          className={`px-6 py-3 text-sm font-medium rounded-md transition-colors ${
            canCompleteReview() && !isSubmitting
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Completing Review...' : 'Complete Review'}
        </button>
      </div>
    </div>
  )
}