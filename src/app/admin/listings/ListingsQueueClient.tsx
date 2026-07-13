'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function ListingsQueueClient({ initialListings }: { initialListings: any[] }) {
  const [listings, setListings] = useState(initialListings)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  async function decide(productId: string, decision: 'approve' | 'reject', reason?: string) {
    setBusyId(productId)
    try {
      await fetch(`/api/admin/listings/${productId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      })
      setListings((prev) => prev.filter((p) => p.id !== productId))
      setRejectingId(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Flagged listings</h1>
        <p className="text-sm text-merqt-text-muted mb-6">Listings the AI safety check flagged, waiting on a human decision.</p>

        {listings.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">Nothing pending review.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {listings.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-merqt-text-muted">{p.seller?.business_name} · {p.type}</p>
                </div>
                <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(p.price)}</p>
              </div>

              {p.description && <p className="text-sm text-merqt-text mb-3">{p.description}</p>}

              {p.images?.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {p.images.map((url: string) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="w-20 h-20 rounded object-cover border border-merqt-border" />
                  ))}
                </div>
              )}

              {p.moderation_reason && (
                <p className="text-xs text-merqt-ochre-dark bg-merqt-ochre-soft rounded p-2 mb-3">
                  <span className="font-semibold">AI flag reason:</span> {p.moderation_reason}
                </p>
              )}

              {rejectingId === p.id ? (
                <div className="border-t border-merqt-border pt-3">
                  <textarea
                    value={rejectDrafts[p.id] ?? ''}
                    onChange={(e) => setRejectDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Reason for rejection (shown to the seller)"
                    className="w-full min-h-[56px] border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo mb-2.5"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setRejectingId(null)}>Cancel</Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      disabled={busyId === p.id || !rejectDrafts[p.id]?.trim()}
                      onClick={() => decide(p.id, 'reject', rejectDrafts[p.id])}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={busyId === p.id} onClick={() => decide(p.id, 'approve')}>
                    Approve
                  </Button>
                  <Button variant="ghost" className="flex-1" disabled={busyId === p.id} onClick={() => setRejectingId(p.id)}>
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
