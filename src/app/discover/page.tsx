import { createClient } from '@/lib/supabase/server'
import { DiscoverClient } from './DiscoverClient'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const supabase = createClient()

  const { data: sellers } = await supabase
    .from('sellers')
    .select('*')
    .order('rating', { ascending: false })

  const { data: requests } = await supabase
    .from('buyer_requests')
    .select('*, buyer:users(name, avatar_url, slug)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  return <DiscoverClient sellers={sellers ?? []} initialRequests={requests ?? []} />
}
