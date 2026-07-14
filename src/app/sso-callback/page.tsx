'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-merqt-bg flex items-center justify-center">
      <p className="text-sm text-merqt-text-muted">Signing you in...</p>
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
