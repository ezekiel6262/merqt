'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useClerk } from '@clerk/nextjs'
import { getInitials } from '@/lib/format'

export function ProfileMenu({
  name,
  avatarUrl,
  slug,
}: {
  name: string
  avatarUrl: string
  slug: string | null
}) {
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden border border-merqt-border flex items-center justify-center bg-merqt-indigo-soft text-merqt-indigo-dark text-xs font-semibold flex-shrink-0"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          getInitials(name || 'M')
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-44 bg-merqt-surface border border-merqt-border rounded-card shadow-md overflow-hidden z-50">
          <Link
            href={slug ? `/u/${slug}` : '/settings/profile'}
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-[13.5px] text-merqt-text hover:bg-merqt-bg"
          >
            Your profile
          </Link>
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-[13.5px] text-merqt-text hover:bg-merqt-bg border-t border-merqt-border"
          >
            Edit profile
          </Link>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: '/discover' })}
            className="w-full text-left px-3.5 py-2.5 text-[13.5px] text-merqt-ochre-dark hover:bg-merqt-bg border-t border-merqt-border"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
