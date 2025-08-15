'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Request, User } from '@/lib/types'

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user info first
        const userResponse = await fetch('/api/auth/me')
        if (!userResponse.ok) {
          throw new Error('Authentication required')
        }
        const userData = await userResponse.json()
        setUser(userData)

        // Get filtered requests based on user role
        const requestsResponse = await fetch('/api/requests')
        if (!requestsResponse.ok) {
          throw new Error('Failed to fetch requests')
        }
        const requestsData = await requestsResponse.json()
        setRequests(requestsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true
    return request.status === filter
  })

  const getStatusCounts = () => {
    return {
      all: requests.length,
      requested: requests.filter(r => r.status === 'requested').length,
      waiting_for_approval: requests.filter(r => r.status === 'waiting_for_approval').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    }
  }

  const statusCounts = getStatusCounts()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            All Requests
          </h2>
          <p className="text-gray-600">Loading procurement requests...</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            All Requests
          </h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading requests</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getPageTitle = () => {
    if (!user) return 'All Requests'
    
    switch (user.role) {
      case 'requester':
        return 'My Requests'
      case 'purchaser':
        return 'All Requests'
      case 'ceo':
        return 'All Requests'
      default:
        return 'All Requests'
    }
  }

  const getPageDescription = () => {
    if (!user) return 'View and manage procurement requests'
    
    switch (user.role) {
      case 'requester':
        return 'View and manage your procurement requests'
      case 'purchaser':
        return 'Review and process procurement requests from all requesters'
      case 'ceo':
        return 'Review and approve procurement requests'
      default:
        return 'View and manage procurement requests'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {getPageTitle()}
          </h2>
          <p className="text-gray-600">
            {getPageDescription()}
          </p>
        </div>
        <Link
          href="/"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          New Request
        </Link>
      </div>

      {/* Status Filter Tabs for Purchasers and CEOs */}
      {(user?.role === 'purchaser' || user?.role === 'ceo') && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setFilter('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All ({statusCounts.all})
              </button>
              <button
                onClick={() => setFilter('requested')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'requested'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                New Requests ({statusCounts.requested})
              </button>
              <button
                onClick={() => setFilter('waiting_for_approval')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'waiting_for_approval'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending Approval ({statusCounts.waiting_for_approval})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'approved'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Approved ({statusCounts.approved})
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === 'rejected'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Rejected ({statusCounts.rejected})
              </button>
            </nav>
          </div>
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {user?.role === 'requester' 
                ? 'No requests yet' 
                : filter === 'all' 
                  ? 'No requests' 
                  : `No ${filter.replace('_', ' ')} requests`}
            </h3>
            <p className="text-gray-600 mb-4">
              {user?.role === 'requester'
                ? 'Get started by creating your first procurement request.'
                : filter === 'all' 
                  ? 'No procurement requests have been submitted yet.' 
                  : `No requests with "${filter.replace('_', ' ')}" status.`}
            </p>
            {user?.role === 'requester' && (
              <Link
                href="/"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create First Request
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Justification/Project
                  </th>
                  {(user?.role === 'purchaser' || user?.role === 'ceo') && (
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Requester
                    </th>
                  )}
                  {(user?.role === 'purchaser' || user?.role === 'ceo') && (
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Items
                    </th>
                  )}
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  // Get the first item's justification as the project/justification summary
                  const projectJustification = request.items.length > 0 
                    ? request.items[0].justification 
                    : 'No justification provided'
                  
                  // Calculate total estimated cost for purchasers/CEOs
                  const totalCost = request.items.reduce((sum, item) => {
                    const cost = typeof item.estimatedCost === 'number' ? item.estimatedCost : 0
                    return sum + cost
                  }, 0)
                  
                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.id}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        <div className="max-w-xs" style={{whiteSpace: 'normal', wordWrap: 'break-word'}}>
                          {projectJustification}
                        </div>
                      </td>
                      {(user?.role === 'purchaser' || user?.role === 'ceo') && (
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="truncate" title={request.requesterName}>
                            {request.requesterName.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            @{request.requesterName.split('@')[1]}
                          </div>
                        </td>
                      )}
                      {(user?.role === 'purchaser' || user?.role === 'ceo') && (
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {request.items.length} item{request.items.length !== 1 ? 's' : ''}
                            {totalCost > 0 && (
                              <div className="text-xs text-gray-500">
                                ~€{totalCost.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)} min-w-20`} style={{whiteSpace: 'pre-line', textAlign: 'center'}}>
                          {request.status === 'waiting_for_approval' 
                            ? 'Waiting for\nApproval'
                            : request.status.replace('_', ' ').split(' ').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ')
                          }
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(request.requestDate)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/requests/${request.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {(user?.role === 'purchaser' || user?.role === 'ceo') && 
                           (request.status === 'requested' || request.status === 'waiting_for_approval') 
                            ? 'Process Request' 
                            : 'View Details'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}