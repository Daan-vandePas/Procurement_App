import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicLink, createUserFromEmail, generateSessionToken, createSessionCookie, getRedirectPathForRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing-token', request.url))
    }

    // Verify the magic link token
    const verificationResult = verifyMagicLink(token)
    
    if (!verificationResult) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', request.url))
    }

    const { email } = verificationResult

    // Create user object
    const user = createUserFromEmail(email)
    
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized-email', request.url))
    }

    // Generate session token
    const sessionToken = generateSessionToken(user)

    // Create response with redirect to appropriate page based on role
    const redirectPath = getRedirectPathForRole(user.role)
    const response = NextResponse.redirect(new URL(redirectPath, request.url))

    // Set session cookie
    response.headers.set('Set-Cookie', createSessionCookie(sessionToken))

    return response

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/login?error=auth-failed', request.url))
  }
}

// Handle POST for API calls (optional, for programmatic authentication)
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify the magic link token
    const verificationResult = verifyMagicLink(token)
    
    if (!verificationResult) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const { email } = verificationResult

    // Create user object
    const user = createUserFromEmail(email)
    
    if (!user) {
      return NextResponse.json(
        { error: 'This email is not authorized to access the procurement system.' },
        { status: 403 }
      )
    }

    // Generate session token
    const sessionToken = generateSessionToken(user)

    // Create response
    const response = NextResponse.json({
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      redirectTo: getRedirectPathForRole(user.role)
    })

    // Set session cookie
    response.headers.set('Set-Cookie', createSessionCookie(sessionToken))

    return response

  } catch (error) {
    console.error('Callback POST error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}