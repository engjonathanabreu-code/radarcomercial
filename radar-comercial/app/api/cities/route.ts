import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveIbgeCode } from '@/lib/ibge';
import { startRun, kickWorkers } from '@/lib/runs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const uf = String(body.uf || '').trim().toUpperCase();
  if (!name || !/^(SC|PR|RS)$/.test(uf)) return NextResponse.json({ error: 'Informe o nome e a UF (SC, PR ou RS).' }, { status: 400 });
  const ibge = await resolveIbgeCode(name, uf);
  if (!ibge) return NextResponse.json({ error: `Não encontrei "${name}" na lista do IBGE para ${uf}. Confira a grafia.` }, { status: 400 });
  const { data, error } = await db().from('radar_cities').insert({ name, uf, ibge_code: ibge }).select('*').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Esta cidade já está cadastrada.' : error.message }, { status: 400 });

  // Pesquisa essa cidade imediatamente, sem esperar o cron do dia seguinte.
  const runId = await startRun('manual', [data.id]).catch(() => null);
  if (runId) await kickWorkers(runId, 1);

  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { id, ...fields } = await req.json().catch(() => ({}));
  const allowed = ['active', 'contact_name', 'contact_role', 'contact_email', 'contact_phone', 'notes'];
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  const { error } = await db().from('radar_cities').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const { error } = await db().from('radar_cities').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
