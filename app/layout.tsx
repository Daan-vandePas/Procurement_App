import type { Metadata } from 'next'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import './globals.css'

export const metadata: Metadata = {
  title: 'Procurement App',
  description: 'Digital procurement request system for engineering teams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthenticatedLayout>
          {children}
        </AuthenticatedLayout>
      </body>
    </html>
  )
}