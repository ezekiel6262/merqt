'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StepDots } from '@/components/ui/StepDots'

const STEP_LABELS = ['Details', 'Review', 'Sent']

export function RequestClient({ service, seller }: { service: any; seller: any }) {
  const { user, isSignedIn } = useUser()
  const supabase = useSupabaseClient()

  const [step, setStep] = useState(0)
  const [description, setDescription] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const canSend = description.trim().length >= 10

  async function sendRequest() {
    if (!user) return
    setSending(true)
    setError('')

    try {
      const { data: existingUser } = await supabase
        .from('users').select('id').eq('clerk_id', user.id).single()

      let buyerId = existingUser?.id
      if (!buyerId) {
        const { data: newUser, error: uErr } = await supabase
          .from('users')
          .insert({
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? '',
            name: user.fullName ?? '',
            avatar_url: user.imageUrl ?? '',
            role: 'buyer',
          })
          .select('id').single()
        if (uErr) throw uErr
        buyerId = newUser.id
      }

      const { error: rErr } = await supabase.from('orders').insert({
        buyer_id: buyerId,
        seller_id: seller.id,
        product_id: service.id,
        quantity: 1,
        total_amount: budget ? parseFloat(budget) : service.price,
        payment_method: 'direct',
        payment_status: 'pending',
        status: 'pending',
        is_service: true,
        request_description: description,
        preferred_date: preferredDate || null,
        budget: budget ? parseFloat(budget) : null,
        delivery_address: location || null,
      })
      if (rErr) throw rErr

      setStep(2)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-merqt-bg flex items-center justify-center px-4">
        <Card className="p-6 max-w-sm text-center">
          <p className="text-sm text-merqt-text-muted mb-4">Please sign in to request a service.</p>
          <a href="/login"><Button variant="primary">Sign in</Button></a>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-lg mx-auto">
        <StepDots steps={STEP_LABELS} current={step} />

        {step === 0 && (
          <Card className="p-5">
            <div className="flex gap-3 items-center mb-5">
              <div className="w-16 h-16 rounded bg-merqt-bg flex-shrink-0 overflow-hidden">
                {service.images?.[0] && (
                  <img src={service.images[0]} alt={service.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold mb-0.5">{service.name}</p>
                <p className="text-[12.5px] text-merqt-text-muted">
                  Start a conversation with the seller — this is a request, not a purchase.
                </p>
              </div>
            </div>

            <label className="block text-xs text-merqt-text-muted mb-1.5">What do you need?</label>
            <textarea className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm resize-none outline-none focus:border-merqt-indigo mb-3.5"
              rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you're looking for" />

            <label className="block text-xs text-merqt-text-muted mb-1.5">Preferred date or timeframe</label>
            <input className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo mb-3.5"
              value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
              placeholder="e.g. next weekend" />

            <label className="block text-xs text-merqt-text-muted mb-1.5">Location</label>
            <input className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo mb-3.5"
              value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Where should this happen?" />

            <label className="block text-xs text-merqt-text-muted mb-1.5">Budget (optional)</label>
            <input className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo mb-5"
              value={budget} onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. ₦20,000" type="number" />

            <Button variant="primary" size="lg" className="w-full" disabled={!canSend} onClick={() => setStep(1)}>
              Continue
            </Button>
            {!canSend && <p className="text-xs text-merqt-text-muted text-center mt-2">Describe your need in at least 10 characters</p>}
          </Card>
        )}

        {step === 1 && (
          <Card className="p-5">
            <div className="text-[15px] font-semibold mb-4">Review your request</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] mb-5">
              <div className="flex justify-between"><span className="text-merqt-text-muted">Service</span><span>{service.name}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Details</span><span className="max-w-[260px] text-right">{description}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Timeframe</span><span>{preferredDate || 'Not specified'}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Location</span><span>{location || 'Not specified'}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Budget</span><span>{budget ? formatNaira(Number(budget)) : 'Not specified'}</span></div>
            </div>
            {error && <p className="text-sm text-merqt-ochre-dark mb-2.5">{error}</p>}
            <div className="flex gap-2.5">
              <Button variant="ghost" size="lg" onClick={() => setStep(0)}>Back</Button>
              <Button variant="primary" size="lg" className="flex-1" disabled={sending} onClick={sendRequest}>
                {sending ? 'Sending request...' : 'Send request'}
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-merqt-success-soft text-merqt-success-dark flex items-center justify-center text-xl mx-auto mb-4">✓</div>
            <div className="text-[17px] font-semibold mb-1.5">Request sent</div>
            <div className="text-[13.5px] text-merqt-text-muted mb-5">
              The seller will respond to start the conversation.
            </div>
            <a href="/activity"><Button variant="primary" size="lg">Track in Activity</Button></a>
          </Card>
        )}
      </div>
    </div>
  )
}
