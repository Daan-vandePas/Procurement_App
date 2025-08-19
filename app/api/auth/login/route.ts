import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleFromEmail, isAuthorizedEmail, generateSessionToken, createUserFromEmail, createSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if email is authorized to access the platform
    if (!isAuthorizedEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: 'This email is not authorized to access the procurement system. Please contact your administrator.' },
        { status: 403 }
      )
    }

    // Get user role and create user object
    const userRole = getUserRoleFromEmail(trimmedEmail)
    const user = createUserFromEmail(trimmedEmail)
    
    if (!user || !userRole) {
      return NextResponse.json(
        { error: 'Unable to determine user role' },
        { status: 403 }
      )
    }

    // Generate session token and create response
    const sessionToken = generateSessionToken(user)
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        email: user.email,
        role: user.role,
        name: user.name
      }
    })

    // Set session cookie
    response.headers.set('Set-Cookie', createSessionCookie(sessionToken))
    
    console.log(`✅ User logged in successfully: ${trimmedEmail} (Role: ${userRole})`)

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}