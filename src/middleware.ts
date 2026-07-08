import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/register(.*)',
  '/store(.*)',
  '/explore(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()
  if (!auth().userId) {
    return auth().redirectToSignIn({ returnBackUrl: req.url })
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}