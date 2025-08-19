'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface SearchParamsHandlerProps {
  onError: (error: string) => void
  onMessage: (message: string) => void
  onRedirectChange: (redirect: string) => void
}

function SearchParamsHandler({ onError, onMessage, onRedirectChange }: SearchParamsHandlerProps) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const redirectTo = searchParams.get('redirect') || '/'
    onRedirectChange(redirectTo)
    
    const urlError = searchParams.get('error')
    const urlMessage = searchParams.get('message')
    
    if (urlError) {
      switch (urlError) {
        case 'unauthorized-email':
          onError('This email is not authorized to access the procurement system. Please contact your administrator.')
          break
        case 'invalid-token':
          onError('Invalid or expired magic link. Please request a new one.')
          break
        case 'missing-token':
          onError('Invalid magic link. Please request a new one.')
          break
        case 'auth-failed':
          onError('Authentication failed. Please try again.')
          break
        default:
          onError('An error occurred. Please try again.')
      }
    }
    if (urlMessage === 'logged-out') {
      onMessage('You have been logged out successfully.')
    }
  }, [searchParams, onError, onMessage, onRedirectChange])
  
  return null
}

function SearchParamsLoader() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [redirectTo, setRedirectTo] = useState('/')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Login successful! Redirecting...')
        setEmail('')
        // Redirect to main application
        setTimeout(() => {
          window.location.href = '/requests'
        }, 1000)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (error) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<SearchParamsLoader />}>
        <SearchParamsHandler 
          onError={setError}
          onMessage={setMessage}
          onRedirectChange={setRedirectTo}
        />
      </Suspense>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Procurement System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your work email address to sign in
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter your work email address"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{message}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Secure, passwordless authentication
            <br />
            For authorized company emails only
          </p>
        </div>
      </div>
    </div>
  )
}