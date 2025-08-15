import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, hasRole, getRedirectPathForRole } from './auth'
import { UserRole } from './types'

export interface AuthMiddlewareOptions {
  requiredRole?: UserRole
  redirectOnSuccess?: boolean
  publicRoutes?: string[]
}

export function withAuth(
  handler: (request: NextRequest, user: any) => Promise<NextResponse> | NextResponse,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { requiredRole, redirectOnSuccess = false, publicRoutes = [] } = options
    const { pathname } = request.nextUrl
    
    // Check if this is a public route
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      return handler(request, null)
    }
    
    // Get user from session
    const user = getUserFromRequest(request)
    
    // If no user and route requires auth, redirect to login
    if (!user && requiredRole) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // If user exists but doesn't have required role, redirect appropriately
    if (user && requiredRole && !hasRole(user, requiredRole)) {
      const redirectPath = getRedirectPathForRole(user.role)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
    
    // If user is logged in and we should redirect on success (e.g., login page)
    if (user && redirectOnSuccess) {
      const redirectPath = getRedirectPathForRole(user.role)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
    
    return handler(request, user)
  }
}

export function createProtectedRoute(requiredRole?: UserRole) {
  return (handler: (request: NextRequest, user: any) => Promise<NextResponse> | NextResponse) => {
    return withAuth(handler, { requiredRole })
  }
}

export function createPublicRoute(handler: (request: NextRequest) => Promise<NextResponse> | NextResponse) {
  return withAuth(async (request) => handler(request), {})
}