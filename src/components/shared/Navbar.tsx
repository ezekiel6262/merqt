'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'
import { HeaderSearch } from './HeaderSearch'

export function Navbar() {
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const [isSeller, setIsSeller] = useState(false)
  const [canAddBusiness, setCanAddBusiness] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ name: string; avatarUrl: string; slug: string | null }>({
    name: '', avatarUrl: '', slug: null,
  })
  const supabase = useSupabaseClient()

  async function checkStatus() {
    if (!user) return
    const { data: userRow } = await supabase
      .from('users').select('id, name, avatar_url, slug, max_businesses').eq('clerk_id', user.id).single()
    if (!userRow) return

    setProfile({ name: userRow.name ?? '', avatarUrl: userRow.avatar_url ?? '', slug: userRow.slug ?? null })
    setOwnUserId(userRow.id)

    const { data: sellerRow } = await supabase
      .from('sellers').select('id').eq('user_id', userRow.id).single()
    setIsSeller(!!sellerRow)

    const { count: sellerCount } = await supabase
      .from('sellers').select('id', { count: 'exact', head: true }).eq('user_id', userRow.id)
    setCanAddBusiness((sellerCount ?? 0) < (userRow.max_businesses ?? 1))

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

  const tabClass = (path: string) =>
    'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 ' +
    (pathname === path ? 'text-merqt-indigo' : 'text-merqt-text-muted')

  return (
    <header className="bg-merqt-surface border-b border-merqt-border sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-3">

        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold text-merqt-indigo flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" width={28} height={28} className="flex-shrink-0" />
          <span className="hidden sm:inline">Merqt</span>
        </Link>

        <HeaderSearch className="flex-1 min-w-0 sm:max-w-xs" />

        {isSignedIn && <NotificationBell userId={ownUserId} />}

        <nav className="hidden md:flex items-center gap-0.5">
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

          {isSignedIn && canAddBusiness && (
            <Link
              href="/onboarding"
              className="ml-2 bg-merqt-indigo text-merqt-surface rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
            >
              {isSeller ? '+ Add a business' : 'Become a seller'}
            </Link>
          )}
        </nav>

        {isSignedIn ? (
          <div className="hidden md:block ml-1 flex-shrink-0">
            <ProfileMenu name={profile.name} avatarUrl={profile.avatarUrl} slug={profile.slug} isSeller={isSeller} canAddBusiness={canAddBusiness} />
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 ml-1 flex-shrink-0">
            <Link href="/login" className="text-[13.5px] text-merqt-text-muted px-3 py-1.5">Sign in</Link>
            <Link href="/register"
              className="text-[13.5px] bg-merqt-indigo text-merqt-surface font-semibold px-4 py-1.5 rounded">
              Join now
            </Link>
          </div>
        )}

      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-merqt-surface border-t border-merqt-border flex">
        <Link href="/" className={tabClass('/')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
          </svg>
          <span className="text-[9.5px] font-semibold">Home</span>
        </Link>

        <Link href="/discover" className={tabClass('/discover')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="text-[9.5px] font-semibold">Discover</span>
        </Link>

        <Link href="/network" className={tabClass('/network')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="8" r="2.6" />
            <circle cx="17" cy="8" r="2.6" />
            <path d="M2.5 19c0-3 2.5-5 4.5-5s3.2.9 4 2c.8-1.1 2-2 4-2s4.5 2 4.5 5" />
          </svg>
          <span className="text-[9.5px] font-semibold">Network</span>
        </Link>

        {isSignedIn && (
          <Link href="/activity" className={`${tabClass('/activity')} relative`}>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-[22%] min-w-[14px] h-[14px] px-1 rounded-full bg-merqt-ochre-dark text-merqt-surface text-[8.5px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[9.5px] font-semibold">Activity</span>
          </Link>
        )}

        {isSignedIn ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5">
            <ProfileMenu name={profile.name} avatarUrl={profile.avatarUrl} slug={profile.slug} isSeller={isSeller} canAddBusiness={canAddBusiness} direction="up" />
            <span className="text-[9.5px] font-semibold text-merqt-text-muted">Profile</span>
          </div>
        ) : (
          <Link href="/login" className={tabClass('/login')}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
            </svg>
            <span className="text-[9.5px] font-semibold">Sign in</span>
          </Link>
        )}
      </nav>
    </header>
  )
}
