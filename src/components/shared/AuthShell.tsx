import Link from 'next/link'
import { ReactNode } from 'react'

export function AuthShell({ tagline, children }: { tagline: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-merqt-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex flex-col items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Merqt" width={44} height={44} />
          <div className="text-center">
            <span className="font-serif text-2xl font-semibold text-merqt-indigo">Merqt</span>
            <p className="text-sm text-merqt-text-muted mt-1">{tagline}</p>
          </div>
        </Link>
        {children}
      </div>
    </div>
  )
}
