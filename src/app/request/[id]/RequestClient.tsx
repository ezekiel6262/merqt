'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

export function RequestClient({ service, seller }: { service: any; seller: any }) {
  const { user, isSignedIn } = useUser()

  const [description, setDescription] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function sendRequest() {
    if (!user) return
    setSending(true)
    setError('')

    try {
      const supabase = createClient()

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

      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-li-page flex items-center justify-center px-4">
        <div className="bg-white border border-li-border rounded-card p-6 max-w-sm text-center">
          <p className="text-sm text-li-text-2 mb-4">Please sign in to request a service.</p>
          <a href="/login" className="px-4 py-2 rounded-pill bg-li-blue text-white font-semibold text-sm inline-block">
            Sign in
          </a>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-li-page flex items-center justify-center px-4">
        <div className="bg-white border border-li-border rounded-card p-6 max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-li-green-bg flex items-center justify-center mx-auto mb-3">
            <span className="text-li-green text-2xl">done</span>
          </div>
          <h1 className="text-lg font-semibold mb-1">Request sent</h1>
          <p className="text-sm text-li-text-2 mb-4">
            {seller.business_name} has received your request and will respond to arrange the details with you.
          </p>
          <a href={'/@' + seller.slug} className="px-4 py-2 rounded-pill border-2 border-li-blue text-li-blue font-semibold text-sm inline-block">
            Back to profile
          </a>
        </div>
      </div>
    )
  }

  const canSend = description.trim().length >= 10

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-lg mx-auto space-y-2">

        <div className="bg-white border border-li-border rounded-card p-4">
          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded bg-li-page flex-shrink-0 overflow-hidden">
              {service.images && service.images[0] && (
                <img src={service.images[0]} alt={service.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-li-blue font-semibold uppercase">Service request</p>
              <p className="font-semibold text-sm">{service.name}</p>
              <p className="text-sm text-li-text-2">{seller.business_name}</p>
              {service.price > 0 && (
                <p className="text-sm font-semibold text-li-blue">from {formatNGN(service.price)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-li-border rounded-card p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">What do you need?</label>
            <textarea className="w-full border border-li-border rounded px-3 py-2 text-sm resize-none"
              rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you need. The more detail, the better the seller can help." />
            <p className="text-xs text-li-text-3 mt-1">At least 10 characters</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Preferred date or timeframe <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
              value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
              placeholder="e.g. This Saturday, or next week" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Location <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
              value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Where should the service happen?" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Your budget <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
              value={budget} onChange={(e) => setBudget(e.target.value)}
              placeholder="Naira amount you have in mind" type="number" />
          </div>
        </div>

        <div className="bg-white border border-li-border rounded-card p-4">
          {error && <p className="text-sm text-li-red mb-2">{error}</p>}
          <button onClick={sendRequest} disabled={!canSend || sending}
            className={'w-full py-2.5 rounded-pill font-semibold text-sm text-white ' + (canSend && !sending ? 'bg-li-blue' : 'bg-gray-300')}>
            {sending ? 'Sending request...' : 'Send request'}
          </button>
          <p className="text-xs text-li-text-3 text-center mt-2">
            This starts a conversation. The seller will respond to arrange details and price.
          </p>
        </div>

      </div>
    </div>
  )
}