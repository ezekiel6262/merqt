'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PREMIUM_PRICE_NAIRA, PREMIUM_MAX_BUSINESSES } from '@/lib/premium'

export default function PremiumSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-merqt-bg" />}>
      <PremiumSettingsInner />
    </Suspense>
  )
}

function PremiumSettingsInner() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const verifyReference = searchParams.get('verify')

  const [loading, setLoading] = useState(true)
  const [premiumStatus, setPremiumStatus] = useState('none')
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [businessCount, setBusinessCount] = useState(0)
  const [verifying, setVerifying] = useState(!!verifyReference)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!user) return
    const userId = await ensureUserRow(supabase, user)
    const { data } = await supabase
      .from('users').select('premium_status, premium_current_period_end').eq('id', userId).single()
    setPremiumStatus(data?.premium_status ?? 'none')
    setPeriodEnd(data?.premium_current_period_end ?? null)
    const { count } = await supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    setBusinessCount(count ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  useEffect(() => {
    async function verify() {
      if (!verifyReference || !user) return
      try {
        const res = await fetch('/api/premium/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: verifyReference }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not verify payment')
        await load()
        router.replace('/settings/premium')
      } catch (err: any) {
        setError(err.message ?? 'Could not verify payment')
      } finally {
        setVerifying(false)
      }
    }
    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyReference, user])

  async function subscribe() {
    setSubscribing(true)
    setError('')
    try {
      const res = await fetch('/api/premium/subscribe', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not start subscription')
      window.location.href = data.authorizationUrl
    } catch (err: any) {
      setError(err.message ?? 'Could not start subscription')
      setSubscribing(false)
    }
  }

  async function cancel() {
    setCancelling(true)
    setError('')
    try {
      const res = await fetch('/api/premium/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not cancel subscription')
      setShowCancelConfirm(false)
      await load()
    } catch (err: any) {
      setError(err.message ?? 'Could not cancel subscription')
    } finally {
      setCancelling(false)
    }
  }

  if (loading || verifying) {
    return <div className="min-h-screen bg-merqt-bg" />
  }

  const isActive = premiumStatus === 'active'

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Merqt Premium</h1>
        <p className="text-sm text-merqt-text-muted mb-6">Launch up to {PREMIUM_MAX_BUSINESSES} businesses from one profile.</p>

        <Card className="p-5">
          {isActive ? (
            <>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wide text-merqt-success-dark bg-merqt-success-soft px-2.5 py-1 rounded">
                  Active
                </span>
                {periodEnd && (
                  <span className="text-xs text-merqt-text-muted">
                    Renews {new Date(periodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <p className="text-sm text-merqt-text-muted mb-4">
                You&apos;re using {businessCount} of {PREMIUM_MAX_BUSINESSES} business profiles.
              </p>
              {error && <p className="text-sm text-merqt-ochre-dark mb-3">{error}</p>}
              {!showCancelConfirm ? (
                <Button variant="ghost" onClick={() => setShowCancelConfirm(true)}>Cancel subscription</Button>
              ) : (
                <div className="border border-merqt-border rounded p-3.5">
                  <p className="text-sm mb-3">
                    You&apos;ll lose the ability to launch more than 1 business once this cancels
                    (any extra businesses you already have stay - you just can&apos;t add more).
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setShowCancelConfirm(false)}>Keep premium</Button>
                    <Button variant="danger" className="flex-1" disabled={cancelling} onClick={cancel}>
                      {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-3xl font-serif font-semibold text-merqt-text mb-1">
                ₦{PREMIUM_PRICE_NAIRA.toLocaleString()}
                <span className="text-sm font-sans text-merqt-text-muted font-normal">/month</span>
              </p>
              <ul className="text-sm text-merqt-text-muted space-y-1.5 my-4 list-disc pl-4">
                <li>Launch up to {PREMIUM_MAX_BUSINESSES} businesses from one profile</li>
                <li>More perks (priority placement, analytics) coming soon</li>
              </ul>
              {error && <p className="text-sm text-merqt-ochre-dark mb-3">{error}</p>}
              <Button variant="primary" className="w-full" disabled={subscribing} onClick={subscribe}>
                {subscribing ? 'Redirecting...' : 'Upgrade to Premium'}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
