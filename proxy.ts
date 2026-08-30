import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const startedAt = Date.now()
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase()

  // The prayer-group domain shares this deployment with GigAxios, but its
  // homepage should render The Whiteboard instead of the GigAxios landing page.
  if (
    pathname === '/' &&
    (hostname === 'theprayerwhiteboard.com' || hostname === 'www.theprayerwhiteboard.com')
  ) {
    return NextResponse.rewrite(new URL('/prayergroup', request.url))
  }

  // Never block public routes — checked here as belt-and-suspenders
  // in addition to the matcher so regex edge cases can't lock users out.
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname === '/api/stripe/webhook' ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname === '/landing' ||
    pathname === '/blog' ||
    pathname.startsWith('/blog/') ||
    pathname === '/prayergroup' ||
    pathname.startsWith('/prayergroup/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json' ||
    pathname.endsWith('.pdf')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const authStartedAt = Date.now()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const authMs = Date.now() - authStartedAt

  if (!user) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
    redirectResponse.headers.set('x-gigaxios-proxy-auth-ms', String(authMs))
    redirectResponse.headers.set('x-gigaxios-proxy-total-ms', String(Date.now() - startedAt))
    return redirectResponse
  }

  response.headers.set('x-gigaxios-proxy-auth-ms', String(authMs))
  response.headers.set('x-gigaxios-proxy-total-ms', String(Date.now() - startedAt))
  return response
}

// Matcher excludes public routes, metadata files, Stripe webhooks, Next.js internals, and static assets.
// The function body also guards /login and /auth/callback explicitly as a second layer.
export const config = {
  matcher: [
    '/((?!login|auth/callback|api/stripe/webhook|privacy|terms|landing$|blog(?:/|$)|prayergroup(?:/|$)|robots\\.txt|sitemap\\.xml|manifest\\.json|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
