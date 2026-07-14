'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSignIn } from '@clerk/nextjs'
import { AuthShell } from '@/components/shared/AuthShell'
import { GoogleIcon } from '@/components/shared/GoogleIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function clerkErrorMessage(err: any): string {
  return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Something went wrong. Please try again.'
}

export default function LoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    if (!isLoaded) return
    setError('')
    setGoogleLoading(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/discover',
      })
    } catch (err) {
      setError(clerkErrorMessage(err))
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.push('/discover')
      } else {
        setError('Additional verification is needed. Please try again or contact support.')
      }
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell tagline="Sign in to your account">
      <Card className="p-6">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text text-center mb-5">Welcome back</h1>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-merqt-border rounded-[6px] py-2.5 text-sm font-semibold text-merqt-text hover:bg-merqt-bg disabled:opacity-60 transition-colors"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-merqt-border" />
          <span className="text-xs uppercase tracking-wide text-merqt-text-muted">Or</span>
          <div className="flex-1 h-px bg-merqt-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-merqt-ochre-dark">{error}</p>}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-merqt-text-muted mt-5">
          New to Merqt?{' '}
          <Link href="/register" className="font-semibold text-merqt-indigo">Create an account</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
