'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusPill, TypeTag } from '@/components/ui/StatusPill'

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

const CANCEL_REASONS = ['Out of stock', 'Unable to fulfill', 'Buyer unresponsive', 'Other']

const STUCK_THRESHOLD_MS = 48 * 60 * 60 * 1000

function isTerminal(status: string) {
  return status === 'delivered' || status === 'completed' || status === 'cancelled'
}

export default function SellerOrdersPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'products' | 'services'>('all')
  const [nudges, setNudges] = useState<Record<string, string>>({})

  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [cancelReasonDraft, setCancelReasonDraft] = useState<Record<string, string>>({})
  // Cancellation reason is shown for this session only - the schema has no
  // column to persist it against an order yet.
  const [cancelledReasons, setCancelledReasons] = useState<Record<string, string>>({})

  async function loadOrders() {
    if (!user) return

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
    checkStuckOrders(orderRows ?? [])
  }

  useEffect(() => { loadOrders() }, [user])

  function checkStuckOrders(orderRows: any[]) {
    const now = Date.now()
    orderRows
      .filter((o) => !isTerminal(o.status) && now - new Date(o.status_changed_at).getTime() > STUCK_THRESHOLD_MS)
      .forEach(async (o) => {
        try {
          const res = await fetch('/api/agents/shepherd/stuck-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: o.id }),
          })
          const data = await res.json()
          if (data.stuck && data.note) {
            setNudges((prev) => ({ ...prev, [o.id]: data.note }))
          }
        } catch {
          // no nudge text available - badge alone (computed client-side) still shows
        }
      })
  }

  async function advanceStatus(order: any) {
    const flow = order.is_service ? SERVICE_FLOW : PRODUCT_FLOW
    const next = flow[order.status]
    if (!next) return

    const updates: any = { status: next, status_changed_at: new Date().toISOString() }
    if (next === 'delivered' || next === 'completed') {
      updates.delivered_at = new Date().toISOString()
    }
    await supabase.from('orders').update(updates).eq('id', order.id)
    loadOrders()
  }

  async function confirmCancel(order: any) {
    const reason = cancelReasonDraft[order.id]
    if (!reason) return
    await supabase.from('orders').update({ status: 'cancelled', status_changed_at: new Date().toISOString() }).eq('id', order.id)
    setCancelledReasons((prev) => ({ ...prev, [order.id]: reason }))
    setConfirmingCancelId(null)
    loadOrders()
  }

  const filtered = orders.filter((o) => {
    if (filter === 'products') return !o.is_service
    if (filter === 'services') return o.is_service
    return true
  })

  if (loading) return <div className="p-10 text-merqt-text-muted">Loading...</div>

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <h1 className="font-serif text-2xl font-semibold text-merqt-text">Incoming orders and requests</h1>
          <Link href="/dashboard" className="text-sm text-merqt-indigo font-semibold">Back to dashboard</Link>
        </div>

        {/* Filter tabs */}
        <Card className="p-1 flex gap-1 mb-5">
          {(['all', 'products', 'services'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={'flex-1 py-2 rounded text-sm font-semibold capitalize ' +
                (filter === f ? 'bg-merqt-indigo text-merqt-surface' : 'text-merqt-text-muted')}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </Card>

        {filtered.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">Nothing here yet. Orders and requests will appear as buyers send them.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {filtered.map((o) => {
            const isCancelled = o.status === 'cancelled'
            const cancellable = !isTerminal(o.status)
            const actionLabel = (o.is_service ? SERVICE_LABEL : PRODUCT_LABEL)[o.status]
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <TypeTag label={o.is_service ? 'Service request' : 'Product order'} kind={o.is_service ? 'service' : 'product'} />
                      <StatusPill label={o.status} cancelled={isCancelled} />
                      {!isTerminal(o.status) && Date.now() - new Date(o.status_changed_at).getTime() > STUCK_THRESHOLD_MS && (
                        <span className="text-xs px-2 py-0.5 rounded bg-merqt-ochre-soft text-merqt-ochre-dark font-semibold">
                          Needs attention
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm">{o.product?.name}</p>
                    <p className="text-xs text-merqt-text-muted">
                      From {o.buyer?.name || o.buyer?.email || 'a buyer'}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(o.total_amount)}</p>
                </div>

                {nudges[o.id] && (
                  <p className="text-xs text-merqt-ochre-dark bg-merqt-ochre-soft rounded p-2 mb-2">{nudges[o.id]}</p>
                )}

                {o.dispute_status === 'reported' && (
                  <div className="bg-merqt-ochre-soft border border-merqt-ochre rounded p-2 mb-2">
                    <p className="text-xs text-merqt-ochre-dark font-semibold mb-0.5">Reported by buyer</p>
                    <p className="text-xs text-merqt-ochre-dark">{o.dispute_reason}</p>
                  </div>
                )}

                {/* Service request details */}
                {o.is_service && (
                  <div className="bg-merqt-bg rounded p-3 text-sm space-y-1 mb-3">
                    {o.request_description && (
                      <p><span className="text-merqt-text-muted">Needs:</span> {o.request_description}</p>
                    )}
                    {o.preferred_date && (
                      <p><span className="text-merqt-text-muted">When:</span> {o.preferred_date}</p>
                    )}
                    {o.delivery_address && (
                      <p><span className="text-merqt-text-muted">Where:</span> {o.delivery_address}</p>
                    )}
                    {o.budget && (
                      <p><span className="text-merqt-text-muted">Budget:</span> {formatNaira(o.budget)}</p>
                    )}
                  </div>
                )}

                {/* Product order details */}
                {!o.is_service && (
                  <div className="bg-merqt-bg rounded p-3 text-sm space-y-1 mb-3">
                    <p><span className="text-merqt-text-muted">Quantity:</span> {o.quantity}</p>
                    {o.delivery_address && (
                      <p><span className="text-merqt-text-muted">Deliver to:</span> {o.delivery_address}{o.delivery_city ? ', ' + o.delivery_city : ''}</p>
                    )}
                    <p><span className="text-merqt-text-muted">Payment:</span> {o.payment_method === 'platform' ? 'Through Merqt' : 'Direct to you'}</p>
                  </div>
                )}

                {isCancelled && cancelledReasons[o.id] && (
                  <p className="text-[11.5px] text-merqt-text-muted mb-2">Cancellation reason: {cancelledReasons[o.id]}</p>
                )}

                {confirmingCancelId === o.id ? (
                  <div className="border-t border-merqt-border pt-3">
                    <select
                      value={cancelReasonDraft[o.id] ?? ''}
                      onChange={(e) => setCancelReasonDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      className="w-full border border-merqt-border rounded px-2.5 py-2 text-sm outline-none mb-2.5"
                    >
                      <option value="">Select a reason</option>
                      {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setConfirmingCancelId(null)}
                        className="border border-merqt-border rounded px-2.5 py-1.5 text-xs font-semibold text-merqt-text">
                        No
                      </button>
                      <button
                        onClick={() => confirmCancel(o)}
                        disabled={!cancelReasonDraft[o.id]}
                        className="bg-merqt-ochre-dark text-merqt-surface rounded px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {actionLabel && !isCancelled && (
                      <Button variant="primary" className="flex-1" onClick={() => advanceStatus(o)}>
                        {actionLabel}
                      </Button>
                    )}
                    {(o.status === 'delivered' || o.status === 'completed') && (
                      <p className="flex-1 text-center text-sm text-merqt-success-dark font-semibold self-center">
                        {o.is_service ? 'Completed' : 'Delivered'}
                      </p>
                    )}
                    {cancellable && (
                      <button onClick={() => setConfirmingCancelId(o.id)}
                        className="border border-merqt-border text-merqt-text-muted rounded px-3 py-2 text-xs font-semibold">
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

      </div>
    </div>
  )
}
