'use client'

import RequestForm from '@/components/RequestForm'
import { Request } from '@/lib/types'

export default function HomePage() {
  const handleSubmit = async (request: Request) => {
    try {
      console.log('🌐 HomePage: Submitting request to API:', {
        id: request.id,
        requesterName: request.requesterName,
        status: request.status
      })
      
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      console.log('🌐 HomePage: API response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ HomePage: API error:', error)
        throw new Error(error.error || 'Failed to submit request')
      }

      const savedRequest = await response.json()
      console.log('✅ HomePage: Request saved successfully:', savedRequest.id)
      return savedRequest
    } catch (error) {
      console.error('❌ HomePage: Submission error:', error)
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          New Request
        </h2>
        <p className="text-gray-600">
          Submit a new procurement request for materials and tools.
        </p>
      </div>
      
      <RequestForm onSubmit={handleSubmit} />
    </div>
  )
}