import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from './lib/auth'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  const path = request.nextUrl.pathname

  const isPublicPath = path === '/login'

  if (!isPublicPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicPath && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Si quisiéramos renovar la sesión en cada request, aquí se llamaría a updateSession
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
