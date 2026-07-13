import { NextResponse } from 'next/server'
import { currentUserIsAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: { sellerId: string } }) {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { decision, reason } = await req.json()
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updates =
    decision === 'approve'
      ? { verified: true, identity_status: 'approved' as const, identity_rejection_reason: null }
      : { verified: false, identity_status: 'rejected' as const, identity_rejection_reason: reason || 'Rejected on review.' }

  const { error } = await admin.from('sellers').update(updates).eq('id', params.sellerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
