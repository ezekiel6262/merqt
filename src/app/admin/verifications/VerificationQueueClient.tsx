'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function VerificationQueueClient({ initialSubmissions }: { initialSubmissions: any[] }) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  async function decide(sellerId: string, decision: 'approve' | 'reject', reason?: string) {
    setBusyId(sellerId)
    try {
      await fetch(`/api/admin/verifications/${sellerId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      })
      setSubmissions((prev) => prev.filter((s) => s.id !== sellerId))
      setRejectingId(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Identity verifications</h1>
        <p className="text-sm text-merqt-text-muted mb-6">Submissions the AI pre-check did not reject, waiting on a human decision.</p>

        {submissions.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-merqt-text-muted">Nothing pending review.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          {submissions.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-sm">{s.business_name}</p>
                  <p className="text-xs text-merqt-text-muted">{s.category} · {s.city}</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">Pending</span>
              </div>

              {s.identity_document_url && (
                <a href={s.identity_document_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={s.identity_document_url}
                    alt="Submitted document"
                    className="w-full max-h-80 object-contain rounded border border-merqt-border bg-merqt-bg mb-3"
                  />
                </a>
              )}

              {rejectingId === s.id ? (
                <div className="border-t border-merqt-border pt-3">
                  <textarea
                    value={rejectDrafts[s.id] ?? ''}
                    onChange={(e) => setRejectDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="Reason for rejection (shown to the seller)"
                    className="w-full min-h-[56px] border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo mb-2.5"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setRejectingId(null)}>Cancel</Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      disabled={busyId === s.id || !rejectDrafts[s.id]?.trim()}
                      onClick={() => decide(s.id, 'reject', rejectDrafts[s.id])}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" disabled={busyId === s.id} onClick={() => decide(s.id, 'approve')}>
                    Approve
                  </Button>
                  <Button variant="ghost" className="flex-1" disabled={busyId === s.id} onClick={() => setRejectingId(s.id)}>
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
