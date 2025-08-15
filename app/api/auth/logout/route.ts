import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Create response with redirect to login page
    const response = NextResponse.json({
      message: 'Logged out successfully'
    })

    // Clear session cookie
    response.headers.set('Set-Cookie', clearSessionCookie())

    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}

// Handle GET for direct logout links
export async function GET(request: NextRequest) {
  try {
    // Create response with redirect to login page
    const response = NextResponse.redirect(new URL('/login?message=logged-out', request.url))

    // Clear session cookie
    response.headers.set('Set-Cookie', clearSessionCookie())

    return response

  } catch (error) {
    console.error('Logout GET error:', error)
    return NextResponse.redirect(new URL('/login?error=logout-failed', request.url))
  }
}