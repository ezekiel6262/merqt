import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'

export default async function Home() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('sellers')
    .select('*', { count: 'exact', head: true })

  return (
    <main className="min-h-[calc(100vh-56px)] bg-merqt-bg flex items-center">
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-serif text-5xl font-semibold text-merqt-text leading-tight mb-4">
          Your trade, your reputation.
        </h1>
        <p className="text-merqt-text-muted text-base leading-relaxed max-w-xl mx-auto mb-8">
          Merqt is a trade profile and marketplace for African commerce. Sellers list products
          and services under one identity. Reputation is earned through real completed orders,
          not self-reported claims.
        </p>

        <div className="flex items-center justify-center gap-3 mb-10">
          <Link href="/discover">
            <Button variant="primary" size="lg">Browse Discover</Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="ghost" size="lg">Become a seller</Button>
          </Link>
        </div>

        <div className="inline-block bg-merqt-surface border border-merqt-border rounded-card px-4 py-2.5">
          {error ? (
            <span className="text-sm text-merqt-ochre-dark">Connection error: {error.message}</span>
          ) : (
            <span className="text-sm text-merqt-success-dark font-medium">
              {count} sellers already trading on Merqt
            </span>
          )}
        </div>
      </div>
    </main>
  )
}
