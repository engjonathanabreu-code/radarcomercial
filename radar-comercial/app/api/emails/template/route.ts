import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBriefing } from '@/lib/settings';
import { EMAIL_TEMPLATES } from '@/lib/templates';

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export async function POST(req: Request) {
  const { templateKey, cityId } = await req.json().catch(() => ({}));
  const template = EMAIL_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 400 });
  if (!cityId) return NextResponse.json({ error: 'Escolha uma cidade' }, { status: 400 });

  const [{ data: city }, briefing] = await Promise.all([
    db().from('radar_cities').select('*').eq('id', cityId).single(),
    getBriefing(),
  ]);
  if (!city) return NextResponse.json({ error: 'Cidade não encontrada' }, { status: 404 });

  const vars = {
    cidade: city.name,
    uf: city.uf,
    saudacao: city.contact_name ? `${city.contact_name}${city.contact_role ? `, ${city.contact_role}` : ''}` : 'Senhor(a)',
    remetente_nome: briefing.sender_name,
    remetente_cargo: briefing.sender_role,
    empresa: briefing.company_name,
    telefone: briefing.sender_phone || '',
  };

  const subject = fill(template.assunto, vars).slice(0, 140);
  const body = `${fill(template.corpo, vars).trim()}\n\n${briefing.signature}${briefing.sender_phone ? `\n${briefing.sender_phone}` : ''}`;

  const { data: draft, error } = await db()
    .from('radar_email_drafts')
    .insert({
      city_id: city.id,
      opportunity_ids: [],
      intent: templateKey,
      briefing: `Criado a partir do modelo "${template.situacao}".`,
      to_email: city.contact_email,
      subject,
      body,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(draft);
}
