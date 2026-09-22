import { NextResponse } from 'next/server';
import { saveBriefing } from '@/lib/settings';

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  await saveBriefing(body);
  return NextResponse.json({ ok: true });
}
