'use client'

import { useState, useCallback, useEffect } from 'react'
import { RequestItem, FormErrors, Priority, Request, User } from '@/lib/types'
import { validateAllItems, hasValidationErrors, validateItem } from '@/lib/validation'

interface RequestFormProps {
  onSubmit?: (request: Request) => Promise<Request>
  initialData?: Request
  isEditing?: boolean
}

const createEmptyItem = (id: string): RequestItem => ({
  id,
  itemName: '',
  quantity: '',
  justification: '',
  supplierName: '',
  supplierReference: '',
  estimatedCost: '',
  priority: '',
  neededByDate: ''
})

export default function RequestForm({ onSubmit, initialData, isEditing = false }: RequestFormProps) {
  const [items, setItems] = useState<RequestItem[]>(
    initialData?.items || [createEmptyItem('item-1')]
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        console.log('🔍 RequestForm: Fetching current user...')
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const user = await response.json()
          console.log('✅ RequestForm: User fetched successfully:', user.email, 'Role:', user.role)
          setCurrentUser(user)
        } else {
          console.error('❌ RequestForm: Failed to fetch user, status:', response.status)
        }
      } catch (error) {
        console.error('❌ RequestForm: Error fetching current user:', error)
      }
    }
    
    fetchCurrentUser()
  }, [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Generate unique ID for new items
  const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const addItem = useCallback(() => {
    const newItem = createEmptyItem(generateItemId())
    setItems(prev => [...prev, newItem])
  }, [])

  const removeItem = useCallback((itemId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== itemId))
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[itemId]
        return newErrors
      })
    }
  }, [items.length])

  const updateItem = useCallback((itemId: string, field: keyof RequestItem, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, [field]: value }
        : item
    ))

    // Clear error for this field when user starts typing
    setErrors(prev => {
      const itemErrors = prev[itemId]
      if (itemErrors && itemErrors[field as keyof FormErrors[string]]) {
        const newItemErrors = { ...itemErrors }
        delete newItemErrors[field as keyof FormErrors[string]]
        
        const hasRemainingErrors = Object.values(newItemErrors).some(error => error !== undefined)
        const newErrors = { ...prev }
        
        if (hasRemainingErrors) {
          newErrors[itemId] = newItemErrors
        } else {
          delete newErrors[itemId]
        }
        
        return newErrors
      }
      return prev
    })
  }, [])

  const validateForm = useCallback(() => {
    const formErrors = validateAllItems(items)
    setErrors(formErrors)
    return !hasValidationErrors(formErrors)
  }, [items])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      console.log('📝 RequestForm: Form submission started')
      console.log('👤 RequestForm: Current user at submit:', currentUser?.email || 'NO USER LOADED')
      
      // Create request object
      const request: Request = {
        id: initialData?.id || `req-${Date.now()}`,
        requesterName: initialData?.requesterName || currentUser?.email || 'Unknown User',
        requestDate: initialData?.requestDate || new Date().toISOString(),
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity) || 0,
          estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : 0,
          priority: item.priority as Priority
        })),
        status: initialData?.status || 'requested'
      }

      console.log('📦 RequestForm: Request object created:', {
        id: request.id,
        requesterName: request.requesterName,
        status: request.status,
        itemCount: request.items.length
      })

      // Submit to API
      if (onSubmit) {
        console.log('🚀 RequestForm: Calling onSubmit...')
        await onSubmit(request)
        console.log('✅ RequestForm: onSubmit completed successfully')
      }
      
      setIsSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isEditing ? 'Request Updated Successfully' : 'Request Submitted Successfully'}
          </h3>
          <p className="text-gray-600 mb-6">
            {isEditing 
              ? 'Your procurement request has been updated successfully.' 
              : 'Your procurement request has been submitted and is now waiting for approval.'
            }
          </p>
          <button
            onClick={() => {
              setIsSubmitted(false)
              setItems([createEmptyItem(generateItemId())])
              setErrors({})
              setSubmitError(null)
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <div className="space-y-8">
        {items.map((item, index) => (
          <div key={item.id} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Item {index + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove Item
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name / Description *
                </label>
                <input
                  type="text"
                  value={item.itemName}
                  onChange={(e) => updateItem(item.id, 'itemName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.itemName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter item name or description"
                />
                {errors[item.id]?.itemName && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].itemName}</p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value ? Number(e.target.value) : '')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.quantity ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors[item.id]?.quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].quantity}</p>
                )}
              </div>

              {/* Justification */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justification / Reason *
                </label>
                <textarea
                  value={item.justification}
                  onChange={(e) => updateItem(item.id, 'justification', e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.justification ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Explain why this item is needed"
                />
                {errors[item.id]?.justification && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].justification}</p>
                )}
              </div>

              {/* Supplier Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={item.supplierName}
                  onChange={(e) => updateItem(item.id, 'supplierName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier name"
                />
              </div>

              {/* Supplier Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Reference / Link
                </label>
                <input
                  type="text"
                  value={item.supplierReference}
                  onChange={(e) => updateItem(item.id, 'supplierReference', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.supplierReference ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Part number, URL, or reference"
                />
                {errors[item.id]?.supplierReference && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].supplierReference}</p>
                )}
              </div>

              {/* Estimated Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.estimatedCost}
                    onChange={(e) => updateItem(item.id, 'estimatedCost', e.target.value ? Number(e.target.value) : '')}
                    className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors[item.id]?.estimatedCost ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors[item.id]?.estimatedCost && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].estimatedCost}</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority *
                </label>
                <select
                  value={item.priority}
                  onChange={(e) => updateItem(item.id, 'priority', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.priority ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                {errors[item.id]?.priority && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].priority}</p>
                )}
              </div>

              {/* Needed By Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Needed By Date
                </label>
                <input
                  type="date"
                  value={item.neededByDate}
                  onChange={(e) => updateItem(item.id, 'neededByDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[item.id]?.neededByDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors[item.id]?.neededByDate && (
                  <p className="mt-1 text-sm text-red-600">{errors[item.id].neededByDate}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add Item Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addItem}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 transition-colors border border-gray-300"
          >
            + Add Item
          </button>
        </div>

        {/* Error Display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </form>
  )
}