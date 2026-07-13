import { notFound } from 'next/navigation'
import { currentUserIsAdmin } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { VerificationQueueClient } from './VerificationQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminVerificationsPage() {
  if (!(await currentUserIsAdmin())) notFound()

  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('sellers')
    .select('id, business_name, slug, category, city, identity_document_url, identity_status, identity_rejection_reason, created_at')
    .eq('identity_status', 'pending')
    .order('created_at', { ascending: true })

  return <VerificationQueueClient initialSubmissions={pending ?? []} />
}
