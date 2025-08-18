export type Priority = 'urgent' | 'medium' | 'low'

export type RequestStatus = 'draft' | 'requested' | 'waiting_for_approval' | 'approval_completed' | 'rejected'

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

export type ItemStatus = 'pending' | 'priced' | 'rejected'
export type ItemApprovalStatus = 'pending_approval' | 'approved' | 'rejected'
export type CostProofType = 'pdf' | 'image' | 'link'

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
  
  // Purchaser workflow fields
  actualCost?: number
  costProof?: string
  costProofType?: CostProofType
  rejectionReason?: string
  itemStatus?: ItemStatus
  
  // CEO approval workflow fields
  approvalStatus?: ItemApprovalStatus
  ceoRejectionReason?: string
  approvedBy?: string
  approvedDate?: string
}

export interface Request {
  id: string
  requesterName: string
  requestDate: string
  items: RequestItem[]
  status: RequestStatus
  
  // Purchaser workflow fields
  processedBy?: string
  processedDate?: string
  
  // CEO approval workflow fields
  approvalCompletedBy?: string
  approvalCompletedDate?: string
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
    actualCost?: string
    costProof?: string
    rejectionReason?: string
    ceoRejectionReason?: string
  }
}

export interface ItemProcessingData {
  actualCost?: number
  costProof?: string
  costProofType?: CostProofType
  rejectionReason?: string
  itemStatus: ItemStatus
  supplierName?: string
  supplierReference?: string
}

export interface ProcessingUpdate {
  itemId: string
  data: ItemProcessingData
}

export interface ItemApprovalData {
  approvalStatus: ItemApprovalStatus
  ceoRejectionReason?: string
  approvedBy?: string
  approvedDate?: string
}

export interface ApprovalUpdate {
  itemId: string
  data: ItemApprovalData
}