import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransactionFull } from '@/lib/paystack'
import { PREMIUM_PRICE_KOBO } from '@/lib/premium'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reference } = await req.json()
  if (!reference) return NextResponse.json({ error: 'reference is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: userRow } = await admin.from('users').select('id, email, premium_status').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!reference.startsWith(`merqt_premium_${userRow.id}_`)) {
    return NextResponse.json({ error: 'This reference does not belong to your account' }, { status: 400 })
  }

  if (userRow.premium_status === 'active') {
    return NextResponse.json({ ok: true, alreadyActive: true })
  }

  try {
    const result = await verifyTransactionFull(reference)

    if (result.status !== 'success' || result.amount !== PREMIUM_PRICE_KOBO) {
      return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 })
    }
    if (result.customer?.email && userRow.email && result.customer.email.toLowerCase() !== userRow.email.toLowerCase()) {
      return NextResponse.json({ error: 'This payment does not match your account email' }, { status: 400 })
    }

    await admin.from('users').update({
      premium_status: 'active',
      premium_customer_code: result.customer?.customer_code ?? null,
      premium_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', userRow.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not verify payment' }, { status: 500 })
  }
}
