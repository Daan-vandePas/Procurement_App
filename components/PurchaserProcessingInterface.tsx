'use client'

import { useState } from 'react'
import { RequestItem, ItemProcessingData, ProcessingUpdate, CostProofType } from '@/lib/types'

interface PurchaserProcessingInterfaceProps {
  items: RequestItem[]
  onItemUpdate: (update: ProcessingUpdate) => Promise<void>
  onSubmitForApproval: () => Promise<void>
  processingItems: {[itemId: string]: ItemProcessingData}
  setProcessingItems: (items: {[itemId: string]: ItemProcessingData}) => void
  isSubmitting: boolean
  uploadingFile: string | null
  setUploadingFile: (itemId: string | null) => void
}

export default function PurchaserProcessingInterface({
  items,
  onItemUpdate,
  onSubmitForApproval,
  processingItems,
  setProcessingItems,
  isSubmitting,
  uploadingFile,
  setUploadingFile
}: PurchaserProcessingInterfaceProps) {
  const [errors, setErrors] = useState<{[itemId: string]: string}>({})
  const [linkInputs, setLinkInputs] = useState<{[itemId: string]: string}>({})
  const [expandedItems, setExpandedItems] = useState<{[itemId: string]: boolean}>({})

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems({
      ...expandedItems,
      [itemId]: !expandedItems[itemId]
    })
  }

  const updateProcessingItem = (itemId: string, field: keyof ItemProcessingData, value: any) => {
    const currentItem = processingItems[itemId] || { itemStatus: 'pending' }
    const updatedItem = { ...currentItem, [field]: value }
    
    
    setProcessingItems({
      ...processingItems,
      [itemId]: updatedItem
    })
    
    // Clear any existing errors for this item
    if (errors[itemId]) {
      const newErrors = { ...errors }
      delete newErrors[itemId]
      setErrors(newErrors)
    }
  }

  const handleFileUpload = async (itemId: string, file: File) => {
    setUploadingFile(itemId)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }
      
      // Update the processing item with file info
      const fileUrl = result.url || result.blobUrl
      
      if (!fileUrl) {
        throw new Error('Upload succeeded but no file URL returned')
      }
      
      // Update both fields at once to avoid race conditions
      const currentItem = processingItems[itemId] || { itemStatus: 'pending' }
      const updatedItem = { 
        ...currentItem, 
        costProof: fileUrl,
        costProofType: (result.type === 'pdf' ? 'pdf' : 'image') as CostProofType
      }
      
      setProcessingItems({
        ...processingItems,
        [itemId]: updatedItem
      })
      
      // Clear the link input when a file is uploaded
      setLinkInputs({ ...linkInputs, [itemId]: '' })
      
    } catch (error) {
      setErrors({
        ...errors,
        [itemId]: error instanceof Error ? error.message : 'Upload failed'
      })
    } finally {
      setUploadingFile(null)
    }
  }

  const handleSaveItem = async (itemId: string) => {
    const itemData = processingItems[itemId]
    if (!itemData) return

    // Validate item data
    let validationError = ''
    
    if (itemData.itemStatus === 'rejected') {
      if (!itemData.rejectionReason?.trim()) {
        validationError = 'Rejection reason is required'
      }
    } else if (itemData.itemStatus === 'priced') {
      if (!itemData.actualCost || itemData.actualCost <= 0) {
        validationError = 'Actual cost must be greater than 0'
      } else if (!itemData.costProof?.trim()) {
        validationError = 'Cost proof is required'
      }
    }
    
    if (validationError) {
      setErrors({ ...errors, [itemId]: validationError })
      return
    }

    try {
      await onItemUpdate({ itemId, data: itemData })
      setErrors({ ...errors, [itemId]: '' })
      // Collapse the item after successful save
      setExpandedItems({ ...expandedItems, [itemId]: false })
    } catch (error) {
      setErrors({
        ...errors,
        [itemId]: error instanceof Error ? error.message : 'Failed to save item'
      })
    }
  }

  const getProcessedCount = () => {
    return items.filter(item => {
      const processing = processingItems[item.id]
      return processing && processing.itemStatus !== 'pending'
    }).length
  }

  const canSubmitForApproval = () => {
    // Don't allow submit if any file is currently uploading
    if (uploadingFile !== null) {
      return false
    }
    
    return items.every(item => {
      const processing = processingItems[item.id]
      return processing && processing.itemStatus !== 'pending'
    })
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

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Processing Progress</h3>
            <p className="text-sm text-blue-700">
              {getProcessedCount()} of {items.length} items processed
            </p>
          </div>
          <div className="flex items-center">
            <div className="w-32 bg-blue-200 rounded-full h-2 mr-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${(getProcessedCount() / items.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-blue-900">
              {Math.round((getProcessedCount() / items.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Items Processing */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const processing = processingItems[item.id] || { itemStatus: 'pending' }
          const error = errors[item.id]
          
          const hasCost = !!processing.actualCost && processing.actualCost > 0
          const hasProof = !!processing.costProof && 
                          processing.costProof !== 'undefined' && 
                          processing.costProof.toString().trim().length > 0
          const isUploading = uploadingFile === item.id
          const canSave = hasCost && hasProof && !isUploading
          const isProcessed = processing.itemStatus !== 'pending'
          const isExpanded = expandedItems[item.id] ?? !isProcessed // Default: expand unprocessed items, collapse processed ones
          
          return (
            <div key={item.id} className={`bg-white border rounded-lg p-6 ${isProcessed ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
              {/* Item Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    Item {index + 1}: {item.itemName}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity} | Estimated: €{item.estimatedCost}
                  </p>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getItemStatusColor(processing.itemStatus)}`}>
                  {processing.itemStatus}
                </span>
              </div>

              {/* Processing Options */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pricing Section */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Option 1: Add Pricing</h5>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost for total Quantity (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={processing.actualCost || ''}
                      onChange={(e) => updateProcessingItem(item.id, 'actualCost', parseFloat(e.target.value) || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={processing.supplierName || ''}
                      onChange={(e) => updateProcessingItem(item.id, 'supplierName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter supplier name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={processing.supplierReference || ''}
                      onChange={(e) => updateProcessingItem(item.id, 'supplierReference', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Part number, SKU, or supplier reference"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Proof
                    </label>
                    <div className="space-y-2">
                      {/* File Upload */}
                      <div>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(item.id, file)
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          disabled={uploadingFile === item.id}
                        />
                        {uploadingFile === item.id && (
                          <p className="text-sm text-blue-600">Uploading...</p>
                        )}
                      </div>
                      
                      {/* Or Link Input */}
                      <div>
                        <input
                          type="url"
                          value={linkInputs[item.id] || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            setLinkInputs({ ...linkInputs, [item.id]: value })
                            
                            // Update both fields atomically (clear previous file if any)
                            const currentItem = processingItems[item.id] || { itemStatus: 'pending' }
                            const updatedItem = { 
                              ...currentItem, 
                              costProof: value,
                              costProofType: value ? ('link' as CostProofType) : undefined
                            }
                            
                                            setProcessingItems({
                              ...processingItems,
                              [item.id]: updatedItem
                            })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Or paste a link to cost proof"
                        />
                      </div>
                      
                      {processing.costProof && (
                        <p className="text-sm text-green-600">
                          ✓ Cost proof: {processing.costProofType === 'link' ? 'Link' : 'File'} uploaded
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        // First set the status to 'priced'
                        updateProcessingItem(item.id, 'itemStatus', 'priced')
                        
                        // Wait for state to update, then save immediately
                        await new Promise(resolve => setTimeout(resolve, 50))
                        await handleSaveItem(item.id)
                      } catch (error) {
                        console.error('Error saving priced item:', error)
                      }
                    }}
                    disabled={!canSave}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading File...' : 
                     `Save Pricing ${!hasCost ? '(Missing Cost)' : !hasProof ? '(Missing Proof)' : '✓'}`}
                  </button>
                </div>

                {/* Rejection Section */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Option 2: Reject Item</h5>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rejection Reason
                    </label>
                    <textarea
                      value={processing.rejectionReason || ''}
                      onChange={(e) => updateProcessingItem(item.id, 'rejectionReason', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Explain why this item is being rejected..."
                    />
                  </div>

                  <button
                    onClick={async () => {
                      updateProcessingItem(item.id, 'itemStatus', 'rejected')
                      // Wait a moment for state update, then save
                      setTimeout(() => handleSaveItem(item.id), 100)
                    }}
                    disabled={!processing.rejectionReason?.trim()}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Item
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit for Approval */}
      {canSubmitForApproval() && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-green-900">Ready for Approval</h3>
              <p className="text-sm text-green-700">
                All items have been processed. You can now submit this request for approval.
              </p>
            </div>
            <button
              onClick={onSubmitForApproval}
              disabled={isSubmitting || uploadingFile !== null}
              className="bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {isSubmitting ? 'Validating & Submitting...' : 
               uploadingFile ? 'Uploading files...' : 
               'Submit for Approval'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}