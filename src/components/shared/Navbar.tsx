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
    'text-sm px-3 py-1 ' +
    (pathname === path ? 'text-li-blue font-semibold' : 'text-li-text-2 hover:text-li-text-1')

  return (
    <header className="bg-white border-b border-li-border sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        <Link href="/discover" className="text-li-blue font-semibold text-xl">
          Merqt
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/discover" className={linkClass('/discover')}>Discover</Link>

          {isSignedIn && (
            <Link href="/activity" className={linkClass('/activity')}>Activity</Link>
          )}

          {isSignedIn && isSeller && (
            <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
          )}

          {isSignedIn ? (
            <div className="ml-2">
              <UserButton afterSignOutUrl="/discover" />
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link href="/login" className="text-sm text-li-text-2 px-3 py-1">Sign in</Link>
              <Link href="/register"
                className="text-sm bg-li-blue text-white font-semibold px-4 py-1.5 rounded-pill">
                Join now
              </Link>
            </div>
          )}
        </nav>

      </div>
    </header>
  )
}