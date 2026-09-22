import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken } from '@/lib/auth';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (!password || password !== env.appPassword) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(env.appPassword, env.authSecret), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
