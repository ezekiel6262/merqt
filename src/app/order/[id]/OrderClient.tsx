'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StepDots } from '@/components/ui/StepDots'

const STEP_LABELS = ['Delivery', 'Payment', 'Summary', 'Done']

export function OrderClient({
  product,
  seller,
  offerId,
  verifyReference,
  verifyOrderId,
}: {
  product: any
  seller: any
  offerId?: string
  verifyReference?: string
  verifyOrderId?: string
}) {
  const { user, isSignedIn } = useUser()
  const supabase = useSupabaseClient()

  const [step, setStep] = useState(verifyReference ? 3 : 0)
  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState<'platform' | 'direct'>('direct')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  const [verifyingPayment, setVerifyingPayment] = useState(!!verifyReference)
  const [paymentVerified, setPaymentVerified] = useState(false)
  const [paymentVerifyError, setPaymentVerifyError] = useState('')

  useEffect(() => {
    async function verify() {
      if (!verifyReference || !verifyOrderId || !user) return
      try {
        const res = await fetch('/api/payments/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: verifyOrderId, reference: verifyReference }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Payment could not be verified')
        setPaymentVerified(true)
      } catch (err: any) {
        setPaymentVerifyError(err.message ?? 'Payment could not be verified')
      } finally {
        setVerifyingPayment(false)
        setStep(3)
      }
    }
    verify()
  }, [verifyReference, verifyOrderId, user])

  const [isOwnListing, setIsOwnListing] = useState(false)

  useEffect(() => {
    async function checkOwnership() {
      if (!user) return
      const { data: userRow } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
      if (userRow && userRow.id === seller.user_id) setIsOwnListing(true)
    }
    checkOwnership()
  }, [user])

  const [offer, setOffer] = useState<any>(null)
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [offerSending, setOfferSending] = useState(false)
  const [offerSent, setOfferSent] = useState(false)
  const [offerError, setOfferError] = useState('')

  useEffect(() => {
    async function loadOffer() {
      if (!offerId || !user) return
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .eq('status', 'accepted')
        .eq('product_id', product.id)
        .single()
      if (data) setOffer(data)
    }
    loadOffer()
  }, [offerId, user])

  async function sendOffer() {
    if (!user) return
    const amount = parseFloat(offerAmount)
    if (!amount || amount <= 0) return
    setOfferSending(true)
    setOfferError('')
    try {
      const buyerId = await ensureUserRow(supabase, user)
      const { error: offerErr } = await supabase.from('offers').insert({
        product_id: product.id,
        buyer_id: buyerId,
        seller_id: seller.id,
        amount,
        message: offerMessage.trim() || null,
      })
      if (offerErr) throw offerErr
      setOfferSent(true)
    } catch (err: any) {
      setOfferError(err.message ?? 'Something went wrong')
    } finally {
      setOfferSending(false)
    }
  }

  const isService = product.type === 'service'
  const negotiatedTotal = offer ? Number(offer.amount) : null
  const total = negotiatedTotal ?? product.price * quantity

  async function placeOrder() {
    if (!user) return
    setPlacing(true)
    setError('')

    try {
      const buyerId = await ensureUserRow(supabase, user)

      const { data: newOrder, error: oErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: buyerId,
          seller_id: seller.id,
          product_id: product.id,
          quantity: negotiatedTotal ? 1 : quantity,
          total_amount: total,
          payment_method: payment,
          payment_status: 'pending',
          status: 'pending',
          delivery_address: address || null,
          delivery_city: city || null,
          note: note || null,
          offer_id: offer?.id ?? null,
        })
        .select('id')
        .single()
      if (oErr) throw oErr

      if (offer) {
        await supabase.from('offers').update({ resulting_order_id: newOrder.id }).eq('id', offer.id)
      }

      if (payment === 'platform') {
        const res = await fetch('/api/payments/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: newOrder.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not start payment')
        window.location.href = data.authorizationUrl
        return
      }

      setStep(3)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setPlacing(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-merqt-bg flex items-center justify-center px-4">
        <Card className="p-6 max-w-sm text-center">
          <p className="text-sm text-merqt-text-muted mb-4">Please sign in to place an order.</p>
          <a href="/login"><Button variant="primary">Sign in</Button></a>
        </Card>
      </div>
    )
  }

  if (isOwnListing) {
    return (
      <div className="min-h-screen bg-merqt-bg flex items-center justify-center px-4">
        <Card className="p-6 max-w-sm text-center">
          <p className="text-sm text-merqt-text-muted mb-4">This is your own listing - you can&apos;t order or make an offer on it.</p>
          <a href="/dashboard"><Button variant="primary">Go to dashboard</Button></a>
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
                {product.images?.[0] && (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{product.name}</p>
                <p className="text-sm text-merqt-text-muted">{seller.business_name}</p>
                {negotiatedTotal ? (
                  <p className="font-mono text-sm font-semibold text-merqt-indigo">
                    {formatNaira(negotiatedTotal)} <span className="text-merqt-text-muted font-sans font-normal">(negotiated price)</span>
                  </p>
                ) : (
                  <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(product.price)}</p>
                )}
              </div>
            </div>

            {product.negotiable && !offer && (
              <div className="border border-merqt-border rounded p-3 mb-5">
                {offerSent ? (
                  <p className="text-sm text-merqt-success-dark">
                    Offer sent - {seller.business_name} will respond soon. Track it in your Activity page.
                  </p>
                ) : showOfferForm ? (
                  <>
                    <label className="block text-xs text-merqt-text-muted mb-1.5">Your offer</label>
                    <input
                      type="number"
                      className="w-full border border-merqt-border rounded px-3 py-2 text-sm mb-2 outline-none focus:border-merqt-indigo"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="Proposed price"
                    />
                    <textarea
                      className="w-full border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo mb-2"
                      rows={2}
                      value={offerMessage}
                      onChange={(e) => setOfferMessage(e.target.value)}
                      placeholder="Note to seller (optional)"
                    />
                    {offerError && <p className="text-xs text-merqt-ochre-dark mb-2">{offerError}</p>}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowOfferForm(false)}>Cancel</Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        disabled={offerSending || !offerAmount}
                        onClick={sendOffer}
                      >
                        {offerSending ? 'Sending...' : 'Send offer'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setShowOfferForm(true)} className="text-sm font-semibold text-merqt-indigo">
                    Propose a different price
                  </button>
                )}
              </div>
            )}

            {!isService && !negotiatedTotal && (
              <>
                <label className="block text-xs text-merqt-text-muted mb-1.5">Quantity</label>
                <div className="flex items-center gap-3 mb-5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 border border-merqt-border rounded text-base bg-merqt-bg">−</button>
                  <span className="font-mono text-sm w-6 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 border border-merqt-border rounded text-base bg-merqt-bg">+</button>
                </div>
              </>
            )}

            <label className="block text-xs text-merqt-text-muted mb-1.5">Delivery address</label>
            <input className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm mb-2.5 outline-none focus:border-merqt-indigo"
              value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address" />
            <input className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm mb-2.5 outline-none focus:border-merqt-indigo"
              value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="City" />
            <textarea className="w-full border border-merqt-border rounded px-3 py-2.5 text-sm resize-none outline-none focus:border-merqt-indigo mb-5"
              rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Note to seller (optional)" />

            <Button variant="primary" size="lg" className="w-full" onClick={() => setStep(1)}>Continue</Button>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-5">
            <div className="text-[15px] font-semibold mb-4">Payment method</div>
            <button onClick={() => setPayment('platform')}
              className={`w-full text-left p-3.5 rounded-card border-[1.5px] mb-2.5 ${payment === 'platform' ? 'border-merqt-indigo bg-merqt-indigo-soft' : 'border-merqt-border bg-merqt-surface'}`}>
              <p className="text-sm font-semibold mb-0.5">Escrow through Merqt</p>
              <p className="text-xs text-merqt-text-muted">Merqt holds payment until you confirm delivery.</p>
            </button>
            <button onClick={() => setPayment('direct')}
              className={`w-full text-left p-3.5 rounded-card border-[1.5px] ${payment === 'direct' ? 'border-merqt-indigo bg-merqt-indigo-soft' : 'border-merqt-border bg-merqt-surface'}`}>
              <p className="text-sm font-semibold mb-0.5">Direct to seller</p>
              <p className="text-xs text-merqt-text-muted">Pay the seller directly, outside Merqt.</p>
            </button>
            <div className="flex gap-2.5 mt-5">
              <Button variant="ghost" size="lg" onClick={() => setStep(0)}>Back</Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(2)}>Continue</Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-5">
            <div className="text-[15px] font-semibold mb-4">Order summary</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] mb-5">
              <div className="flex justify-between"><span className="text-merqt-text-muted">Item</span><span>{product.name} × {quantity}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Delivery to</span><span className="max-w-[260px] text-right">{address || 'Not provided'}{city ? `, ${city}` : ''}</span></div>
              <div className="flex justify-between"><span className="text-merqt-text-muted">Payment</span><span>{payment === 'platform' ? 'Escrow through Merqt' : 'Direct to seller'}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-merqt-text-muted">Escrow status</span>
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded ${payment === 'platform' ? 'bg-merqt-success-soft text-merqt-success-dark' : 'bg-merqt-bg border border-merqt-border text-merqt-text-muted'}`}>
                  {payment === 'platform' ? 'Funds will be held in escrow' : 'Not escrowed'}
                </span>
              </div>
              <div className="flex justify-between border-t border-merqt-border pt-2.5 font-semibold">
                <span>Total</span><span className="font-mono">{formatNaira(total)}</span>
              </div>
            </div>
            {error && <p className="text-sm text-merqt-ochre-dark mb-2.5">{error}</p>}
            <div className="flex gap-2.5">
              <Button variant="ghost" size="lg" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" size="lg" className="flex-1" disabled={placing} onClick={placeOrder}>
                {placing
                  ? payment === 'platform' ? 'Redirecting to payment...' : 'Placing order...'
                  : payment === 'platform' ? 'Continue to payment' : 'Place order'}
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-7 text-center">
            {verifyingPayment ? (
              <>
                <div className="text-[17px] font-semibold mb-1.5">Confirming your payment...</div>
                <p className="text-[13.5px] text-merqt-text-muted">This only takes a moment.</p>
              </>
            ) : verifyReference && !paymentVerified ? (
              <>
                <div className="w-12 h-12 rounded-full bg-merqt-ochre-soft text-merqt-ochre-dark flex items-center justify-center text-xl mx-auto mb-4">!</div>
                <div className="text-[17px] font-semibold mb-1.5">We couldn&apos;t confirm your payment</div>
                <div className="text-[13.5px] text-merqt-text-muted mb-5">
                  {paymentVerifyError || 'If money left your account, contact support - your order is still saved as pending payment.'}
                </div>
                <a href="/activity"><Button variant="primary" size="lg">Go to Activity</Button></a>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-merqt-success-soft text-merqt-success-dark flex items-center justify-center text-xl mx-auto mb-4">✓</div>
                <div className="text-[17px] font-semibold mb-1.5">
                  {paymentVerified ? 'Payment confirmed' : 'Order placed'}
                </div>
                <div className="text-[13.5px] text-merqt-text-muted mb-5">
                  {paymentVerified
                    ? `Merqt is holding your payment in escrow. It'll be released to ${seller.business_name} once you confirm you've received your order.`
                    : `${seller.business_name} has received your order and will be in touch.`}
                </div>
                <a href="/activity"><Button variant="primary" size="lg">Track in Activity</Button></a>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
