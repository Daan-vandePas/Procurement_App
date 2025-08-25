'use client'

import { useState } from 'react'
import { RequestItem, ItemProcessingData, ProcessingUpdate, CostProofType } from '@/lib/types'

interface PurchaserProcessingInterfaceProps {
  items: RequestItem[]
  requestId: string
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
  requestId,
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
  
  // New state for backend verification tracking
  const [savingItems, setSavingItems] = useState<{[itemId: string]: boolean}>({})
  const [verifiedItems, setVerifiedItems] = useState<{[itemId: string]: boolean}>({})
  const [verificationErrors, setVerificationErrors] = useState<{[itemId: string]: string}>({})
  
  // Track last successfully saved data to determine if changes were made
  const [lastSavedData, setLastSavedData] = useState<{[itemId: string]: ItemProcessingData}>({})

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems({
      ...expandedItems,
      [itemId]: !expandedItems[itemId]
    })
  }

  const updateProcessingItem = (itemId: string, field: keyof ItemProcessingData, value: any) => {
    const currentItem = processingItems[itemId] || { itemStatus: 'pending' }
    const updatedItem = { ...currentItem, [field]: value }
    
    // If changing item status, clear verification state 
    if (field === 'itemStatus') {
      console.log(`🔄 Changing item ${itemId} status from ${currentItem.itemStatus} to ${value}`)
      
      // Clear verification status when changing item status
      const newVerifiedItems = { ...verifiedItems }
      delete newVerifiedItems[itemId]
      setVerifiedItems(newVerifiedItems)
      
      // Clear verification errors
      const newVerificationErrors = { ...verificationErrors }
      delete newVerificationErrors[itemId]
      setVerificationErrors(newVerificationErrors)
      
      // If changing to rejected, clear cost-related fields that aren't needed
      if (value === 'rejected') {
        console.log(`🔴 Item ${itemId} being rejected - cost proof not required`)
        // Don't clear cost fields in case user wants to switch back, but ensure validation doesn't require them
      }
    }
    
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

  // Backend verification function to ensure item was saved correctly
  const verifyItemInDatabase = async (itemId: string, requestId: string, expectedData: ItemProcessingData): Promise<{success: boolean, error?: string}> => {
    try {
      console.log('🔍 Verifying item in database:', itemId, expectedData)
      
      // Fetch current request data from backend
      const response = await fetch(`/api/requests/${requestId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch request for verification')
      }
      
      const currentRequest = await response.json()
      const item = currentRequest.items.find((item: any) => item.id === itemId)
      
      if (!item) {
        return { success: false, error: 'Item not found in database' }
      }
      
      // Verify all expected fields match
      const verificationChecks = []
      
      if (expectedData.itemStatus === 'priced') {
        if (item.itemStatus !== 'priced') {
          verificationChecks.push(`Item status: expected 'priced', got '${item.itemStatus || 'undefined'}'`)
        }
        if (!item.actualCost || item.actualCost !== expectedData.actualCost) {
          verificationChecks.push(`Actual cost: expected '${expectedData.actualCost}', got '${item.actualCost || 'undefined'}'`)
        }
        if (!item.costProof || item.costProof !== expectedData.costProof) {
          verificationChecks.push(`Cost proof: expected '${expectedData.costProof}', got '${item.costProof || 'undefined'}'`)
        }
        if (!item.costProofType || item.costProofType !== expectedData.costProofType) {
          verificationChecks.push(`Cost proof type: expected '${expectedData.costProofType}', got '${item.costProofType || 'undefined'}'`)
        }
      } else if (expectedData.itemStatus === 'rejected') {
        console.log('🔴 Verifying REJECTED item - cost proof should NOT be checked:', {
          expectedStatus: expectedData.itemStatus,
          actualStatus: item.itemStatus,
          expectedReason: expectedData.rejectionReason,
          actualReason: item.rejectionReason
        })
        
        if (item.itemStatus !== 'rejected') {
          verificationChecks.push(`Item status: expected 'rejected', got '${item.itemStatus || 'undefined'}'`)
        }
        if (!item.rejectionReason || item.rejectionReason !== expectedData.rejectionReason) {
          verificationChecks.push(`Rejection reason: expected '${expectedData.rejectionReason}', got '${item.rejectionReason || 'undefined'}'`)
        }
        
        // For rejected items, we explicitly do NOT check cost proof fields
        console.log('✅ Rejected item verification complete - cost fields ignored as expected')
      }
      
      if (verificationChecks.length > 0) {
        const errorMsg = `Backend verification failed: ${verificationChecks.join(', ')}`
        console.error('❌ Verification failed:', errorMsg)
        return { success: false, error: errorMsg }
      }
      
      console.log('✅ Verification successful for item:', itemId)
      return { success: true }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown verification error'
      console.error('❌ Verification error:', errorMsg)
      return { success: false, error: errorMsg }
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
      setLinkInputs(prev => ({ ...prev, [itemId]: '' }))
      
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [itemId]: error instanceof Error ? error.message : 'Upload failed'
      }))
    } finally {
      setUploadingFile(null)
    }
  }

  const handleSaveItem = async (itemId: string, freshData?: ItemProcessingData) => {
    // Use fresh data if provided, otherwise fall back to state (for backwards compatibility)
    const itemData = freshData || processingItems[itemId]
    if (!itemData) return
    
    console.log('💾 handleSaveItem called with:', { 
      itemId, 
      usingFreshData: !!freshData, 
      itemStatus: itemData.itemStatus,
      source: freshData ? 'fresh parameter' : 'processingItems state' 
    })

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
      setErrors(prev => ({ ...prev, [itemId]: validationError }))
      return
    }

    // Set saving state
    setSavingItems(prev => ({ ...prev, [itemId]: true }))
    
    // Clear previous verification status
    const newVerifiedItems = { ...verifiedItems }
    delete newVerifiedItems[itemId]
    setVerifiedItems(newVerifiedItems)
    
    const newVerificationErrors = { ...verificationErrors }
    delete newVerificationErrors[itemId]
    setVerificationErrors(newVerificationErrors)

    try {
      if (itemData.itemStatus === 'rejected') {
        console.log('🔴 Saving REJECTED item to backend:', itemId, {
          itemStatus: itemData.itemStatus,
          rejectionReason: itemData.rejectionReason,
          note: 'Cost proof should NOT be required for rejected items'
        })
      } else {
        console.log('💾 Saving item to backend:', itemId, itemData)
      }
      
      // Step 1: Save to backend
      await onItemUpdate({ itemId, data: itemData })
      
      // Step 2: Verify the save was successful in backend
      console.log('🔍 Verifying item was saved correctly...')
      const verificationResult = await verifyItemInDatabase(itemId, requestId, itemData)
      
      if (verificationResult.success) {
        // Success: Mark as verified and clear errors
        console.log('✅ Item verified successfully in backend:', itemId)
        setVerifiedItems(prev => ({ ...prev, [itemId]: true }))
        setErrors(prev => ({ ...prev, [itemId]: '' }))
        // Store the successfully saved data for change detection
        setLastSavedData(prev => ({ ...prev, [itemId]: itemData }))
        // Collapse the item after successful save and verification
        setExpandedItems(prev => ({ ...prev, [itemId]: false }))
      } else {
        // Verification failed: Show error but don't mark as verified
        console.error('❌ Backend verification failed:', verificationResult.error)
        setVerificationErrors(prev => ({ 
          ...prev, 
          [itemId]: verificationResult.error || 'Backend verification failed' 
        }))
        setErrors(prev => ({ 
          ...prev, 
          [itemId]: `Save completed but verification failed: ${verificationResult.error}. Please try saving again.` 
        }))
      }
      
    } catch (error) {
      console.error('❌ Save failed:', error)
      setErrors(prev => ({
        ...prev,
        [itemId]: error instanceof Error ? error.message : 'Failed to save item'
      }))
    } finally {
      // Clear saving state
      setSavingItems(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const getProcessedCount = () => {
    return items.filter(item => {
      const processing = processingItems[item.id]
      return processing && processing.itemStatus !== 'pending'
    }).length
  }

  // Check if current item data differs from last successfully saved data
  const hasDataChanged = (itemId: string): boolean => {
    const currentData = processingItems[itemId]
    const savedData = lastSavedData[itemId]
    
    if (!currentData || !savedData) return true
    
    // Compare relevant fields for pricing
    if (currentData.itemStatus === 'priced' || savedData.itemStatus === 'priced') {
      return (
        currentData.actualCost !== savedData.actualCost ||
        currentData.costProof !== savedData.costProof ||
        currentData.supplierName !== savedData.supplierName ||
        currentData.supplierReference !== savedData.supplierReference ||
        currentData.itemStatus !== savedData.itemStatus
      )
    }
    
    // Compare relevant fields for rejection
    if (currentData.itemStatus === 'rejected' || savedData.itemStatus === 'rejected') {
      return (
        currentData.rejectionReason !== savedData.rejectionReason ||
        currentData.itemStatus !== savedData.itemStatus
      )
    }
    
    return true
  }

  const canSubmitForApproval = () => {
    // Don't allow submit if any file is currently uploading
    if (uploadingFile !== null) {
      return false
    }
    
    // Don't allow submit if any items are currently being saved
    if (Object.values(savingItems).some(isSaving => isSaving)) {
      return false
    }
    
    // All items must be processed and verified in the backend
    return items.every(item => {
      const processing = processingItems[item.id]
      const isProcessed = processing && processing.itemStatus !== 'pending'
      const isVerified = verifiedItems[item.id]
      
      // Item must be both processed and verified in backend
      return isProcessed && isVerified
    })
  }

  const getVerificationProgress = () => {
    const processedCount = items.filter(item => {
      const processing = processingItems[item.id]
      return processing && processing.itemStatus !== 'pending'
    }).length
    
    const verifiedCount = items.filter(item => verifiedItems[item.id]).length
    const savingCount = Object.values(savingItems).filter(Boolean).length
    
    return { processedCount, verifiedCount, savingCount, totalCount: items.length }
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
            <h3 className="text-lg font-medium text-blue-900">Processing & Verification Progress</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>{getProcessedCount()} of {items.length} items processed</p>
              <p>{getVerificationProgress().verifiedCount} of {items.length} items verified in database</p>
              {getVerificationProgress().savingCount > 0 && (
                <p className="text-blue-600 font-medium">
                  {getVerificationProgress().savingCount} items currently saving & verifying...
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-32 bg-blue-200 rounded-full h-2 mr-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${(getVerificationProgress().verifiedCount / items.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-blue-900">
              {Math.round((getVerificationProgress().verifiedCount / items.length) * 100)}% Verified
            </span>
          </div>
        </div>
      </div>

      {/* Items Processing */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const processing = processingItems[item.id] || { itemStatus: 'pending' }
          const error = errors[item.id]
          const verificationError = verificationErrors[item.id]
          
          const hasCost = !!processing.actualCost && processing.actualCost > 0
          const hasProof = !!processing.costProof && 
                          processing.costProof !== 'undefined' && 
                          processing.costProof.toString().trim().length > 0
          const isUploading = uploadingFile === item.id
          const isSaving = savingItems[item.id]
          const isVerified = verifiedItems[item.id]
          const dataChanged = hasDataChanged(item.id)
          const canSave = hasCost && hasProof && !isUploading && !isSaving && (!isVerified || dataChanged)
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
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getItemStatusColor(processing.itemStatus)}`}>
                    {processing.itemStatus}
                  </span>
                  {isSaving && (
                    <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                      Saving...
                    </span>
                  )}
                  {isVerified && !isSaving && (
                    <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                      ✅ Verified
                    </span>
                  )}
                  {verificationError && !isSaving && (
                    <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                      ❌ Failed
                    </span>
                  )}
                </div>
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
                            setLinkInputs(prev => ({ ...prev, [item.id]: value }))
                            
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
                        console.log('💰 Save Pricing clicked for item:', item.id)
                        
                        // Create fresh data with updated status
                        const currentItem = processingItems[item.id] || { itemStatus: 'pending' as const }
                        const freshData = { ...currentItem, itemStatus: 'priced' as const }
                        
                        console.log('📝 Fresh data for save:', freshData)
                        
                        // Update the UI state
                        updateProcessingItem(item.id, 'itemStatus', 'priced')
                        
                        // Use fresh data directly - no waiting for state update needed
                        await handleSaveItem(item.id, freshData)
                      } catch (error) {
                        console.error('Error saving priced item:', error)
                      }
                    }}
                    disabled={!canSave}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading File...' : 
                     isSaving ? 'Saving & Verifying...' :
                     isVerified && !dataChanged ? '✅ Pricing Saved & Verified' :
                     isVerified && dataChanged ? 'Save Updated Pricing' :
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
                      try {
                        console.log('🔴 Reject Item clicked for item:', item.id, processing.rejectionReason)
                        
                        // Create fresh data with updated status
                        const currentItem = processingItems[item.id] || { itemStatus: 'pending' as const }
                        const freshData = { ...currentItem, itemStatus: 'rejected' as const }
                        
                        console.log('📝 Fresh data for rejection:', freshData)
                        
                        // Update the UI state
                        updateProcessingItem(item.id, 'itemStatus', 'rejected')
                        
                        // Use fresh data directly - no waiting for state update needed
                        await handleSaveItem(item.id, freshData)
                      } catch (error) {
                        console.error('Error rejecting item:', error)
                      }
                    }}
                    disabled={!processing.rejectionReason?.trim() || isSaving || (isVerified && !dataChanged)}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Rejecting & Verifying...' :
                     isVerified && !dataChanged ? '✅ Rejection Saved & Verified' :
                     isVerified && dataChanged ? 'Save Updated Rejection' :
                     `Reject Item ${!processing.rejectionReason?.trim() ? '(Missing Reason)' : '✓'}`}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {verificationError && !error && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-yellow-800">Backend Verification Failed</h4>
                        <p className="text-sm text-yellow-700 mt-1">{verificationError}</p>
                        <p className="text-sm text-yellow-600 mt-1">The item may not have been saved correctly to the database.</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          console.log('🔄 Retrying save for item:', item.id, 'current status:', processing.itemStatus)
                          
                          const targetStatus = processing.itemStatus === 'rejected' ? 'rejected' as const : 'priced' as const
                          
                          // Create fresh data with current status
                          const currentItem = processingItems[item.id] || { itemStatus: 'pending' as const }  
                          const freshData = { ...currentItem, itemStatus: targetStatus }
                          
                          console.log('📝 Fresh data for retry:', freshData)
                          
                          // Update UI state
                          updateProcessingItem(item.id, 'itemStatus', targetStatus)
                          
                          // Use fresh data directly
                          await handleSaveItem(item.id, freshData)
                        } catch (error) {
                          console.error('Error during retry:', error)
                        }
                      }}
                      disabled={isSaving}
                      className="ml-4 px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded-md disabled:opacity-50"
                    >
                      {isSaving ? 'Retrying...' : 'Retry Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit for Approval */}
      {canSubmitForApproval() ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-green-900">✅ Ready for Approval</h3>
              <p className="text-sm text-green-700">
                All items have been processed and verified in the database. You can now submit this request for approval.
              </p>
            </div>
            <button
              onClick={onSubmitForApproval}
              disabled={isSubmitting || uploadingFile !== null || Object.values(savingItems).some(Boolean)}
              className="bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {isSubmitting ? 'Validating & Submitting...' : 
               uploadingFile ? 'Uploading files...' : 
               Object.values(savingItems).some(Boolean) ? 'Items still saving...' :
               'Submit for Approval'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-yellow-900">Processing Required</h3>
              <div className="text-sm text-yellow-700 space-y-1">
                {getVerificationProgress().verifiedCount < items.length && (
                  <p>
                    {items.length - getVerificationProgress().verifiedCount} item(s) need to be processed and verified in database before submission.
                  </p>
                )}
                {Object.values(savingItems).some(Boolean) && (
                  <p>Please wait for all items to finish saving and verification.</p>
                )}
                {uploadingFile && (
                  <p>Please wait for file upload to complete.</p>
                )}
              </div>
            </div>
            <button
              disabled
              className="bg-gray-400 text-white py-3 px-6 rounded-md font-medium cursor-not-allowed opacity-50"
            >
              Submit for Approval
            </button>
          </div>
        </div>
      )}
    </div>
  )
}