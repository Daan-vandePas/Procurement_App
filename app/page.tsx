'use client'

import RequestForm from '@/components/RequestForm'
import { Request } from '@/lib/types'

export default function HomePage() {
  const handleSubmit = (request: Request) => {
    // Store request in memory (for now)
    console.log('Request submitted:', request)
    // TODO: Send to API endpoint
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