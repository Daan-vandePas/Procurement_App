'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Request, RequestItem, Priority } from '@/lib/types'

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const canEdit = request.status === 'requested'

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
          {canEdit && (
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

      {/* Request Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Requester</h3>
            <p className="mt-1 text-sm text-gray-900">{request.requesterName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
              {request.status.replace('_', ' ')}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date Submitted</h3>
            <p className="mt-1 text-sm text-gray-900">{formatDate(request.requestDate)}</p>
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
                  
                  {item.estimatedCost > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-500">Estimated Cost</h5>
                      <p className="mt-1 text-sm text-gray-900">€{item.estimatedCost}</p>
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
              </div>
            ))}
          </div>
        </div>
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
                This request cannot be edited or deleted because it has already been processed beyond the "requested" status.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}