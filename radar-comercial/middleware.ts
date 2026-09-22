import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionToken } from './lib/auth';

// Rotas que se autenticam sozinhas (cron e worker usam CRON_SECRET)
const PUBLIC = ['/login', '/api/login', '/api/cron', '/api/worker'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const pwd = process.env.APP_PASSWORD, secret = process.env.AUTH_SECRET;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (pwd && secret && cookie && cookie === (await sessionToken(pwd, secret))) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
