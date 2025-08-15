export type Priority = 'urgent' | 'medium' | 'low'

export type RequestStatus = 'draft' | 'requested' | 'waiting_for_approval' | 'approved' | 'rejected'

export type UserRole = 'requester' | 'purchaser' | 'ceo'

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
}

export interface MagicLinkPayload {
  email: string
  type: 'magic-link'
  exp: number
}

export interface RequestItem {
  id: string
  itemName: string
  quantity: number | ''
  justification: string
  supplierName: string
  supplierReference: string
  estimatedCost: number | ''
  priority: Priority | ''
  neededByDate: string
}

export interface Request {
  id: string
  requesterName: string
  requestDate: string
  items: RequestItem[]
  status: RequestStatus
}

export interface FormErrors {
  [itemId: string]: {
    itemName?: string
    quantity?: string
    justification?: string
    supplierName?: string
    supplierReference?: string
    estimatedCost?: string
    priority?: string
    neededByDate?: string
  }
}