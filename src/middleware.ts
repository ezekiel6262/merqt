import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPrivateRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/activity(.*)',
  '/onboarding(.*)',
  '/order(.*)',
  '/request(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (isPrivateRoute(req) && !auth().userId) {
    return auth().redirectToSignIn({ returnBackUrl: req.url })
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}