'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, UserRole } from '@/lib/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  fallback?: React.ReactNode
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  fallback = <div>Loading...</div>
}: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        
        // Check role requirements
        if (requiredRole && !hasRequiredRole(userData, requiredRole)) {
          router.push(getRedirectPath(userData.role))
          return
        }
      } else {
        // Not authenticated, redirect to login
        const currentPath = window.location.pathname
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
        return
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
      return
    }
    
    setLoading(false)
  }

  const hasRequiredRole = (user: User, requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      'requester': 1,
      'purchaser': 2,
      'ceo': 3
    }
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
  }

  const getRedirectPath = (role: UserRole): string => {
    switch (role) {
      case 'ceo':
        return '/requests'
      case 'purchaser':
        return '/purchaser'
      case 'requester':
      default:
        return '/'
    }
  }

  if (loading) {
    return <>{fallback}</>
  }

  return <>{children}</>
}