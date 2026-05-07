import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  const protectedPaths = ['/dashboard', '/group', '/onboarding'];
  const isProtected = protectedPaths.some((p) => nextUrl.pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/group/:path*', '/onboarding'],
};
