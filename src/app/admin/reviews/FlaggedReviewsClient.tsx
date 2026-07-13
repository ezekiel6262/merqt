'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function FlaggedReviewsClient({ initialReviews }: { initialReviews: any[] }) {
  const [reviews, setReviews] = useState(initialReviews)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(reviewId: string, decision: 'dismiss' | 'hide') {
    setBusyId(reviewId)
    try {
      await fetch(`/api/admin/reviews/${reviewId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Flagged reviews</h1>
        <p className="text-sm text-merqt-text-muted mb-6">Reviews the AI check flagged as potentially suspicious.</p>

        {reviews.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">Nothing flagged right now.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">
                    {r.buyer?.name || 'Buyer'} → {r.seller?.business_name}
                  </p>
                  <p className="text-xs text-merqt-text-muted">
                    {r.product?.name ? `${r.product.name} · ` : ''}{r.rating} ★
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-merqt-ochre-soft text-merqt-ochre-dark whitespace-nowrap">
                  Flagged
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-2">{r.body}</p>
              {r.flag_reason && (
                <p className="text-xs text-merqt-ochre-dark mb-3">
                  <span className="font-semibold">Why:</span> {r.flag_reason}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={busyId === r.id} onClick={() => decide(r.id, 'dismiss')}>
                  Dismiss flag
                </Button>
                <Button variant="danger" className="flex-1" disabled={busyId === r.id} onClick={() => decide(r.id, 'hide')}>
                  Hide review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
