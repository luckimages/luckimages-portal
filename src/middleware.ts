import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_EMAILS } from './lib/constants'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email || '')

  // Admin API routes — 401 JSON, not a redirect (these are fetch() calls, not page loads)
  if (path.startsWith('/api/admin')) {
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return response
  }

  // Dashboard + admin pages — admin only
  if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    if (!isAdmin) return NextResponse.redirect(new URL('/client', request.url))
    return response
  }

  // Not logged in — redirect to login except for public pages
  if (!user && (path.startsWith('/client') || path.startsWith('/photographer') || path === '/choose-portal')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/client/:path*', '/photographer/:path*', '/choose-portal', '/admin/:path*', '/api/admin/:path*'],
}
