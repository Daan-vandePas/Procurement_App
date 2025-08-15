import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Get user from session token in cookies
    const user = getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Return user information (excluding sensitive data)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    })

  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json(
      { error: 'Failed to get user information' },
      { status: 500 }
    )
  }
}