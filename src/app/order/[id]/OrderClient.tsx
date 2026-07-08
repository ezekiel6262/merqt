'use client'


import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

export function OrderClient({ product, seller }: { product: any; seller: any }) {
  const { user, isSignedIn } = useUser()

  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState('direct')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const isService = product.type === 'service'
  const total = product.price * quantity

  async function placeOrder() {
    if (!user) return
    setPlacing(true)
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

      const { error: oErr } = await supabase.from('orders').insert({
        buyer_id: buyerId,
        seller_id: seller.id,
        product_id: product.id,
        quantity,
        total_amount: total,
        payment_method: payment,
        payment_status: 'pending',
        status: 'pending',
      })
      if (oErr) throw oErr

      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setPlacing(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-li-page flex items-center justify-center px-4">
        <div className="bg-white border border-li-border rounded-card p-6 max-w-sm text-center">
          <p className="text-sm text-li-text-2 mb-4">Please sign in to place an order.</p>
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
          <h1 className="text-lg font-semibold mb-1">Order placed</h1>
          <p className="text-sm text-li-text-2 mb-4">
            {seller.business_name} has received your order and will be in touch.
          </p>
          <a href={'/@' + seller.slug} className="px-4 py-2 rounded-pill border-2 border-li-blue text-li-blue font-semibold text-sm inline-block">
            Back to profile
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-lg mx-auto space-y-2">

        <div className="bg-white border border-li-border rounded-card p-4">
          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded bg-li-page flex-shrink-0 overflow-hidden">
              {product.images && product.images[0] && (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{product.name}</p>
              <p className="text-sm text-li-text-2">{seller.business_name}</p>
              <p className="text-sm font-semibold text-li-blue">{formatNGN(product.price)}</p>
            </div>
          </div>
        </div>

        {!isService && (
          <div className="bg-white border border-li-border rounded-card p-4">
            <label className="block text-sm font-semibold mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 border border-li-border rounded text-lg">-</button>
              <span className="font-semibold w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 border border-li-border rounded text-lg">+</button>
            </div>
          </div>
        )}

        <div className="bg-white border border-li-border rounded-card p-4 space-y-3">
          <label className="block text-sm font-semibold">
            {isService ? 'Where should the service happen?' : 'Delivery address'}
          </label>
          <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
            value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address" />
          <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
            value={city} onChange={(e) => setCity(e.target.value)}
            placeholder="City" />
          <textarea className="w-full border border-li-border rounded px-3 py-2 text-sm resize-none"
            rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note to seller (optional)" />
        </div>

        <div className="bg-white border border-li-border rounded-card p-4 space-y-2">
          <label className="block text-sm font-semibold mb-1">How would you like to pay?</label>
          <button onClick={() => setPayment('platform')}
            className={'w-full text-left p-3 rounded border ' + (payment === 'platform' ? 'border-li-blue bg-li-blue-bg' : 'border-li-border')}>
            <p className="text-sm font-semibold">Pay through Merqt</p>
            <p className="text-xs text-li-text-2">Held securely, released when you confirm delivery.</p>
          </button>
          <button onClick={() => setPayment('direct')}
            className={'w-full text-left p-3 rounded border ' + (payment === 'direct' ? 'border-li-blue bg-li-blue-bg' : 'border-li-border')}>
            <p className="text-sm font-semibold">Pay seller directly</p>
            <p className="text-xs text-li-text-2">Arrange payment with the seller.</p>
          </button>
        </div>

        <div className="bg-white border border-li-border rounded-card p-4">
          <div className="flex justify-between mb-3">
            <span className="text-sm text-li-text-2">Total</span>
            <span className="text-lg font-semibold">{formatNGN(total)}</span>
          </div>
          {error && <p className="text-sm text-li-red mb-2">{error}</p>}
          <button onClick={placeOrder} disabled={placing}
            className={'w-full py-2.5 rounded-pill font-semibold text-sm text-white ' + (placing ? 'bg-gray-300' : 'bg-li-blue')}>
            {placing ? 'Placing order...' : 'Place order'}
          </button>
        </div>

      </div>
    </div>
  )
}