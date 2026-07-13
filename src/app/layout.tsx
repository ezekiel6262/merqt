import { Navbar } from '@/components/shared/Navbar'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-source-serif',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Merqt - Your trade, your reputation',
  description: 'Discover trusted sellers across Nigeria.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}>
        <body>
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
