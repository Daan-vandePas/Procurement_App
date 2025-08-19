import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { put } from '@vercel/blob'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed file types
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg', 
  'image/png': 'png',
  'image/gif': 'gif'
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and permissions
    const user = getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only purchasers and CEOs can upload cost proofs
    if (user.role !== 'purchaser' && user.role !== 'ceo') {
      return NextResponse.json(
        { error: 'Insufficient permissions to upload files' },
        { status: 403 }
      )
    }

    const data = await request.formData()
    const file: File | null = data.get('file') as unknown as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, JPG, PNG, GIF' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const filename = `cost-proof-${timestamp}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`

    // Upload to Vercel Blob storage
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    })

    console.log(`✅ File uploaded to Vercel Blob: ${filename} -> ${blob.url}`)

    // Return blob URL
    const fileUrl = blob.url

    return NextResponse.json({
      success: true,
      filename,
      url: fileUrl,
      type: fileExtension,
      size: file.size,
      blobUrl: blob.url
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}