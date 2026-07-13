import { notFound } from 'next/navigation'
import Link from 'next/link'
import { currentUserIsAdmin } from '@/lib/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUserIsAdmin())) notFound()

  return (
    <div>
      <div className="bg-merqt-surface border-b border-merqt-border">
        <div className="max-w-2xl mx-auto px-5 h-11 flex items-center gap-4">
          <Link href="/admin/verifications" className="text-[13px] font-semibold text-merqt-text-muted hover:text-merqt-text">
            Verifications
          </Link>
          <Link href="/admin/reviews" className="text-[13px] font-semibold text-merqt-text-muted hover:text-merqt-text">
            Reviews
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
