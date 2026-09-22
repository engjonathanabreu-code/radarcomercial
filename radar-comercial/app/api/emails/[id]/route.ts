import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => ['to_email', 'cc', 'subject', 'body'].includes(k)));
  const { error } = await db().from('email_drafts').update(update).eq('id', id).eq('status', 'rascunho');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await db().from('email_drafts').delete().eq('id', id).neq('status', 'enviado');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
