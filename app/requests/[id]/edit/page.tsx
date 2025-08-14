'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import RequestForm from '@/components/RequestForm'
import { Request } from '@/lib/types'

export default function EditRequestPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        
        // Check if request can be edited
        if (data.status !== 'requested') {
          setError('This request cannot be edited because it has already been processed.')
          return
        }
        
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

  const handleUpdate = async (updatedRequest: Request): Promise<Request> => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRequest),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update request')
      }

      const savedRequest = await response.json()
      
      // Redirect back to request details after successful update
      setTimeout(() => {
        router.push(`/requests/${requestId}`)
      }, 2000)
      
      return savedRequest
    } catch (error) {
      console.error('Error updating request:', error)
      throw error
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
          <h2 className="text-xl font-semibold text-gray-900">Edit Request</h2>
          <Link
            href={`/requests/${requestId}`}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Request
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Cannot edit request</h3>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Edit Request</h2>
          <p className="text-gray-600">Request ID: {request.id}</p>
        </div>
        <Link
          href={`/requests/${requestId}`}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* Pre-populate the form with existing request data */}
      <RequestForm 
        onSubmit={handleUpdate}
        initialData={request}
        isEditing={true}
      />
    </div>
  )
}