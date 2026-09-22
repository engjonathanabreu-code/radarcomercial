import { db } from './db';
import { complete } from './claude';
import { EMAIL_INTENTS, emailSystemPrompt } from './prompts';
import { getBriefing } from './settings';
import { extractJson } from './text';
import { formatBR, todayBR, weekdayPt, addDays } from './dates';
import { env } from './env';

export async function draftEmail(args: { cityId: string; opportunityIds: string[]; intent: string; briefing: string }) {
  const [{ data: city }, { data: opps }, { data: lastItem }, { data: history }, b] = await Promise.all([
    db().from('radar_cities').select('*').eq('id', args.cityId).single(),
    args.opportunityIds.length
      ? db().from('radar_opportunities').select('*').in('id', args.opportunityIds)
      : Promise.resolve({ data: [] as any[] }),
    db().from('radar_run_items').select('report').eq('city_id', args.cityId).eq('status', 'done')
      .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    db().from('radar_email_drafts').select('subject,sent_at,intent').eq('city_id', args.cityId).eq('status', 'enviado')
      .order('sent_at', { ascending: false }).limit(5),
    getBriefing(),
  ]);
  if (!city) throw new Error('Cidade não encontrada');

  const today = todayBR();
  const context = (opps || []).map((o: any) =>
    `- [${o.kind}] ${o.title}${o.neighborhood ? ` | bairro: ${o.neighborhood}` : ''}` +
    `${o.summary ? ` | ${o.summary}` : ''}${o.published_at ? ` | publicado em ${formatBR(o.published_at)}` : ''}` +
    `${o.kind === 'licitacao' && o.deadline_at ? ` | propostas até ${formatBR(o.deadline_at, true)}` : ''}` +
    `${o.source_name ? ` | fonte: ${o.source_name}` : ''}`
  ).join('\n');

  const user = `Município: ${city.name}/${city.uf}
Destinatário: ${city.contact_name ? `${city.contact_name}${city.contact_role ? `, ${city.contact_role}` : ''}` : 'setor responsável (nome desconhecido — use saudação institucional)'}
Hoje: ${weekdayPt(today)}, ${formatBR(today)}. Se sugerir datas de reunião, use dias úteis entre ${formatBR(addDays(today, 3))} e ${formatBR(addDays(today, 12))}, escritos por extenso (ex.: "terça-feira, 6 de outubro").

Objetivo do e-mail: ${EMAIL_INTENTS[args.intent] || args.intent}
${args.briefing ? `Instruções do Jonathan para este e-mail (prioridade máxima): ${args.briefing}` : ''}

Contexto local selecionado:
${context || '(nenhum achado selecionado — use apenas o resumo abaixo)'}

Resumo do analista sobre a cidade: ${lastItem?.report?.resumo || 'n/d'}
Gancho sugerido: ${lastItem?.report?.gancho_email || 'n/d'}

Contatos anteriores já enviados: ${(history || []).map((h: any) => `${formatBR(h.sent_at)} "${h.subject}"`).join('; ') || 'nenhum'}`;

  const raw = await complete({ system: emailSystemPrompt(b), user, model: env.modelWriting });
  const parsed = extractJson<{ assunto: string; corpo: string; observacoes_para_jonathan?: string }>(raw);
  if (!parsed?.corpo) throw new Error('A IA não devolveu o e-mail no formato esperado.');

  const body = `${parsed.corpo.trim()}\n\n${b.signature}${b.sender_phone ? `\n${b.sender_phone}` : ''}`;
  const { data: draft, error } = await db().from('radar_email_drafts').insert({
    city_id: city.id,
    opportunity_ids: args.opportunityIds,
    intent: args.intent,
    briefing: [args.briefing, parsed.observacoes_para_jonathan ? `Checar antes de enviar: ${parsed.observacoes_para_jonathan}` : '']
      .filter(Boolean).join('\n\n'),
    to_email: city.contact_email,
    subject: parsed.assunto?.slice(0, 140) || `Regularização fundiária em ${city.name}`,
    body,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return draft;
}
