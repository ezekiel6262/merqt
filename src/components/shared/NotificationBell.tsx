'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSupabaseClient } from '@/lib/supabase/client'

function timeAgoShort(dateStr: string) {
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function messageFor(n: any): string {
  const actorName = n.actor_seller?.business_name ?? n.actor?.name ?? 'Someone'
  switch (n.type) {
    case 'follow': return `${actorName} followed you`
    case 'like': return `${actorName} liked your post`
    case 'comment': return `${actorName} commented on your post`
    case 'request_accepted': return `${actorName} can help with your request`
    case 'offer_accepted': return `${actorName} accepted your offer`
    default: return `${actorName} sent you an update`
  }
}

function hrefFor(n: any): string {
  if (n.post_id) return '/network'
  if (n.request_id || n.type === 'offer_accepted') return '/activity'
  if (n.actor_seller?.slug) return `/@${n.actor_seller.slug}`
  if (n.actor?.slug) return `/u/${n.actor.slug}`
  return '/activity'
}

export function NotificationBell({ userId }: { userId: string | null }) {
  const supabase = useSupabaseClient()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, read_at, created_at, post_id, request_id, actor:users!actor_user_id(name, slug), actor_seller:sellers(business_name, slug)')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data ?? [])
    setUnreadCount((data ?? []).filter((n: any) => !n.read_at).length)
  }

  useEffect(() => { load() }, [userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('navbar-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next && userId && unreadCount > 0) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', userId).is('read_at', null)
      setUnreadCount(0)
      setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    }
  }

  if (!userId) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-merqt-bg text-merqt-text-muted flex-shrink-0"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-merqt-ochre-dark text-merqt-surface text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 max-w-[90vw] bg-merqt-surface border border-merqt-border rounded-card shadow-md overflow-hidden z-50 max-h-96 overflow-y-auto">
          {notifs.length === 0 ? (
            <p className="p-4 text-sm text-merqt-text-muted text-center">No notifications yet.</p>
          ) : (
            notifs.map((n) => (
              <Link
                key={n.id}
                href={hrefFor(n)}
                onClick={() => setOpen(false)}
                className="block px-3.5 py-2.5 text-[13px] border-t border-merqt-border first:border-t-0 hover:bg-merqt-bg"
              >
                <p className="text-merqt-text">{messageFor(n)}</p>
                <p className="text-[11px] text-merqt-text-muted mt-0.5">{timeAgoShort(n.created_at)}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
