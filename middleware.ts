import { next } from '@vercel/edge';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(req: Request) {
  const authorization = req.headers.get('authorization');

  if (authorization) {
    const hex = authorization.split(' ')[1];
    const [user, pwd] = atob(hex).split(':');

    if (
      user === process.env.BASIC_AUTH_USER &&
      pwd === process.env.BASIC_AUTH_PASSWORD
    ) {
      return next();
    }
  }

  return new Response('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
