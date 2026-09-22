import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { kickWorkers, startRun } from '@/lib/runs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Chamado pela Vercel Cron (vercel.json) com Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const runId = await startRun('cron');
  if (!runId) return NextResponse.json({ ok: false, reason: 'Nenhuma cidade ativa' });
  await kickWorkers(runId);
  return NextResponse.json({ ok: true, runId });
}
