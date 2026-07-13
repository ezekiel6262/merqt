import { createAdminClient } from '@/lib/supabase/admin'
import { DisputesQueueClient } from './DisputesQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminDisputesPage() {
  const admin = createAdminClient()
  const { data: disputes } = await admin
    .from('orders')
    .select('id, total_amount, dispute_reason, dispute_category, dispute_suggested_action, disputed_at, product:products(name), seller:sellers(business_name, slug), buyer:users(name)')
    .eq('dispute_status', 'reported')
    .order('disputed_at', { ascending: true })

  return <DisputesQueueClient initialDisputes={disputes ?? []} />
}
