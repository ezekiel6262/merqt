import { NextResponse } from 'next/server'
import { currentUserIsAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: { productId: string } }) {
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
      ? { moderation_status: 'approved' as const, moderation_reason: null }
      : { moderation_status: 'rejected' as const, moderation_reason: reason || 'Rejected on review.' }

  const { error } = await admin.from('products').update(updates).eq('id', params.productId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
