import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RequestClient } from './RequestClient'

export default async function RequestPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: service } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!service) notFound()

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', service.seller_id)
    .single()

  if (!seller) notFound()

  return <RequestClient service={service} seller={seller} />
}