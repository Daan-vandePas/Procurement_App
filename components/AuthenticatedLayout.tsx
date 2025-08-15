'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/lib/types'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Public routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        
        // If user is logged in and on login page, redirect to appropriate page
        if (pathname === '/login') {
          router.push(getRedirectPath(userData.role))
          return
        }
      } else {
        // Not authenticated
        setUser(null)
        
        // If not on a public route, redirect to login
        if (!isPublicRoute) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
          return
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
      
      if (!isPublicRoute) {
        router.push('/login')
        return
      }
    }
    
    setLoading(false)
  }

  const getRedirectPath = (role: string): string => {
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.push('/login?message=logged-out')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const getNavigationItems = () => {
    if (!user) return []

    // Simplified navigation - same for all users
    return [
      { href: '/', label: 'New Request' },
      { href: '/requests', label: 'All Requests' }
    ]
  }

  // Show loading spinner for non-public routes
  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // For public routes (like login), show minimal layout
  if (isPublicRoute || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    )
  }

  // Authenticated layout with navigation
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href={getRedirectPath(user.role)} className="text-2xl font-semibold text-gray-900 hover:text-gray-700">
              Procurement System
            </Link>
            
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-4">
                {getNavigationItems().map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium ${
                      pathname === item.href
                        ? 'text-blue-600 bg-blue-50 rounded-md'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              
              <div className="flex items-center space-x-3 border-l pl-4">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-gray-500 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}