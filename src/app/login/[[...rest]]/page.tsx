import { SignIn } from '@clerk/nextjs'
import { AuthShell } from '@/components/shared/AuthShell'
import { clerkAppearance } from '@/lib/clerkAppearance'

export default function LoginPage() {
  return (
    <AuthShell tagline="Sign in to your account">
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  )
}
