import { Request } from './types'
import { saveRequest } from './storage'

export const sampleRequests: Request[] = [
  {
    id: 'REQ-001',
    requesterName: 'arnaud.kivits@batiamosa.be',
    requestDate: '2025-01-15T08:30:00.000Z',
    status: 'draft',
    items: [
      {
        id: 'item-001-1',
        itemName: 'Industrial Safety Helmets',
        quantity: 25,
        justification: 'New safety equipment for construction site workers - urgent replacement needed',
        supplierName: 'SafetyFirst Equipment',
        supplierReference: 'SF-HELMET-001',
        estimatedCost: 15.50,
        priority: 'urgent',
        neededByDate: '2025-01-25'
      },
      {
        id: 'item-001-2',
        itemName: 'High-Vis Safety Vests',
        quantity: 25,
        justification: 'Matching safety vests for the new helmets',
        supplierName: 'SafetyFirst Equipment',
        supplierReference: 'SF-VEST-002',
        estimatedCost: 8.75,
        priority: 'urgent',
        neededByDate: '2025-01-25'
      }
    ]
  },
  {
    id: 'REQ-002',
    requesterName: 'alexandre.gerard@batiamosa.be',
    requestDate: '2025-01-14T14:15:00.000Z',
    status: 'requested',
    items: [
      {
        id: 'item-002-1',
        itemName: 'Digital Multimeter Fluke 117',
        quantity: 3,
        justification: 'Electrical testing equipment for new electrical installation project',
        supplierName: 'ElectroTools Pro',
        supplierReference: 'FLUKE-117-DMM',
        estimatedCost: 165.00,
        priority: 'medium',
        neededByDate: '2025-02-01'
      },
      {
        id: 'item-002-2',
        itemName: 'Insulated Screwdriver Set',
        quantity: 2,
        justification: 'Safety tools for electrical work',
        supplierName: 'ElectroTools Pro',
        supplierReference: 'WIHA-INSUL-SET',
        estimatedCost: 89.50,
        priority: 'medium',
        neededByDate: '2025-02-01'
      }
    ]
  },
  {
    id: 'REQ-003',
    requesterName: 'eric.jacques@batiamosa.be',
    requestDate: '2025-01-13T10:45:00.000Z',
    status: 'waiting_for_approval',
    items: [
      {
        id: 'item-003-1',
        itemName: 'Industrial Tablet PC',
        quantity: 2,
        justification: 'Mobile computing devices for field inspections and digital documentation',
        supplierName: 'TechSolutions Belgium',
        supplierReference: 'RUGGED-TAB-10',
        estimatedCost: 850.00,
        priority: 'medium',
        neededByDate: '2025-02-15'
      }
    ]
  },
  {
    id: 'REQ-004',
    requesterName: 'marc.potier@batiamosa.be',
    requestDate: '2025-01-12T09:20:00.000Z',
    status: 'approval_completed',
    items: [
      {
        id: 'item-004-1',
        itemName: 'Cordless Drill Set DeWalt',
        quantity: 4,
        justification: 'Replacement tools for workshop - old drills are no longer functional',
        supplierName: 'ToolMaster Distribution',
        supplierReference: 'DEWALT-DCD791-KIT',
        estimatedCost: 145.00,
        priority: 'low',
        neededByDate: '2025-02-28'
      },
      {
        id: 'item-004-2',
        itemName: 'Drill Bit Set Professional',
        quantity: 4,
        justification: 'Matching drill bits for the new cordless drills',
        supplierName: 'ToolMaster Distribution',
        supplierReference: 'BOSCH-BITS-PRO-SET',
        estimatedCost: 32.50,
        priority: 'low',
        neededByDate: '2025-02-28'
      }
    ]
  }
]

export async function createSampleRequests(): Promise<void> {
  console.log('Creating sample requests...')
  
  for (const request of sampleRequests) {
    try {
      await saveRequest(request)
      console.log(`✅ Created sample request: ${request.id} (${request.status})`)
    } catch (error) {
      console.error(`❌ Failed to create request ${request.id}:`, error)
    }
  }
  
  console.log('Sample requests creation completed!')
}