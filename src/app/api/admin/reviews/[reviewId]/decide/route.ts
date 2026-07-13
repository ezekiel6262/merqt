import { NextResponse } from 'next/server'
import { currentUserIsAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: { reviewId: string } }) {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { decision } = await req.json()
  if (decision !== 'dismiss' && decision !== 'hide') {
    return NextResponse.json({ error: 'decision must be "dismiss" or "hide"' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updates =
    decision === 'hide'
      ? { hidden: true }
      : { flagged_suspicious: false, flag_reason: null }

  const { error } = await admin.from('reviews').update(updates).eq('id', params.reviewId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
