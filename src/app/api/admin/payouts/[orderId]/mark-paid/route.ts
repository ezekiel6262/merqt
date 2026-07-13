import { NextResponse } from 'next/server'
import { currentUserIsAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: Request, { params }: { params: { orderId: string } }) {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({ payout_status: 'paid_out' })
    .eq('id', params.orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
