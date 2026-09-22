import { NextResponse } from 'next/server';
import { draftEmail } from '@/lib/outreach';

export const maxDuration = 120;

export async function POST(req: Request) {
  const { cityId, opportunityIds = [], intent = 'apresentacao', briefing = '' } = await req.json().catch(() => ({}));
  if (!cityId) return NextResponse.json({ error: 'cityId obrigatório' }, { status: 400 });
  try {
    const draft = await draftEmail({ cityId, opportunityIds, intent, briefing });
    return NextResponse.json(draft);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha ao redigir' }, { status: 500 });
  }
}
