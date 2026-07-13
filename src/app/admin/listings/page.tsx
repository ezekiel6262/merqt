import { createAdminClient } from '@/lib/supabase/admin'
import { ListingsQueueClient } from './ListingsQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminListingsPage() {
  const admin = createAdminClient()
  const { data: flagged } = await admin
    .from('products')
    .select('id, name, description, images, price, type, moderation_reason, created_at, seller:sellers(business_name, slug)')
    .eq('moderation_status', 'flagged')
    .order('created_at', { ascending: true })

  return <ListingsQueueClient initialListings={flagged ?? []} />
}
