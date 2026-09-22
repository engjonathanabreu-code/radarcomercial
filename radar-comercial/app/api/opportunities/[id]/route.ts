import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!['novo', 'em_andamento', 'descartado', 'ganho'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  const { error } = await db().from('opportunities').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
