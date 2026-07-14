import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserProfileClient } from './UserProfileClient'

export default async function UserProfilePage({
  params,
}: {
  params: { handle: string }
}) {
  const raw = decodeURIComponent(params.handle)
  const slug = raw.startsWith('@') ? raw.slice(1) : raw

  const supabase = createClient()

  const { data: profileUser } = await supabase
    .from('users')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!profileUser) notFound()

  const { data: sellers } = await supabase
    .from('sellers')
    .select('slug, business_name')
    .eq('user_id', profileUser.id)
    .order('created_at', { ascending: true })
    .limit(1)

  return <UserProfileClient profileUser={profileUser} seller={sellers?.[0] ?? null} />
}
