'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'

export function HeaderSearch({ className = '' }: { className?: string }) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [sellers, setSellers] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSellers([]); setUsers([]); return }
    const timeout = setTimeout(async () => {
      const [{ data: sellerRows }, { data: userRows }] = await Promise.all([
        supabase.from('sellers').select('id, business_name, slug, category, city, logo_url').ilike('business_name', `%${q}%`).limit(5),
        supabase.from('users').select('id, name, slug, avatar_url').ilike('name', `%${q}%`).not('slug', 'is', null).limit(5),
      ])
      setSellers(sellerRows ?? [])
      setUsers(userRows ?? [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, supabase])

  function goToResult(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const hasResults = sellers.length > 0 || users.length > 0

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-merqt-text-muted pointer-events-none"
          viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search businesses, people..."
          className="w-full bg-merqt-bg border border-merqt-border rounded-full pl-8 pr-3 py-1.5 text-[13px] outline-none focus:border-merqt-indigo"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-9 w-72 max-w-[85vw] bg-merqt-surface border border-merqt-border rounded-card shadow-md overflow-hidden z-50 max-h-96 overflow-y-auto">
          {!hasResults ? (
            <p className="p-3.5 text-sm text-merqt-text-muted text-center">No results for &quot;{query}&quot;</p>
          ) : (
            <>
              {sellers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goToResult(`/@${s.slug}`)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-merqt-bg border-b border-merqt-border last:border-b-0"
                >
                  <Avatar src={s.logo_url} name={s.business_name} size={30} shape="square" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate">{s.business_name}</p>
                    <p className="text-[11px] text-merqt-text-muted truncate">{s.category} · {s.city}</p>
                  </div>
                </button>
              ))}
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => goToResult(`/u/${u.slug}`)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-merqt-bg border-b border-merqt-border last:border-b-0"
                >
                  <Avatar src={u.avatar_url} name={u.name} size={30} />
                  <p className="text-[13px] font-semibold truncate">{u.name}</p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
