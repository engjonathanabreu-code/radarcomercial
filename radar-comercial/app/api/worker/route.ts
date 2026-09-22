import { NextResponse, after } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { callWorker, processNext } from '@/lib/runs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // uma cidade por invocação

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { runId } = await req.json().catch(() => ({}));
  if (!runId) return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 });

  // Responde na hora e trabalha depois: quem chamou não fica esperando.
  after(async () => {
    const more = await processNext(runId).catch((e) => {
      console.error('worker', e);
      return true;
    });
    if (more) await callWorker(runId);
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
