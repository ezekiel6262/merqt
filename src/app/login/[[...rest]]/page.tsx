import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-merqt-bg flex items-center justify-center p-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: 'oklch(0.4 0.1 265)',
            colorBackground: 'oklch(0.995 0.004 70)',
            colorText: 'oklch(0.22 0.015 70)',
            fontFamily: 'var(--font-plex-sans)',
            borderRadius: '6px',
          },
        }}
      />
    </div>
  )
}
