'use client'

import RequestForm from '@/components/RequestForm'
import { Request } from '@/lib/types'

export default function HomePage() {
  const handleSubmit = async (request: Request) => {
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit request')
      }

      const savedRequest = await response.json()
      return savedRequest
    } catch (error) {
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