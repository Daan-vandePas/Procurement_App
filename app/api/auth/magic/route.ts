import { NextRequest, NextResponse } from 'next/server'
import { generateMagicLink, getUserRoleFromEmail, isAuthorizedEmail } from '@/lib/auth'

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

    // Generate magic link
    const magicLink = generateMagicLink(trimmedEmail)
    const userRole = getUserRoleFromEmail(trimmedEmail)

    // In development, log the magic link to console
    // In production, you would send this via email
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Magic Link for', trimmedEmail, '(Role:', userRole + '):')
      console.log(magicLink)
      console.log('---')
    }

    // TODO: In production, replace this with actual email sending
    // Example:
    // await sendMagicLinkEmail(trimmedEmail, magicLink, userRole)

    return NextResponse.json({
      message: 'Magic link sent successfully',
      // Include email in response for development purposes
      ...(process.env.NODE_ENV === 'development' && {
        email: trimmedEmail,
        role: userRole,
        magicLink: magicLink
      })
    })

  } catch (error) {
    console.error('Magic link generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate magic link' },
      { status: 500 }
    )
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Future email sending function
async function sendMagicLinkEmail(email: string, magicLink: string, role: string) {
  // This would use nodemailer or your preferred email service
  // Example implementation:
  /*
  const nodemailer = require('nodemailer')
  
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Sign in to Procurement System',
    html: `
      <h1>Sign in to Procurement System</h1>
      <p>Hello,</p>
      <p>Click the link below to sign in to your account (${role}):</p>
      <a href="${magicLink}">Sign In</a>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  }

  await transporter.sendMail(mailOptions)
  */
}