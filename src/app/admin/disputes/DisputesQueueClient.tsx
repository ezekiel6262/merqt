'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { formatNaira } from '@/lib/format'
import { DISPUTE_CATEGORY_LABEL } from '@/lib/disputes'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function DisputesQueueClient({ initialDisputes }: { initialDisputes: any[] }) {
  const [disputes, setDisputes] = useState(initialDisputes)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function resolve(orderId: string) {
    setBusyId(orderId)
    try {
      await fetch(`/api/admin/disputes/${orderId}/resolve`, { method: 'POST' })
      setDisputes((prev) => prev.filter((d) => d.id !== orderId))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Open disputes</h1>
        <p className="text-sm text-merqt-text-muted mb-6">Orders a buyer has reported a problem with, across the whole platform.</p>

        {disputes.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">No open disputes right now.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {disputes.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">{d.product?.name}</p>
                  <p className="text-xs text-merqt-text-muted">
                    {d.buyer?.name || 'A buyer'} vs {d.seller?.business_name}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(d.total_amount)}</p>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                {d.dispute_category && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-merqt-ochre-dark text-merqt-surface">
                    {DISPUTE_CATEGORY_LABEL[d.dispute_category] ?? d.dispute_category}
                  </span>
                )}
                <span className="text-xs text-merqt-text-muted">
                  {new Date(d.disputed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              <p className="text-sm text-merqt-text mb-2">{d.dispute_reason}</p>
              {d.dispute_suggested_action && (
                <p className="text-xs text-merqt-ochre-dark mb-3">
                  <span className="font-semibold">AI-suggested next step:</span> {d.dispute_suggested_action}
                </p>
              )}

              <Button variant="primary" className="w-full" disabled={busyId === d.id} onClick={() => resolve(d.id)}>
                {busyId === d.id ? 'Marking resolved...' : 'Mark resolved'}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
