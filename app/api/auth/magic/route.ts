import { NextRequest, NextResponse } from 'next/server'
import { generateMagicLink, getUserRoleFromEmail, isAuthorizedEmail, getEmailConfig } from '@/lib/auth'
import nodemailer from 'nodemailer'

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

    // Send magic link via email
    try {
      await sendMagicLinkEmail(trimmedEmail, magicLink, userRole || 'user')
      
      console.log(`✅ Magic link sent successfully to ${trimmedEmail} (Role: ${userRole})`)
      
      return NextResponse.json({
        message: 'Magic link sent successfully',
        // Include email in response for development purposes
        ...(process.env.NODE_ENV === 'development' && {
          email: trimmedEmail,
          role: userRole
        })
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      
      // Fallback: log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Magic Link for', trimmedEmail, '(Role:', userRole + ') [EMAIL FAILED]:')
        console.log(magicLink)
        console.log('---')
        
        return NextResponse.json({
          message: 'Magic link generated (email failed, check console)',
          email: trimmedEmail,
          role: userRole,
          magicLink: magicLink
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to send magic link email' },
        { status: 500 }
      )
    }

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

async function sendMagicLinkEmail(email: string, magicLink: string, role: string) {
  const emailConfig = getEmailConfig()
  
  if (!emailConfig) {
    throw new Error('Email configuration is incomplete')
  }
  
  // Use testing email override if configured
  const recipientEmail = emailConfig.testingOverride || email
  
  // Create nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  })

  // Email HTML template
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to Procurement System</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Procurement System</h1>
        <p>Secure Sign-In Request</p>
      </div>
      
      <div class="content">
        <h2>Hello!</h2>
        <p>You requested to sign in to the Procurement System with role: <strong>${role}</strong></p>
        
        <p>Click the button below to securely sign in to your account:</p>
        
        <p style="text-align: center;">
          <a href="${magicLink}" class="button">Sign In to Procurement System</a>
        </p>
        
        <div class="warning">
          <strong>⚠️ Security Notice:</strong>
          <ul>
            <li>This link will expire in <strong>15 minutes</strong></li>
            <li>Only use this link if you requested access</li>
            <li>Never share this link with others</li>
          </ul>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace;">
          ${magicLink}
        </p>
        
        <p>If you didn't request this sign-in link, please ignore this email. Your account remains secure.</p>
      </div>
      
      <div class="footer">
        <p>This email was sent by the Procurement System. Do not reply to this email.</p>
        <p>For support, contact your system administrator.</p>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: `"Procurement System" <${emailConfig.from}>`,
    to: recipientEmail,
    subject: 'Sign in to Procurement System',
    html: htmlContent,
    text: `
      Sign in to Procurement System
      
      Hello!
      
      You requested to sign in to the Procurement System with role: ${role}
      
      Click the link below to securely sign in to your account:
      ${magicLink}
      
      Security Notice:
      - This link will expire in 15 minutes
      - Only use this link if you requested access
      - Never share this link with others
      
      If you didn't request this sign-in link, please ignore this email.
      
      This email was sent by the Procurement System.
    `
  }

  // Send the email
  const result = await transporter.sendMail(mailOptions)
  
  // Log successful send (for debugging)
  if (emailConfig.testingOverride && emailConfig.testingOverride !== email) {
    console.log(`📧 Email redirected: ${email} → ${emailConfig.testingOverride}`)
  }
  
  return result
}