'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { getInitials, timeAgo } from '@/lib/format'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { Button } from '@/components/ui/Button'

const STRIPE_BG =
  'repeating-linear-gradient(45deg, oklch(0.92 0.03 265), oklch(0.92 0.03 265) 10px, oklch(0.995 0.004 70) 10px, oklch(0.995 0.004 70) 20px)'

export function UserProfileClient({
  profileUser,
  seller,
}: {
  profileUser: any
  seller: { slug: string; business_name: string } | null
}) {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (user && user.id === profileUser.clerk_id) setIsOwnProfile(true)
  }, [user, profileUser.clerk_id])

  useEffect(() => {
    async function checkFollowing() {
      if (!user || user.id === profileUser.clerk_id) return
      const { data: viewerRow } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
      if (!viewerRow) return
      const { data } = await supabase
        .from('follows').select('id').eq('follower_id', viewerRow.id).eq('followee_user_id', profileUser.id).single()
      setFollowing(!!data)
    }
    checkFollowing()
  }, [user, profileUser.id, profileUser.clerk_id, supabase])

  async function toggleFollow() {
    if (!user) { router.push('/login'); return }
    setFollowLoading(true)
    try {
      const viewerId = await ensureUserRow(supabase, user)
      if (following) {
        await supabase.from('follows').delete().eq('follower_id', viewerId).eq('followee_user_id', profileUser.id)
        setFollowing(false)
      } else {
        await supabase.from('follows').insert({ follower_id: viewerId, followee_user_id: profileUser.id })
        setFollowing(true)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <div className="bg-merqt-surface border border-merqt-border rounded-card overflow-hidden">
          {profileUser.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileUser.cover_photo_url} alt="" className="w-full h-28 sm:h-36 object-cover" />
          ) : (
            <div className="h-16" style={{ background: STRIPE_BG }} />
          )}
          <div className="p-6">
            <div className="flex justify-between items-start gap-4 mb-4 flex-wrap">
              <div className="flex gap-4">
                {profileUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileUser.avatar_url}
                    alt={profileUser.name}
                    className="w-16 h-16 rounded-card object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-card bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark text-xl font-semibold flex-shrink-0">
                    {getInitials(profileUser.name || 'M')}
                  </div>
                )}
                <div>
                  <h1 className="font-serif text-2xl font-semibold text-merqt-text leading-tight mb-1">
                    {profileUser.name || 'Merqt member'}
                  </h1>
                  {profileUser.previous_name && profileUser.previous_name_until && new Date(profileUser.previous_name_until) > new Date() && (
                    <p className="text-xs text-merqt-text-muted mb-1">Formerly known as {profileUser.previous_name}</p>
                  )}
                  <div className="text-sm text-merqt-text-muted">
                    On Merqt since {timeAgo(profileUser.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 items-center">
                {isOwnProfile ? (
                  <Link href="/settings/profile">
                    <Button variant="ghost">Edit profile</Button>
                  </Link>
                ) : (
                  <Button variant={following ? 'ghost' : 'primary'} disabled={followLoading} onClick={toggleFollow}>
                    {followLoading ? '...' : following ? 'Following' : 'Follow'}
                  </Button>
                )}
                {seller && (
                  <Link href={`/@${seller.slug}`}>
                    <Button variant="primary">View business profile</Button>
                  </Link>
                )}
              </div>
            </div>

            {profileUser.bio && (
              <p className="text-[14.5px] leading-relaxed text-merqt-text border-t border-merqt-border pt-4">
                {profileUser.bio}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
