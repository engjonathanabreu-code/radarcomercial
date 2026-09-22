import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kickWorkers, startRun } from '@/lib/runs';

export const dynamic = 'force-dynamic';

// Dispara uma rodada manual (todas as cidades ativas ou só as indicadas)
export async function POST(req: Request) {
  const { cityIds, resumeRunId } = await req.json().catch(() => ({}));
  const runId = resumeRunId || (await startRun('manual', cityIds));
  if (!runId) return NextResponse.json({ error: 'Cadastre ao menos uma cidade ativa.' }, { status: 400 });
  await kickWorkers(runId);
  return NextResponse.json({ ok: true, runId });
}

// Status da rodada mais recente (o painel consulta enquanto roda)
export async function GET() {
  const { data: run } = await db().from('runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (!run) return NextResponse.json({ run: null, items: [] });
  const { data: items } = await db().from('run_items').select('status,city_id,error,cities(name)').eq('run_id', run.id);
  return NextResponse.json({ run, items: items || [] });
}
