import { createClient } from '@/lib/supabase/client'
import { DiscoverClient } from './DiscoverClient'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const supabase = createClient()

  const { data: sellers } = await supabase
    .from('sellers')
    .select('*')
    .order('rating', { ascending: false })

  return <DiscoverClient sellers={sellers ?? []} />
}