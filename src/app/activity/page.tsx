'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusPill, TypeTag } from '@/components/ui/StatusPill'
import { Avatar } from '@/components/ui/Avatar'

const CANCEL_REASONS = ['Changed my mind', 'Found another seller', 'No longer needed', 'Other']

function isTerminal(status: string) {
  return status === 'delivered' || status === 'completed' || status === 'cancelled'
}

type Tab = 'orders' | 'messages'

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-10 text-merqt-text-muted">Loading...</div>}>
      <ActivityInner />
    </Suspense>
  )
}

function ActivityInner() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'messages' ? 'messages' : 'orders')

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportSaving, setReportSaving] = useState(false)

  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [cancelReasonDraft, setCancelReasonDraft] = useState<Record<string, string>>({})
  // Cancellation reason is shown for this session only - the schema has no
  // column to persist it against an order yet.
  const [cancelledReasons, setCancelledReasons] = useState<Record<string, string>>({})

  // Messages
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(searchParams.get('convo'))
  const [messageDraft, setMessageDraft] = useState('')
  const [sending, setSending] = useState(false)

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

  async function loadConversations() {
    if (!user) return
    const userId = await ensureUserRow(supabase, user)
    setOwnUserId(userId)

    const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', userId).single()

    const orFilter = sellerRow
      ? `buyer_id.eq.${userId},seller_id.eq.${sellerRow.id}`
      : `buyer_id.eq.${userId}`

    const { data: convoRows } = await supabase
      .from('conversations')
      .select('*, buyer:users(name, avatar_url), seller:sellers(business_name, slug), messages(id, text, sender_user_id, read_at, created_at)')
      .or(orFilter)
      .order('created_at', { ascending: false })

    setConversations(convoRows ?? [])
  }

  useEffect(() => { loadActivity(); loadConversations() }, [user])

  useEffect(() => {
    if (selectedConvoId && ownUserId && conversations.length > 0) {
      const convo = conversations.find((c) => c.id === selectedConvoId)
      const unreadIds = (convo?.messages ?? [])
        .filter((m: any) => m.sender_user_id !== ownUserId && !m.read_at)
        .map((m: any) => m.id)
      if (unreadIds.length > 0) {
        supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
          .then(() => loadConversations())
      }
    }
  }, [selectedConvoId, ownUserId, conversations.length])

  async function submitReview(order: any) {
    if (!user) return
    setSaving(true)

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()

    if (!userRow) { setSaving(false); return }

    const { data: newReview } = await supabase.from('reviews').insert({
      order_id: order.id,
      buyer_id: userRow.id,
      seller_id: order.seller_id,
      product_id: order.product_id,
      rating,
      body: body || null,
    }).select('id').single()

    if (newReview) {
      // Fire-and-forget: never blocks or delays the buyer's review submission.
      fetch('/api/agents/review-intelligence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: newReview.id, rating, body }),
      }).catch(() => {})
    }

    setReviewing(null)
    setRating(5)
    setBody('')
    setSaving(false)
    loadActivity()
  }

  async function submitDispute(order: any) {
    if (reportReason.trim().length < 3) return
    setReportSaving(true)
    try {
      await fetch('/api/agents/shepherd/report-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, reason: reportReason }),
      })
    } finally {
      setReporting(null)
      setReportReason('')
      setReportSaving(false)
      loadActivity()
    }
  }

  async function confirmCancel(order: any) {
    const reason = cancelReasonDraft[order.id]
    if (!reason) return
    await supabase.from('orders').update({ status: 'cancelled', status_changed_at: new Date().toISOString() }).eq('id', order.id)
    setCancelledReasons((prev) => ({ ...prev, [order.id]: reason }))
    setConfirmingCancelId(null)
    loadActivity()
  }

  async function sendMessage() {
    if (!ownUserId || !selectedConvoId || messageDraft.trim().length === 0) return
    setSending(true)
    try {
      await supabase.from('messages').insert({
        conversation_id: selectedConvoId,
        sender_user_id: ownUserId,
        text: messageDraft.trim(),
      })
      setMessageDraft('')
      loadConversations()
    } finally {
      setSending(false)
    }
  }

  const totalUnread = conversations.reduce((sum, c) => {
    return sum + (c.messages ?? []).filter((m: any) => m.sender_user_id !== ownUserId && !m.read_at).length
  }, 0)
  const reviewNeededCount = orders.filter((o) => (o.status === 'delivered' || o.status === 'completed') && !o.review).length

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId)

  if (loading) return <div className="p-10 text-merqt-text-muted">Loading...</div>

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">

        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-5">Activity</h1>

        <div className="flex gap-1 mb-6 border-b border-merqt-border">
          <button
            onClick={() => setTab('orders')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 ${tab === 'orders' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Orders &amp; requests
            {reviewNeededCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-merqt-ochre-dark text-merqt-surface text-[9.5px] font-bold flex items-center justify-center">{reviewNeededCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('messages')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 ${tab === 'messages' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Messages
            {totalUnread > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-merqt-ochre-dark text-merqt-surface text-[9.5px] font-bold flex items-center justify-center">{totalUnread}</span>
            )}
          </button>
        </div>

        {tab === 'orders' && (
          <>
            {orders.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-sm text-merqt-text-muted">No activity yet. Your orders and requests will show up here.</p>
              </Card>
            )}

            <div className="flex flex-col gap-3.5">
              {orders.map((o) => {
                const hasReview = !!o.review
                const isDelivered = o.status === 'delivered' || o.status === 'completed'
                const isCancelled = o.status === 'cancelled'
                const cancellable = !isTerminal(o.status)
                return (
                  <Card key={o.id} className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <TypeTag label={o.is_service ? 'Service request' : 'Product order'} kind={o.is_service ? 'service' : 'product'} />
                        </div>
                        <p className="font-semibold text-sm">{o.product?.name}</p>
                        <p className="text-xs text-merqt-text-muted mb-1.5">{o.seller?.business_name}</p>
                        <StatusPill label={o.status} cancelled={isCancelled} />
                      </div>
                      <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(o.total_amount)}</p>
                    </div>

                    {isCancelled && cancelledReasons[o.id] && (
                      <p className="text-[11.5px] text-merqt-text-muted mt-1">Cancellation reason: {cancelledReasons[o.id]}</p>
                    )}

                    {isDelivered && !hasReview && reviewing !== o.id && (
                      <Button variant="ghost" className="w-full mt-2" onClick={() => setReviewing(o.id)}>
                        Leave a review
                      </Button>
                    )}

                    {isDelivered && hasReview && (
                      <div className="border-t border-merqt-border pt-3 mt-2">
                        <p className="text-xs font-semibold text-merqt-text-muted mb-1.5">Your review</p>
                        <div className="font-mono text-merqt-ochre-dark mb-1">
                          {'★'.repeat(o.review.rating)}{'☆'.repeat(5 - o.review.rating)}
                        </div>
                        {o.review.body && (
                          <p className="text-sm text-merqt-text">{o.review.body}</p>
                        )}
                      </div>
                    )}

                    {reviewing === o.id && (
                      <div className="border-t border-merqt-border pt-3 mt-2 space-y-3">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Your rating</label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => setRating(star)}
                                className={'text-2xl ' + (star <= rating ? 'text-merqt-ochre' : 'text-merqt-border')}>
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Comment (optional)</label>
                          <textarea className="w-full border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo"
                            rows={2} value={body} onChange={(e) => setBody(e.target.value)}
                            placeholder="How was your experience?" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" className="flex-1" onClick={() => setReviewing(null)}>Cancel</Button>
                          <Button variant="primary" className="flex-1" disabled={saving} onClick={() => submitReview(o)}>
                            {saving ? 'Submitting...' : 'Submit review'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {confirmingCancelId === o.id ? (
                      <div className="border-t border-merqt-border pt-3 mt-2">
                        <div className="text-[12.5px] text-merqt-text-muted mb-2">
                          Why are you cancelling this {o.is_service ? 'request' : 'order'}?
                        </div>
                        <select
                          value={cancelReasonDraft[o.id] ?? ''}
                          onChange={(e) => setCancelReasonDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                          className="w-full border border-merqt-border rounded px-2.5 py-2 text-sm outline-none mb-2.5"
                        >
                          <option value="">Select a reason</option>
                          {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="flex items-center gap-2.5 justify-end">
                          <button onClick={() => setConfirmingCancelId(null)}
                            className="border border-merqt-border rounded px-3 py-1.5 text-xs font-semibold text-merqt-text">
                            Keep it
                          </button>
                          <button
                            onClick={() => confirmCancel(o)}
                            disabled={!cancelReasonDraft[o.id]}
                            className="bg-merqt-ochre-dark text-merqt-surface rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          >
                            Yes, cancel
                          </button>
                        </div>
                      </div>
                    ) : cancellable && (
                      <button onClick={() => setConfirmingCancelId(o.id)}
                        className="mt-2 border border-merqt-border text-merqt-text-muted rounded px-3 py-1.5 text-xs font-semibold">
                        Cancel
                      </button>
                    )}

                    {o.dispute_status === 'reported' ? (
                      <p className="text-center text-sm text-merqt-ochre-dark font-semibold border-t border-merqt-border pt-3 mt-3">
                        Reported - the seller has been notified
                      </p>
                    ) : reporting !== o.id ? (
                      <Button variant="ghost" className="w-full mt-2" onClick={() => setReporting(o.id)}>
                        Report a problem
                      </Button>
                    ) : (
                      <div className="border-t border-merqt-border pt-3 mt-2 space-y-3">
                        <div>
                          <label className="block text-sm font-semibold mb-1">What went wrong?</label>
                          <textarea className="w-full border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo"
                            rows={2} value={reportReason} onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Tell us what happened..." />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" className="flex-1" onClick={() => { setReporting(null); setReportReason('') }}>
                            Cancel
                          </Button>
                          <Button variant="danger" className="flex-1" disabled={reportSaving || reportReason.trim().length < 3} onClick={() => submitDispute(o)}>
                            {reportSaving ? 'Submitting...' : 'Submit report'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {tab === 'messages' && (
          <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] border border-merqt-border rounded-card bg-merqt-surface overflow-hidden min-h-[420px]">
            <div className="border-b sm:border-b-0 sm:border-r border-merqt-border overflow-y-auto max-h-96 sm:max-h-none">
              <div className="font-semibold text-sm p-4">Conversations</div>
              {conversations.length === 0 && (
                <p className="px-4 pb-4 text-xs text-merqt-text-muted">No conversations yet. Message a seller from their profile.</p>
              )}
              {conversations.map((c) => {
                const iAmBuyer = c.buyer && ownUserId && c.buyer_id === ownUserId
                const otherName = iAmBuyer ? c.seller?.business_name : c.buyer?.name || 'Buyer'
                const otherAvatar = iAmBuyer ? null : c.buyer?.avatar_url
                const msgs = c.messages ?? []
                const last = msgs[msgs.length - 1]
                const unread = msgs.filter((m: any) => m.sender_user_id !== ownUserId && !m.read_at).length
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConvoId(c.id)}
                    className={`flex items-center gap-2.5 px-4 py-3 cursor-pointer border-b border-merqt-border ${selectedConvoId === c.id ? 'bg-merqt-indigo-soft' : 'hover:bg-merqt-bg'}`}
                  >
                    <Avatar src={otherAvatar} name={otherName || '?'} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold truncate">{otherName}</div>
                      <div className="text-xs text-merqt-text-muted truncate">{last?.text ?? 'No messages yet'}</div>
                    </div>
                    {unread > 0 && (
                      <div className="min-w-[18px] h-[18px] px-1 rounded-full bg-merqt-indigo text-merqt-surface text-[10.5px] font-bold flex items-center justify-center flex-shrink-0">{unread}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col">
              {!selectedConvo ? (
                <div className="flex-1 flex items-center justify-center text-sm text-merqt-text-muted p-8 text-center">
                  Select a conversation to view messages.
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-merqt-border flex items-center gap-2.5">
                    <Avatar
                      src={selectedConvo.buyer_id === ownUserId ? null : selectedConvo.buyer?.avatar_url}
                      name={selectedConvo.buyer_id === ownUserId ? selectedConvo.seller?.business_name : selectedConvo.buyer?.name || 'Buyer'}
                      size={30}
                      shape={selectedConvo.buyer_id === ownUserId ? 'square' : 'circle'}
                    />
                    <span className="font-semibold text-sm">
                      {selectedConvo.buyer_id === ownUserId ? selectedConvo.seller?.business_name : selectedConvo.buyer?.name || 'Buyer'}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 max-h-96">
                    {(selectedConvo.messages ?? []).map((m: any) => {
                      const mine = m.sender_user_id === ownUserId
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${mine ? 'bg-merqt-indigo text-merqt-surface' : 'bg-merqt-bg text-merqt-text'}`}>
                            {m.text}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-4 border-t border-merqt-border flex gap-2.5">
                    <input
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
                      placeholder="Write a message"
                      className="flex-1 border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                    />
                    <Button variant="primary" disabled={sending || messageDraft.trim().length === 0} onClick={sendMessage}>
                      Send
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
