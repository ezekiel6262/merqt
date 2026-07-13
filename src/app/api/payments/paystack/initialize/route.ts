import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { initializeTransaction } from '@/lib/paystack'

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: buyerUser } = await admin.from('users').select('id, email').eq('clerk_id', userId).single()
  if (!buyerUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, product_id, total_amount, payment_method, payment_status')
    .eq('id', orderId)
    .eq('buyer_id', buyerUser.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.payment_method !== 'platform') {
    return NextResponse.json({ error: 'This order is not set up for escrow payment' }, { status: 400 })
  }
  if (order.payment_status === 'paid' || order.payment_status === 'released') {
    return NextResponse.json({ error: 'This order has already been paid' }, { status: 400 })
  }

  const reference = `merqt_${order.id}_${Date.now()}`
  const origin = req.headers.get('origin') ?? new URL(req.url).origin

  try {
    const { authorization_url } = await initializeTransaction({
      email: buyerUser.email,
      amountKobo: Math.round(Number(order.total_amount) * 100),
      reference,
      callbackUrl: `${origin}/order/${order.product_id}?verify=${reference}&orderId=${order.id}`,
    })

    await admin.from('orders').update({ paystack_reference: reference }).eq('id', order.id)

    return NextResponse.json({ authorizationUrl: authorization_url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start payment' }, { status: 500 })
  }
}
