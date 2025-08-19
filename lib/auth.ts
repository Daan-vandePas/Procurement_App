import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { UserRole, User, MagicLinkPayload } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || 'fallback-magic-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const MAGIC_LINK_EXPIRES_IN = process.env.MAGIC_LINK_EXPIRES_IN || '15m'

// Email configuration validation
function validateEmailEnvironment(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = ['EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  }
}

export function getEmailConfig() {
  console.log('🔍 Getting email configuration...')
  console.log('🔍 Environment:', process.env.NODE_ENV || 'unknown')
  console.log('🔍 Platform:', process.env.VERCEL ? 'Vercel' : 'Local')
  
  // Log individual environment variables (mask sensitive data)
  console.log('📧 EMAIL_FROM:', process.env.EMAIL_FROM || 'MISSING')
  console.log('📧 SMTP_HOST:', process.env.SMTP_HOST || 'MISSING')
  console.log('📧 SMTP_PORT:', process.env.SMTP_PORT || 'MISSING')
  console.log('📧 SMTP_USER:', process.env.SMTP_USER || 'MISSING')
  console.log('📧 SMTP_PASS:', process.env.SMTP_PASS ? `***SET (${process.env.SMTP_PASS.length} chars)***` : 'MISSING')
  console.log('📧 TESTING_EMAIL_OVERRIDE:', process.env.TESTING_EMAIL_OVERRIDE || 'MISSING')
  
  const validation = validateEmailEnvironment()
  
  if (!validation.isValid) {
    console.error('❌ Email configuration incomplete. Missing variables:', validation.missingVars)
    console.error('❌ Available env vars:', Object.keys(process.env).filter(key => key.includes('EMAIL') || key.includes('SMTP')))
    return null
  }
  
  const portNumber = parseInt(process.env.SMTP_PORT!)
  if (isNaN(portNumber)) {
    console.error('❌ SMTP_PORT is not a valid number:', process.env.SMTP_PORT)
    return null
  }
  
  const config = {
    from: process.env.EMAIL_FROM!,
    host: process.env.SMTP_HOST!,
    port: portNumber,
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    testingOverride: process.env.TESTING_EMAIL_OVERRIDE
  }
  
  // Additional validation for Gmail configuration
  if (config.host === 'smtp.gmail.com') {
    if (config.port !== 465 && config.port !== 587) {
      console.warn('⚠️ Gmail typically uses port 465 (SSL) or 587 (TLS), but configured port is:', config.port)
    }
    if (!config.pass || config.pass.length < 10) {
      console.error('❌ Gmail App Password appears invalid (should be 16 characters)')
      return null
    }
  }
  
  console.log('✅ Email configuration loaded successfully')
  console.log('📧 Config summary:', {
    from: config.from,
    host: config.host,
    port: config.port,
    user: config.user,
    hasPassword: !!config.pass,
    passwordLength: config.pass?.length || 0,
    testingOverride: config.testingOverride,
    isGmail: config.host === 'smtp.gmail.com'
  })
  
  return config
}

export function isAuthorizedEmail(email: string): boolean {
  const ceoEmails = process.env.CEO_EMAILS?.split(',').map(e => e.trim()) || []
  const purchaserEmails = process.env.PURCHASER_EMAILS?.split(',').map(e => e.trim()) || []
  const externalRequesterEmails = process.env.EXTERNAL_REQUESTER_EMAILS?.split(',').map(e => e.trim()) || []
  
  // Check if email is explicitly listed in any role
  if (ceoEmails.includes(email) || purchaserEmails.includes(email) || externalRequesterEmails.includes(email)) {
    return true
  }
  
  // Check if email is from batiamosa.be domain (authorized domain)
  if (email.endsWith('@batiamosa.be')) {
    return true
  }
  
  return false
}

export function getUserRoleFromEmail(email: string): UserRole | null {
  // First check if email is authorized
  if (!isAuthorizedEmail(email)) {
    return null
  }
  
  const ceoEmails = process.env.CEO_EMAILS?.split(',').map(e => e.trim()) || []
  const purchaserEmails = process.env.PURCHASER_EMAILS?.split(',').map(e => e.trim()) || []
  const externalRequesterEmails = process.env.EXTERNAL_REQUESTER_EMAILS?.split(',').map(e => e.trim()) || []
  
  if (ceoEmails.includes(email)) {
    return 'ceo'
  }
  
  if (purchaserEmails.includes(email)) {
    return 'purchaser'
  }
  
  // External requesters or batiamosa.be domain emails default to requester
  if (externalRequesterEmails.includes(email) || email.endsWith('@batiamosa.be')) {
    return 'requester'
  }
  
  return null
}

export function generateMagicLink(email: string): string {
  const payload: MagicLinkPayload = {
    email,
    type: 'magic-link',
    exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
  }
  
  const token = jwt.sign(payload, MAGIC_LINK_SECRET as jwt.Secret)
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  
  return `${baseUrl}/api/auth/callback?token=${token}`
}

export function verifyMagicLink(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, MAGIC_LINK_SECRET as jwt.Secret) as MagicLinkPayload
    
    if (payload.type !== 'magic-link') {
      return null
    }
    
    return { email: payload.email }
  } catch (error) {
    return null
  }
}

export function generateSessionToken(user: User): string {
  const expirationTime = Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    type: 'session',
    exp: expirationTime
  }
  
  return jwt.sign(payload, JWT_SECRET as jwt.Secret)
}

export function verifySessionToken(token: string): User | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET as jwt.Secret) as any
    
    if (payload.type !== 'session') {
      return null
    }
    
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role as UserRole,
      name: payload.name
    }
  } catch (error) {
    return null
  }
}

export function getUserFromRequest(request: NextRequest): User | null {
  const token = request.cookies.get('session-token')?.value
  
  if (!token) {
    return null
  }
  
  return verifySessionToken(token)
}

export function createSessionCookie(token: string): string {
  const maxAge = 8 * 60 * 60 // 8 hours in seconds
  return `session-token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

export function clearSessionCookie(): string {
  return 'session-token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
}

export function hasRole(user: User | null, requiredRole: UserRole): boolean {
  if (!user) return false
  
  const roleHierarchy: Record<UserRole, number> = {
    'requester': 1,
    'purchaser': 2,
    'ceo': 3
  }
  
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}

export function getRedirectPathForRole(role: UserRole): string {
  // All users go to the requests page after login
  return '/requests'
}

export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function createUserFromEmail(email: string): User | null {
  const role = getUserRoleFromEmail(email)
  
  if (!role) {
    return null // Unauthorized email
  }
  
  return {
    id: generateUserId(),
    email,
    role,
    name: email.split('@')[0] // Use email prefix as default name
  }
}