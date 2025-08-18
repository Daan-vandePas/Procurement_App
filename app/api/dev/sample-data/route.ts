import { NextResponse } from 'next/server'
import { createSampleRequests } from '@/lib/sampleData'

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Sample data creation only available in development' },
      { status: 403 }
    )
  }

  try {
    await createSampleRequests()
    
    return NextResponse.json({
      message: 'Sample requests created successfully',
      count: 5,
      statuses: ['draft', 'requested', 'waiting_for_approval', 'approved', 'rejected']
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create sample data' },
      { status: 500 }
    )
  }
}

// Allow GET request for easy browser access in development
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Sample data creation only available in development' },
      { status: 403 }
    )
  }

  try {
    await createSampleRequests()
    
    return NextResponse.json({
      message: 'Sample requests created successfully',
      count: 5,
      statuses: ['draft', 'requested', 'waiting_for_approval', 'approved', 'rejected'],
      note: 'You can now visit /requests to see the sample data'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create sample data' },
      { status: 500 }
    )
  }
}