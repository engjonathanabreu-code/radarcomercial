import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail, smtpConfigured } from '@/lib/mailer';
import { isEmail } from '@/lib/text';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { force } = await req.json().catch(() => ({}));
  if (!smtpConfigured()) return NextResponse.json({ error: 'SMTP não configurado. Preencha SMTP_HOST, SMTP_USER e SMTP_PASS na Vercel.' }, { status: 400 });

  const { data: d } = await db().from('email_drafts').select('*').eq('id', id).single();
  if (!d) return NextResponse.json({ error: 'Rascunho não encontrado' }, { status: 404 });
  if (d.status === 'enviado') return NextResponse.json({ error: 'Este e-mail já foi enviado.' }, { status: 400 });
  if (!isEmail(d.to_email)) return NextResponse.json({ error: 'Informe um destinatário válido antes de enviar.' }, { status: 400 });
  if (!d.subject || !d.body) return NextResponse.json({ error: 'Assunto e corpo são obrigatórios.' }, { status: 400 });

  // Teto diário
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: sentToday } = await db().from('email_drafts').select('id', { count: 'exact', head: true })
    .eq('status', 'enviado').gte('sent_at', since);
  if ((sentToday ?? 0) >= env.maxEmailsPerDay) {
    return NextResponse.json({ error: `Limite de ${env.maxEmailsPerDay} e-mails em 24h atingido. Isso protege a reputação do domínio.` }, { status: 429 });
  }

  // Intervalo mínimo por prefeitura
  if (!force) {
    const cooldownSince = new Date(Date.now() - env.emailCooldownDays * 86400_000).toISOString();
    const { data: recent } = await db().from('email_drafts').select('sent_at').eq('city_id', d.city_id)
      .eq('status', 'enviado').gte('sent_at', cooldownSince).limit(1);
    if (recent?.length) {
      return NextResponse.json({
        error: `Esta prefeitura recebeu um e-mail há menos de ${env.emailCooldownDays} dias.`,
        needsForce: true,
      }, { status: 409 });
    }
  }

  try {
    const messageId = await sendMail({ to: d.to_email.trim(), cc: d.cc, subject: d.subject, text: d.body });
    await db().from('email_drafts').update({ status: 'enviado', sent_at: new Date().toISOString(), message_id: messageId, error: null }).eq('id', id);
    if (d.opportunity_ids?.length) {
      await db().from('opportunities').update({ status: 'em_andamento' }).in('id', d.opportunity_ids).eq('status', 'novo');
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await db().from('email_drafts').update({ error: String(e?.message || e).slice(0, 500) }).eq('id', id);
    return NextResponse.json({ error: `O servidor de e-mail recusou o envio: ${e?.message || e}` }, { status: 502 });
  }
}
