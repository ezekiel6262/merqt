import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('sellers')
    .select('*', { count: 'exact', head: true })

  return (
    <main className="p-10">
      <h1 className="text-li-blue text-3xl font-semibold">Merqt</h1>
      <p className="text-li-text-2 mt-1">Your trade, your reputation.</p>
      <div className="mt-6 p-4 bg-white border border-li-border rounded-card inline-block">
        {error ? (
          <span className="text-li-red">Connection error: {error.message}</span>
        ) : (
          <span className="text-li-green">
            Connected to database. Sellers so far: {count}
          </span>
        )}
      </div>
    </main>
  )
}