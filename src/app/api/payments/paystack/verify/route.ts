import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, reference } = await req.json()
  if (!orderId || !reference) return NextResponse.json({ error: 'orderId and reference are required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: buyerUser } = await admin.from('users').select('id').eq('clerk_id', userId).single()
  if (!buyerUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, total_amount, payment_status, paystack_reference')
    .eq('id', orderId)
    .eq('buyer_id', buyerUser.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.paystack_reference !== reference) {
    return NextResponse.json({ error: 'Reference does not match this order' }, { status: 400 })
  }

  if (order.payment_status === 'paid' || order.payment_status === 'released') {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  try {
    const result = await verifyTransaction(reference)
    const expectedKobo = Math.round(Number(order.total_amount) * 100)

    if (result.status !== 'success' || result.amount !== expectedKobo) {
      return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 })
    }

    await admin
      .from('orders')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', order.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not verify payment' }, { status: 500 })
  }
}
