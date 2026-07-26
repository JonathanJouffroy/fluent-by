import { NextResponse } from 'next/server';

export function middleware(request) {
  const hasSession = Boolean(request.cookies.get('session')?.value);
  const path = request.nextUrl.pathname;

  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');
  const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/onboarding');

  if (!hasSession && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Note : le middleware tourne en Edge Runtime, où le SDK Admin (vérification cryptographique
// du cookie) n'est pas disponible. Cette vérification légère ne fait que confirmer la présence
// du cookie ; la vérification complète (validité, expiration) est faite via getSessionUser()
// dans les Server Components et Route Handlers (runtime Node.js).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
