import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // Not logged in — redirect to login except for public pages
  if (!user && (path.startsWith('/dashboard') || path.startsWith('/client') || path.startsWith('/photographer'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in — redirect away from login/register
  if (user && (path === '/login' || path === '/register')) {
    const role = user.user_metadata?.role || 'realtor'
    if (role === 'admin') return NextResponse.redirect(new URL('/dashboard', request.url))
    if (role === 'photographer') return NextResponse.redirect(new URL('/photographer', request.url))
    return NextResponse.redirect(new URL('/client', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/client/:path*', '/photographer/:path*', '/login', '/register'],
}
