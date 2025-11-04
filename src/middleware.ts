import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  
  // Example of a protected route, e.g. an admin dashboard for moderation
  const protectedRoutes = ['/admin']; 

  const isProtectedRoute = protectedRoutes.some(path => request.nextUrl.pathname.startsWith(path));

  if (isProtectedRoute && session !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
