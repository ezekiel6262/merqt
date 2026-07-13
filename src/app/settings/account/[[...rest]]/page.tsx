import { UserProfile } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerkAppearance'

export default function AccountSettingsPage() {
  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5 flex justify-center">
      <UserProfile routing="path" path="/settings/account" appearance={{ variables: clerkAppearance.variables }} />
    </div>
  )
}
