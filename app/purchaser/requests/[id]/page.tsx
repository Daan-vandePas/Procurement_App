'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Request, RequestItem, Priority } from '@/lib/types'

interface PurchaserItemData {
  supplierName: string
  supplierReference: string
  estimatedCost: number | ''
  attachments?: File[]
}

export default function PurchaserRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Editable fields for each item
  const [itemUpdates, setItemUpdates] = useState<{ [itemId: string]: PurchaserItemData }>({})

  useEffect(() => {
    const fetchRequest = async () => {
      try {
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

        // Initialize editable fields with current data
        const initialUpdates: { [itemId: string]: PurchaserItemData } = {}
        data.items.forEach((item: RequestItem) => {
          initialUpdates[item.id] = {
            supplierName: item.supplierName || '',
            supplierReference: item.supplierReference || '',
            estimatedCost: item.estimatedCost || '',
            attachments: []
          }
        })
        setItemUpdates(initialUpdates)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load request')
      } finally {
        setLoading(false)
      }
    }

    if (requestId) {
      fetchRequest()
    }
  }, [requestId])

  const updateItemField = (itemId: string, field: keyof PurchaserItemData, value: any) => {
    setItemUpdates(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
  }

  const handleFileUpload = (itemId: string, files: FileList | null) => {
    if (!files) return
    
    const fileArray = Array.from(files)
    // Filter for PDF and image files
    const validFiles = fileArray.filter(file => {
      const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/')
      const isValidSize = file.size <= 10 * 1024 * 1024 // 10MB limit
      return isValidType && isValidSize
    })

    updateItemField(itemId, 'attachments', validFiles)
  }

  const saveChanges = async () => {
    if (!request) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // Update request items with purchaser data
      const updatedItems = request.items.map(item => ({
        ...item,
        supplierName: itemUpdates[item.id]?.supplierName || item.supplierName,
        supplierReference: itemUpdates[item.id]?.supplierReference || item.supplierReference,
        estimatedCost: itemUpdates[item.id]?.estimatedCost || item.estimatedCost
      }))

      const updatedRequest = {
        ...request,
        items: updatedItems
      }

      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRequest),
      })

      if (!response.ok) {
        throw new Error('Failed to update request')
      }

      const savedRequest = await response.json()
      setRequest(savedRequest)
      setSaveSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const sendForApproval = async () => {
    if (!request) return

    const confirmed = confirm(
      'Are you sure you want to send this request for approval? You won\'t be able to make further changes.'
    )
    
    if (!confirmed) return

    setIsSaving(true)
    
    try {
      const updatedRequest = {
        ...request,
        status: 'waiting_for_approval' as const,
        items: request.items.map(item => ({
          ...item,
          supplierName: itemUpdates[item.id]?.supplierName || item.supplierName,
          supplierReference: itemUpdates[item.id]?.supplierReference || item.supplierReference,
          estimatedCost: itemUpdates[item.id]?.estimatedCost || item.estimatedCost
        }))
      }

      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRequest),
      })

      if (!response.ok) {
        throw new Error('Failed to send for approval')
      }

      // Redirect back to purchaser portal
      router.push('/purchaser')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for approval')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-blue-100 text-blue-800'
      case 'waiting_for_approval':
        return 'bg-yellow-100 text-yellow-800'
      case 'approval_completed':
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
          <h2 className="text-xl font-semibold text-gray-900">Process Request</h2>
          <Link
            href="/purchaser"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Portal
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

  if (!request) return null

  const canEdit = request.status === 'requested' || request.status === 'waiting_for_approval'
  const totalEstimatedCost = request.items.reduce((sum, item, index) => {
    const itemId = item.id
    const cost = itemUpdates[itemId]?.estimatedCost || item.estimatedCost
    const numericCost = typeof cost === 'number' ? cost : (parseFloat(cost.toString()) || 0)
    return sum + numericCost
  }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Process Request</h2>
          <p className="text-gray-600">Request ID: {request.id}</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/purchaser"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Portal
          </Link>
          {canEdit && (
            <>
              <button
                onClick={saveChanges}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={sendForApproval}
                disabled={isSaving}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Send for Approval
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-green-800">Changes saved successfully!</p>
            </div>
          </div>
        </div>
      )}

      {/* Request Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
            <p className="mt-1 text-sm text-gray-900">{formatDate(request.requestDate)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Est. Cost</h3>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              €{totalEstimatedCost.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Items Processing */}
      <div className="space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Process Items</h3>
        
        {request.items.map((item, index) => {
          const itemUpdatesData = itemUpdates[item.id] || {
            supplierName: item.supplierName || '',
            supplierReference: item.supplierReference || '',
            estimatedCost: item.estimatedCost || '',
            attachments: []
          }

          return (
            <div key={item.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-2">
                    Item {index + 1}: {item.itemName}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Qty: {item.quantity}</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority as string)}`}>
                      {item.priority}
                    </span>
                    {item.neededByDate && (
                      <span>Needed by: {new Date(item.neededByDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Original Request Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Original Request</h5>
                <p className="text-sm text-gray-600">{item.justification}</p>
                {item.supplierName && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Original Supplier:</span> {item.supplierName}
                  </p>
                )}
              </div>

              {/* Editable Purchaser Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Supplier Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={itemUpdatesData.supplierName}
                    onChange={(e) => updateItemField(item.id, 'supplierName', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Enter supplier name"
                  />
                </div>

                {/* Supplier Reference/Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Reference/Link
                  </label>
                  <input
                    type="text"
                    value={itemUpdatesData.supplierReference}
                    onChange={(e) => updateItemField(item.id, 'supplierReference', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Part number, URL, or reference"
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Cost (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemUpdatesData.estimatedCost}
                    onChange={(e) => updateItemField(item.id, 'estimatedCost', e.target.value ? Number(e.target.value) : '')}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="0.00"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Documentation (PDF/Images)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={(e) => handleFileUpload(item.id, e.target.files)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    PDF or image files, max 10MB each
                  </p>
                  
                  {/* Show selected files */}
                  {itemUpdatesData.attachments && itemUpdatesData.attachments.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700">Selected files:</p>
                      <ul className="text-xs text-gray-600">
                        {itemUpdatesData.attachments.map((file, idx) => (
                          <li key={idx}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Status Info */}
      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                This request has been {request.status === 'approval_completed' ? 'approved' : 'rejected'} and cannot be modified.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}