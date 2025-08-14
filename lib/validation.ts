import { RequestItem, FormErrors } from './types'

export const validateItemName = (value: string): string | undefined => {
  if (!value.trim()) {
    return 'Item name is required'
  }
  if (value.length < 2) {
    return 'Item name must be at least 2 characters'
  }
  return undefined
}

export const validateQuantity = (value: number | ''): string | undefined => {
  if (value === '' || value === null || value === undefined) {
    return 'Quantity is required'
  }
  const num = Number(value)
  if (isNaN(num) || num <= 0) {
    return 'Quantity must be a positive number'
  }
  return undefined
}

export const validateJustification = (value: string): string | undefined => {
  if (!value.trim()) {
    return 'Justification is required'
  }
  if (value.length < 10) {
    return 'Please provide a detailed justification (at least 10 characters)'
  }
  return undefined
}

export const validateSupplierReference = (value: string): string | undefined => {
  if (value && value.trim()) {
    // Basic URL validation if it looks like a URL
    if (value.includes('http') && !isValidUrl(value)) {
      return 'Please enter a valid URL or reference'
    }
  }
  return undefined
}

export const validateEstimatedCost = (value: number | ''): string | undefined => {
  if (value !== '' && value !== null && value !== undefined) {
    const num = Number(value)
    if (isNaN(num) || num < 0) {
      return 'Cost must be a positive number'
    }
  }
  return undefined
}

export const validatePriority = (value: string): string | undefined => {
  if (!value || !['urgent', 'medium', 'low'].includes(value)) {
    return 'Priority is required'
  }
  return undefined
}

export const validateNeededByDate = (value: string): string | undefined => {
  if (value && value.trim()) {
    const date = new Date(value)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (isNaN(date.getTime())) {
      return 'Please enter a valid date'
    }
    if (date < today) {
      return 'Needed by date cannot be in the past'
    }
  }
  return undefined
}

export const validateItem = (item: RequestItem): FormErrors[string] => {
  return {
    itemName: validateItemName(item.itemName),
    quantity: validateQuantity(item.quantity),
    justification: validateJustification(item.justification),
    supplierReference: validateSupplierReference(item.supplierReference),
    estimatedCost: validateEstimatedCost(item.estimatedCost),
    priority: validatePriority(item.priority as string),
    neededByDate: validateNeededByDate(item.neededByDate),
  }
}

export const validateAllItems = (items: RequestItem[]): FormErrors => {
  const errors: FormErrors = {}
  
  items.forEach(item => {
    const itemErrors = validateItem(item)
    const hasErrors = Object.values(itemErrors).some(error => error !== undefined)
    if (hasErrors) {
      errors[item.id] = itemErrors
    }
  })
  
  return errors
}

export const hasValidationErrors = (errors: FormErrors): boolean => {
  return Object.keys(errors).length > 0
}

// Utility function for URL validation
const isValidUrl = (string: string): boolean => {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}