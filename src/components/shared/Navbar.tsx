'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ProfileMenu } from './ProfileMenu'

export function Navbar() {
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const [isSeller, setIsSeller] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [profile, setProfile] = useState<{ name: string; avatarUrl: string; slug: string | null }>({
    name: '', avatarUrl: '', slug: null,
  })
  const supabase = useSupabaseClient()

  async function checkStatus() {
    if (!user) return
    const { data: userRow } = await supabase
      .from('users').select('id, name, avatar_url, slug').eq('clerk_id', user.id).single()
    if (!userRow) return

    setProfile({ name: userRow.name ?? '', avatarUrl: userRow.avatar_url ?? '', slug: userRow.slug ?? null })

    const { data: sellerRow } = await supabase
      .from('sellers').select('id').eq('user_id', userRow.id).single()
    setIsSeller(!!sellerRow)

    const orFilter = sellerRow
      ? `buyer_id.eq.${userRow.id},seller_id.eq.${sellerRow.id}`
      : `buyer_id.eq.${userRow.id}`
    const { data: convoRows } = await supabase.from('conversations').select('id').or(orFilter)
    const convoIds = (convoRows ?? []).map((c) => c.id)
    if (convoIds.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .is('read_at', null)
        .neq('sender_user_id', userRow.id)
      setUnreadCount(count ?? 0)
    }
  }

  useEffect(() => { checkStatus() }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('navbar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        checkStatus()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, user])

  const linkClass = (path: string) =>
    'text-[13.5px] px-3.5 py-1.5 border-b-2 -mb-px transition-colors flex items-center gap-1.5 ' +
    (pathname === path
      ? 'text-merqt-indigo font-bold border-merqt-indigo'
      : 'text-merqt-text-muted font-medium border-transparent hover:text-merqt-text')

  const navLinks = (
    <>
      <Link href="/" className={linkClass('/')}>Home</Link>
      <Link href="/discover" className={linkClass('/discover')}>Discover</Link>
      <Link href="/network" className={linkClass('/network')}>Network</Link>

      {isSignedIn && (
        <Link href="/activity" className={linkClass('/activity')}>
          Activity
          {unreadCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-merqt-ochre-dark text-merqt-surface text-[9.5px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>
      )}

      {isSignedIn && isSeller && (
        <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
      )}

      {isSignedIn && !isSeller && (
        <Link
          href="/onboarding"
          className="ml-2 bg-merqt-indigo text-merqt-surface rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          Become a seller
        </Link>
      )}
    </>
  )

  return (
    <header className="bg-merqt-surface border-b border-merqt-border sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-3">

        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold text-merqt-indigo flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" width={28} height={28} className="flex-shrink-0" />
          Merqt
        </Link>

        <div className="flex-1" />

        <nav className="hidden md:flex items-center gap-0.5">{navLinks}</nav>

        {isSignedIn ? (
          <div className="ml-1 flex-shrink-0">
            <ProfileMenu name={profile.name} avatarUrl={profile.avatarUrl} slug={profile.slug} />
          </div>
        ) : (
          <div className="flex items-center gap-2 ml-1 flex-shrink-0">
            <Link href="/login" className="text-[13.5px] text-merqt-text-muted px-3 py-1.5">Sign in</Link>
            <Link href="/register"
              className="text-[13.5px] bg-merqt-indigo text-merqt-surface font-semibold px-4 py-1.5 rounded">
              Join now
            </Link>
          </div>
        )}

      </div>

      <div className="md:hidden overflow-x-auto border-t border-merqt-border">
        <nav className="flex items-center gap-0.5 px-3 py-1.5 min-w-max">{navLinks}</nav>
      </div>
    </header>
  )
}
