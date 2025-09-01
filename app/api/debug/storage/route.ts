import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Debug environment variables (without exposing sensitive data)
    const hasKvUrl = !!process.env.KV_REST_API_URL
    const hasKvToken = !!process.env.KV_REST_API_TOKEN
    const kvUrlLength = process.env.KV_REST_API_URL?.length || 0
    const kvTokenLength = process.env.KV_REST_API_TOKEN?.length || 0
    const isPlaceholderUrl = process.env.KV_REST_API_URL?.includes('your-current-kv-url') || false
    const isPlaceholderToken = process.env.KV_REST_API_TOKEN?.includes('your-current-kv-token') || false
    
    // Test KV connection if credentials look valid
    let kvTestResult = 'Not tested'
    if (hasKvUrl && hasKvToken && !isPlaceholderUrl && !isPlaceholderToken) {
      try {
        const { kv } = await import('@vercel/kv')
        await kv.set('debug_test_key', 'test_value', { ex: 10 })
        const retrievedValue = await kv.get('debug_test_key')
        await kv.del('debug_test_key')
        kvTestResult = retrievedValue === 'test_value' ? 'SUCCESS' : 'FAILED - value mismatch'
      } catch (error) {
        kvTestResult = `FAILED - ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    } else {
      kvTestResult = 'SKIPPED - invalid credentials'
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: process.platform,
      kvCredentials: {
        hasUrl: hasKvUrl,
        hasToken: hasKvToken,
        urlLength: kvUrlLength,
        tokenLength: kvTokenLength,
        isPlaceholderUrl,
        isPlaceholderToken,
        credentialsValid: hasKvUrl && hasKvToken && !isPlaceholderUrl && !isPlaceholderToken
      },
      kvConnectionTest: kvTestResult,
      storageStrategy: hasKvUrl && hasKvToken && !isPlaceholderUrl && !isPlaceholderToken 
        ? (kvTestResult === 'SUCCESS' ? 'Vercel KV' : 'File Storage (KV failed)')
        : 'File Storage (No valid KV credentials)'
    }

    return NextResponse.json(debugInfo)
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug endpoint failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}