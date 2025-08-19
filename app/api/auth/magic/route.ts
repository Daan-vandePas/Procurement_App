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
    console.error('❌ Email configuration is incomplete - cannot send magic link')
    throw new Error('Email configuration is incomplete')
  }
  
  console.log('📧 Preparing to send magic link email:', {
    to: email,
    recipientOverride: emailConfig.testingOverride,
    role: role,
    environment: process.env.NODE_ENV || 'unknown'
  })
  
  // Use testing email override if configured
  const recipientEmail = emailConfig.testingOverride || email
  
  // Create robust nodemailer transporter with production-optimized settings
  const transporterConfig = {
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.port === 465, // true for SSL port 465, false for 587 and others
    pool: true, // Enable connection pooling for better performance
    maxConnections: 3, // Maximum number of simultaneous connections
    maxMessages: 100, // Maximum messages per connection before reconnect
    rateLimit: 10, // Limit to 10 messages per second
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
    // Extended timeouts for better reliability in production
    connectionTimeout: 15000, // 15 seconds connection timeout
    greetingTimeout: 10000, // 10 seconds greeting timeout  
    socketTimeout: 45000, // 45 seconds socket timeout
    // Additional security and reliability settings
    requireTLS: true, // Require TLS connection
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false // Allow self-signed certificates if needed
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug logs in development
    logger: process.env.NODE_ENV === 'development' // Enable detailed logging in development
  }
  
  console.log('📧 Creating transporter with config:', {
    host: transporterConfig.host,
    port: transporterConfig.port,
    secure: transporterConfig.secure,
    user: transporterConfig.auth.user,
    hasPassword: !!transporterConfig.auth.pass
  })
  
  const transporter = nodemailer.createTransport(transporterConfig)

  // Optimized compact HTML template
  const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5}
.card{background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
.header{background:#1e40af;color:white;padding:20px;text-align:center}
.content{padding:30px}.button{display:inline-block;background:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold}
.footer{padding:20px;background:#f8f9fa;font-size:12px;color:#666;text-align:center}</style>
</head><body><div class="card"><div class="header"><h1 style="margin:0">Procurement System</h1><p style="margin:5px 0 0">Sign In Request</p></div>
<div class="content"><p>Hello! Click the button below to sign in as <strong>${role}</strong>:</p>
<p style="text-align:center;margin:25px 0"><a href="${magicLink}" class="button">Sign In</a></p>
<p style="background:#fff3cd;padding:10px;border-radius:4px;font-size:14px"><strong>⚠️ Link expires in 15 minutes</strong></p>
<p style="font-size:12px;color:#666">If the button doesn't work: <a href="${magicLink}">${magicLink}</a></p>
</div><div class="footer">Procurement System - Do not reply to this email</div></div></body></html>`

  const mailOptions = {
    from: `"Procurement System" <${emailConfig.from}>`,
    to: recipientEmail,
    subject: 'Sign in to Procurement System',
    html: htmlContent,
    text: `Sign in to Procurement System\n\nHello! Click this link to sign in as ${role}:\n${magicLink}\n\n⚠️ Link expires in 15 minutes\n\nProcurement System - Do not reply`,
    priority: 'high' as const, // Higher priority for faster delivery
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high'
    }
  }

  // Send the email with enhanced error handling
  try {
    console.log('📧 Attempting to send email...')
    const result = await transporter.sendMail(mailOptions)
    
    console.log('✅ Email sent successfully:', {
      messageId: result.messageId,
      response: result.response?.substring(0, 100) || 'No response details',
      recipientEmail: recipientEmail
    })
    
    // Log successful send (for debugging)
    if (emailConfig.testingOverride && emailConfig.testingOverride !== email) {
      console.log(`📧 Email redirected: ${email} → ${emailConfig.testingOverride}`)
    }
    
    return result
  } catch (emailError: any) {
    console.error('❌ Failed to send email:', {
      error: emailError?.message || 'Unknown error',
      code: emailError?.code || 'NO_CODE',
      command: emailError?.command || 'NO_COMMAND',
      response: emailError?.response || 'NO_RESPONSE',
      responseCode: emailError?.responseCode || 'NO_RESPONSE_CODE',
      smtp: `${emailConfig.host}:${emailConfig.port}`,
      user: emailConfig.user
    })
    
    // Re-throw with more context for better debugging
    throw new Error(`Email sending failed: ${emailError?.message || 'Unknown error'} (${emailError?.code || 'NO_CODE'})`)
  }
}