'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

export default function ActivityPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadActivity() {
    if (!user) return
   

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()
    if (!userRow) { setLoading(false); return }

    const { data: orderRows } = await supabase
      .from('orders')
      .select('*, product:products(name), seller:sellers(business_name, slug), review:reviews(id, rating, body)')
      .eq('buyer_id', userRow.id)
      .order('created_at', { ascending: false })

    setOrders(orderRows ?? [])
    setLoading(false)
  }

  useEffect(() => { loadActivity() }, [user])

  async function submitReview(order: any) {
    if (!user) return
    setSaving(true)
    

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()

    if (!userRow) { setSaving(false); return }

    await supabase.from('reviews').insert({
      order_id: order.id,
      buyer_id: userRow.id,
      seller_id: order.seller_id,
      product_id: order.product_id,
      rating,
      body: body || null,
    })

    setReviewing(null)
    setRating(5)
    setBody('')
    setSaving(false)
    loadActivity()
  }

  if (loading) return <div className="p-10 text-li-text-2">Loading...</div>

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-2">

        <div className="bg-white border border-li-border rounded-card p-4">
          <h1 className="text-lg font-semibold">Activity</h1>
          <p className="text-sm text-li-text-2">Everything you have ordered and requested</p>
        </div>

        {orders.length === 0 && (
          <div className="bg-white border border-li-border rounded-card p-8 text-center">
            <p className="text-sm text-li-text-2">No activity yet. Your orders and requests will show up here.</p>
          </div>
        )}

        {orders.map((o) => {
          const hasReview = !!o.review
          const isDelivered = o.status === 'delivered' || o.status === 'completed'
          return (
            <div key={o.id} className="bg-white border border-li-border rounded-card p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={'text-xs px-2 py-0.5 rounded-xl font-semibold ' +
                      (o.is_service ? 'bg-li-blue-bg text-li-blue' : 'bg-li-green-bg text-li-green')}>
                      {o.is_service ? 'Service request' : 'Product order'}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">{o.product?.name}</p>
                  <p className="text-xs text-li-text-2">{o.seller?.business_name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-xl bg-li-page text-li-text-2 capitalize inline-block mt-1">
                    {o.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-li-blue">{formatNGN(o.total_amount)}</p>
              </div>

              {isDelivered && !hasReview && reviewing !== o.id && (
                <button onClick={() => setReviewing(o.id)}
                  className="w-full py-2 rounded-pill border-2 border-li-blue text-li-blue font-semibold text-sm">
                  Leave a review
                </button>
              )}

              {isDelivered && hasReview && (
                <div className="border-t border-li-border pt-3 mt-2">
                  <p className="text-xs font-semibold text-li-text-2 mb-1">Your review</p>
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className={'text-lg ' +
                        (star <= o.review.rating ? 'text-yellow-400' : 'text-li-border')}>
                        &#9733;
                      </span>
                    ))}
                  </div>
                  {o.review.body && (
                    <p className="text-sm text-li-text-1">{o.review.body}</p>
                  )}
                </div>
              )}

              {reviewing === o.id && (
                <div className="border-t border-li-border pt-3 mt-2 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Your rating</label>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((star) => (
                        <button key={star} onClick={() => setRating(star)}
                          className={'text-2xl ' + (star <= rating ? 'text-yellow-400' : 'text-li-border')}>
                          &#9733;
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Comment (optional)</label>
                    <textarea className="w-full border border-li-border rounded px-3 py-2 text-sm resize-none"
                      rows={2} value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder="How was your experience?" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setReviewing(null)}
                      className="flex-1 py-2 rounded-pill border border-li-border text-li-text-2 font-semibold text-sm">
                      Cancel
                    </button>
                    <button onClick={() => submitReview(o)} disabled={saving}
                      className="flex-1 py-2 rounded-pill bg-li-blue text-white font-semibold text-sm">
                      {saving ? 'Submitting...' : 'Submit review'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

      </div>
    </div>
  )
}