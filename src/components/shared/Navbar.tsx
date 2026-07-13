'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@/lib/supabase/client'

export function Navbar() {
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const [isSeller, setIsSeller] = useState(false)
  const supabase = useSupabaseClient()

  useEffect(() => {
    async function checkSeller() {
      if (!user) return
      const { data: userRow } = await supabase
        .from('users').select('id').eq('clerk_id', user.id).single()
      if (!userRow) return
      const { data: sellerRow } = await supabase
        .from('sellers').select('id').eq('user_id', userRow.id).single()
      setIsSeller(!!sellerRow)
    }
    checkSeller()
  }, [user])

  const linkClass = (path: string) =>
    'text-[13.5px] px-3.5 py-1.5 border-b-2 -mb-px transition-colors ' +
    (pathname === path
      ? 'text-merqt-indigo font-bold border-merqt-indigo'
      : 'text-merqt-text-muted font-medium border-transparent hover:text-merqt-text')

  return (
    <header className="bg-merqt-surface border-b border-merqt-border sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-3">

        <Link href="/discover" className="font-serif text-xl font-semibold text-merqt-indigo flex-shrink-0">
          Merqt
        </Link>

        <div className="flex-1" />

        <nav className="flex items-center gap-0.5">
          <Link href="/discover" className={linkClass('/discover')}>Discover</Link>

          {isSignedIn && (
            <Link href="/activity" className={linkClass('/activity')}>Activity</Link>
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
        </nav>

        {isSignedIn ? (
          <div className="ml-1 flex-shrink-0">
            <UserButton afterSignOutUrl="/discover" />
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
    </header>
  )
}
