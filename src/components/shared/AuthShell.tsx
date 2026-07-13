import Link from 'next/link'
import { ReactNode } from 'react'

const STRIPE_BG =
  'repeating-linear-gradient(45deg, oklch(0.92 0.03 265), oklch(0.92 0.03 265) 10px, oklch(0.995 0.004 70) 10px, oklch(0.995 0.004 70) 20px)'

export function AuthShell({ tagline, children }: { tagline: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-merqt-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex flex-col items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-card" style={{ background: STRIPE_BG }} />
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
