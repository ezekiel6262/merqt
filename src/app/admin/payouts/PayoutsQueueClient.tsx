'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function PayoutsQueueClient({ initialPayouts }: { initialPayouts: any[] }) {
  const [payouts, setPayouts] = useState(initialPayouts)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function markPaid(orderId: string) {
    setBusyId(orderId)
    try {
      await fetch(`/api/admin/payouts/${orderId}/mark-paid`, { method: 'POST' })
      setPayouts((prev) => prev.filter((p) => p.id !== orderId))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Pending payouts</h1>
        <p className="text-sm text-merqt-text-muted mb-6">
          Buyers have confirmed receipt on these orders and released their escrow payment - pay the seller directly
          (bank transfer, Paystack dashboard, etc.) then mark it done here. Merqt doesn&apos;t move money to sellers
          automatically yet.
        </p>

        {payouts.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">Nothing waiting on a payout right now.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {payouts.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">{p.product?.name}</p>
                  <p className="text-xs text-merqt-text-muted">
                    Pay out to {p.seller?.business_name}
                    {p.seller?.phone ? ` · ${p.seller.phone}` : ''}
                    {p.seller?.whatsapp ? ` · WhatsApp ${p.seller.whatsapp}` : ''}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(p.total_amount)}</p>
              </div>
              <p className="text-xs text-merqt-text-muted mb-3">
                Released {new Date(p.released_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
              <Button variant="primary" className="w-full" disabled={busyId === p.id} onClick={() => markPaid(p.id)}>
                {busyId === p.id ? 'Marking...' : "I've paid this seller"}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
