'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

// Product flow: pending > confirmed > dispatched > delivered
const PRODUCT_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'dispatched',
  dispatched: 'delivered',
}
const PRODUCT_LABEL: Record<string, string> = {
  pending: 'Confirm order',
  confirmed: 'Mark dispatched',
  dispatched: 'Mark delivered',
}

// Service flow: pending > accepted > in_progress > completed
const SERVICE_FLOW: Record<string, string> = {
  pending: 'accepted',
  accepted: 'in_progress',
  in_progress: 'completed',
}
const SERVICE_LABEL: Record<string, string> = {
  pending: 'Accept request',
  accepted: 'Mark in progress',
  in_progress: 'Mark completed',
}

export default function SellerOrdersPage() {
  const { user } = useUser()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'products' | 'services'>('all')

  async function loadOrders() {
    if (!user) return
    const supabase = createClient()

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()
    if (!userRow) { setLoading(false); return }

    const { data: sellerRow } = await supabase
      .from('sellers').select('id').eq('user_id', userRow.id).single()
    if (!sellerRow) { setLoading(false); return }

    const { data: orderRows } = await supabase
      .from('orders')
      .select('*, product:products(name, type), buyer:users(name, email)')
      .eq('seller_id', sellerRow.id)
      .order('created_at', { ascending: false })

    setOrders(orderRows ?? [])
    setLoading(false)
  }

  useEffect(() => { loadOrders() }, [user])

  async function advanceStatus(order: any) {
    const flow = order.is_service ? SERVICE_FLOW : PRODUCT_FLOW
    const next = flow[order.status]
    if (!next) return
    const supabase = createClient()
    const updates: any = { status: next }
    if (next === 'delivered' || next === 'completed') {
      updates.delivered_at = new Date().toISOString()
    }
    await supabase.from('orders').update(updates).eq('id', order.id)
    loadOrders()
  }

  const filtered = orders.filter((o) => {
    if (filter === 'products') return !o.is_service
    if (filter === 'services') return o.is_service
    return true
  })

  if (loading) return <div className="p-10 text-li-text-2">Loading...</div>

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-2">

        <div className="bg-white border border-li-border rounded-card p-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Incoming orders and requests</h1>
          <Link href="/dashboard" className="text-sm text-li-blue">Back to dashboard</Link>
        </div>

        {/* Filter tabs */}
        <div className="bg-white border border-li-border rounded-card p-1 flex gap-1">
          {(['all', 'products', 'services'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={'flex-1 py-2 rounded text-sm font-semibold capitalize ' +
                (filter === f ? 'bg-li-blue text-white' : 'text-li-text-2')}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white border border-li-border rounded-card p-8 text-center">
            <p className="text-sm text-li-text-2">Nothing here yet. Orders and requests will appear as buyers send them.</p>
          </div>
        )}

        {filtered.map((o) => (
          <div key={o.id} className="bg-white border border-li-border rounded-card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={'text-xs px-2 py-0.5 rounded-xl font-semibold ' +
                    (o.is_service ? 'bg-li-blue-bg text-li-blue' : 'bg-li-green-bg text-li-green')}>
                    {o.is_service ? 'Service request' : 'Product order'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-xl bg-li-page text-li-text-2 capitalize">
                    {o.status}
                  </span>
                </div>
                <p className="font-semibold text-sm">{o.product?.name}</p>
                <p className="text-xs text-li-text-2">
                  From {o.buyer?.name || o.buyer?.email || 'a buyer'}
                </p>
              </div>
              <p className="text-sm font-semibold text-li-blue">{formatNGN(o.total_amount)}</p>
            </div>

            {/* Service request details */}
            {o.is_service && (
              <div className="bg-li-page rounded p-3 text-sm space-y-1 mb-3">
                {o.request_description && (
                  <p><span className="text-li-text-2">Needs:</span> {o.request_description}</p>
                )}
                {o.preferred_date && (
                  <p><span className="text-li-text-2">When:</span> {o.preferred_date}</p>
                )}
                {o.delivery_address && (
                  <p><span className="text-li-text-2">Where:</span> {o.delivery_address}</p>
                )}
                {o.budget && (
                  <p><span className="text-li-text-2">Budget:</span> {formatNGN(o.budget)}</p>
                )}
              </div>
            )}

            {/* Product order details */}
            {!o.is_service && (
              <div className="bg-li-page rounded p-3 text-sm space-y-1 mb-3">
                <p><span className="text-li-text-2">Quantity:</span> {o.quantity}</p>
                {o.delivery_address && (
                  <p><span className="text-li-text-2">Deliver to:</span> {o.delivery_address}{o.delivery_city ? ', ' + o.delivery_city : ''}</p>
                )}
                <p><span className="text-li-text-2">Payment:</span> {o.payment_method === 'platform' ? 'Through Merqt' : 'Direct to you'}</p>
              </div>
            )}

            {/* Action button */}
            {o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled' && (
              <button onClick={() => advanceStatus(o)}
                className="w-full py-2 rounded-pill bg-li-blue text-white font-semibold text-sm">
                {(o.is_service ? SERVICE_LABEL : PRODUCT_LABEL)[o.status] || 'Update'}
              </button>
            )}
            {(o.status === 'delivered' || o.status === 'completed') && (
              <p className="text-center text-sm text-li-green font-semibold">
                {o.is_service ? 'Completed' : 'Delivered'}
              </p>
            )}
          </div>
        ))}

      </div>
    </div>
  )
}