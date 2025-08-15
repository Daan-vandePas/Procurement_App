import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { UserRole, User, MagicLinkPayload } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || 'fallback-magic-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const MAGIC_LINK_EXPIRES_IN = process.env.MAGIC_LINK_EXPIRES_IN || '15m'

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
  
  const token = jwt.sign(payload, MAGIC_LINK_SECRET)
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  
  return `${baseUrl}/api/auth/callback?token=${token}`
}

export function verifyMagicLink(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, MAGIC_LINK_SECRET) as MagicLinkPayload
    
    if (payload.type !== 'magic-link') {
      return null
    }
    
    return { email: payload.email }
  } catch (error) {
    return null
  }
}

export function generateSessionToken(user: User): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    type: 'session'
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifySessionToken(token: string): User | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    
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