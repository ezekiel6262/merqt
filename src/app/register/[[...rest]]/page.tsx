import { SignUp } from '@clerk/nextjs'
import { AuthShell } from '@/components/shared/AuthShell'
import { clerkAppearance } from '@/lib/clerkAppearance'

export default function RegisterPage() {
  return (
    <AuthShell tagline="Join the trade network">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  )
}
