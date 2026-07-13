import { createAdminClient } from '@/lib/supabase/admin'
import { PayoutsQueueClient } from './PayoutsQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  const admin = createAdminClient()
  const { data: payouts } = await admin
    .from('orders')
    .select('id, total_amount, released_at, product:products(name), seller:sellers(business_name, phone, whatsapp)')
    .eq('payment_status', 'released')
    .eq('payout_status', 'pending')
    .order('released_at', { ascending: true })

  return <PayoutsQueueClient initialPayouts={payouts ?? []} />
}
