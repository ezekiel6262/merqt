import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPlan, initializeSubscription } from '@/lib/paystack'
import { PREMIUM_PLAN_NAME, PREMIUM_PRICE_KOBO } from '@/lib/premium'

async function getOrCreatePlanCode(admin: ReturnType<typeof createAdminClient>) {
  const { data: setting } = await admin
    .from('platform_settings').select('value').eq('key', 'paystack_premium_plan_code').single()
  if (setting?.value) return setting.value

  const plan = await createPlan({ name: PREMIUM_PLAN_NAME, amountKobo: PREMIUM_PRICE_KOBO, interval: 'monthly' })
  await admin.from('platform_settings').upsert({ key: 'paystack_premium_plan_code', value: plan.plan_code })
  return plan.plan_code
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: userRow } = await admin.from('users').select('id, email, premium_status').eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!userRow.email) return NextResponse.json({ error: 'Add an email to your account first' }, { status: 400 })
  if (userRow.premium_status === 'active') {
    return NextResponse.json({ error: 'You already have Merqt Premium' }, { status: 400 })
  }

  const reference = `merqt_premium_${userRow.id}_${Date.now()}`
  const origin = req.headers.get('origin') ?? new URL(req.url).origin

  try {
    const planCode = await getOrCreatePlanCode(admin)
    const { authorization_url } = await initializeSubscription({
      email: userRow.email,
      planCode,
      reference,
      callbackUrl: `${origin}/settings/premium?verify=${reference}`,
    })
    return NextResponse.json({ authorizationUrl: authorization_url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start subscription' }, { status: 500 })
  }
}
