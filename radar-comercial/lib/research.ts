// Pipeline de pesquisa de UMA cidade: PNCP → Claude com busca → normalização → banco.
import { db, type City } from './db';
import { env } from './env';
import { resolveIbgeCode } from './ibge';
import { fetchOpenTenders, type Tender } from './pncp';
import { runWithWebSearch } from './claude';
import { researchSystemPrompt, researchUserPrompt } from './prompts';
import { getBriefing } from './settings';
import { businessDaysUntil, todayBR, weekdayPt } from './dates';
import { clamp, extractJson, fingerprint, isEmail, isHttpUrl } from './text';

const KINDS = ['licitacao', 'noticia', 'bairro', 'contato', 'sinal'];
const PRODUCTS = ['reurb', 'software', 'ambos', 'etsa', 'outro'];

export async function researchCity(city: City, runId: string): Promise<{ report: any; searches: number }> {
  // 1. Código IBGE (uma vez por cidade)
  let ibge = city.ibge_code;
  if (!ibge) {
    ibge = await resolveIbgeCode(city.name, city.uf);
    if (ibge) await db().from('radar_cities').update({ ibge_code: ibge }).eq('id', city.id);
  }

  // 2. Licitações oficiais
  const { tenders, ok: pncpOk } = await fetchOpenTenders(ibge);
  const tenderById = new Map<string, Tender>(tenders.map((t) => [t.pncp_id, t]));

  // 3. O que já conhecemos (evita repetição e força a busca de novidades)
  const { data: knownRows } = await db()
    .from('radar_opportunities')
    .select('kind,title,neighborhood')
    .eq('city_id', city.id)
    .neq('status', 'descartado')
    .order('last_seen', { ascending: false })
    .limit(40);

  const today = todayBR();
  const dayIndex = Math.floor(Date.parse(today + 'T12:00:00Z') / 86400000) + city.name.length; // cidades giram ângulos diferentes no mesmo dia
  const briefing = await getBriefing();

  // 4. Claude pesquisa
  const { text, searches, sources } = await runWithWebSearch({
    system: researchSystemPrompt(briefing, env.maxSearches),
    user: researchUserPrompt({
      city, today, weekday: weekdayPt(today), dayIndex, tenders, pncpOk,
      known: (knownRows || []) as any,
    }),
    maxSearches: env.maxSearches,
  });

  const parsed = extractJson<any>(text);
  if (!parsed) throw new Error('A IA não devolveu um JSON válido. Trecho: ' + text.slice(0, 300));

  const sourceUrls = new Set(sources.map((s) => s.url));
  const rows: any[] = [];

  for (const o of Array.isArray(parsed.oportunidades) ? parsed.oportunidades : []) {
    const kind = KINDS.includes(o?.tipo) ? o.tipo : 'sinal';
    const title = String(o?.titulo || '').slice(0, 240);
    if (!title) continue;

    let deadline: string | null = null;
    let deadlineVerified = false;
    let url: string | null = isHttpUrl(o?.fonte_url) ? o.fonte_url : null;
    let sourceName: string | null = o?.fonte_nome || null;
    const extra: any = {
      fonte_citada_na_busca: url ? sourceUrls.has(url) : false,
    };

    // Licitação da lista oficial: prazo e link vêm do PNCP, nunca do modelo.
    const tender = o?.pncp_id ? tenderById.get(String(o.pncp_id)) : undefined;
    if (kind === 'licitacao' && tender) {
      deadline = tender.encerramento;
      deadlineVerified = true;
      url = tender.url;
      sourceName = `PNCP · ${tender.modalidade}`;
      extra.pncp = { id: tender.pncp_id, orgao: tender.orgao, valor: tender.valor, objeto: tender.objeto, abertura: tender.abertura };
    } else if (kind === 'licitacao' && o?.prazo_proposta) {
      deadline = String(o.prazo_proposta);
      deadlineVerified = false; // veio da web: confirmar no edital
    }

    let bdl: number | null = null;
    let eligible: boolean | null = null;
    if (kind === 'licitacao') {
      bdl = deadline ? businessDaysUntil(deadline, today) : null;
      eligible = bdl === null ? null : bdl >= env.minMargin;
    }

    const fp = tender
      ? fingerprint('pncp', tender.pncp_id)
      : fingerprint(city.id, kind, url || '', url ? '' : title);

    rows.push({
      city_id: city.id,
      run_id: runId,
      kind,
      product: PRODUCTS.includes(o?.produto) ? o.produto : null,
      title,
      summary: o?.resumo || null,
      why_it_matters: o?.por_que_importa || null,
      suggested_action: o?.acao_sugerida || null,
      neighborhood: o?.bairro || null,
      source_url: url,
      source_name: sourceName,
      published_at: /^\d{4}-\d{2}-\d{2}$/.test(o?.data_publicacao || '') ? o.data_publicacao : null,
      deadline_at: deadline ? toTimestamp(deadline) : null,
      deadline_verified: deadlineVerified,
      business_days_left: bdl,
      eligible,
      score: clamp(o?.score, 0, 100),
      confidence: ['alta', 'media', 'baixa'].includes(o?.confianca) ? o.confianca : 'media',
      extra,
      fingerprint: fp,
    });
  }

  // 5. Upsert sem apagar o status que você já deu (novo/andamento/descartado)
  for (const row of rows) {
    const { data: existing } = await db().from('radar_opportunities').select('id').eq('fingerprint', row.fingerprint).maybeSingle();
    if (existing) {
      const { run_id, fingerprint: _f, ...updatable } = row;
      await db().from('radar_opportunities').update({ ...updatable, last_seen: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await db().from('radar_opportunities').insert(row);
    }
  }

  // 6. Contatos verificados podem preencher a ficha da cidade (sem sobrescrever o que você digitou)
  const contacts = (Array.isArray(parsed.contatos) ? parsed.contatos : []).filter((c: any) => c && (c.email || c.telefone));
  const best = contacts.find((c: any) => c.verificado && isEmail(c.email));
  if (best && !city.contact_email) {
    await db().from('radar_cities').update({
      contact_email: best.email.trim(),
      contact_name: city.contact_name || best.nome || null,
      contact_role: city.contact_role || best.cargo || null,
      contact_phone: city.contact_phone || best.telefone || null,
    }).eq('id', city.id);
  }

  const report = {
    resumo: parsed.resumo || '',
    temperatura: clamp(parsed.temperatura, 0, 100),
    justificativa_temperatura: parsed.justificativa_temperatura || '',
    proximo_passo: parsed.proximo_passo || '',
    gancho_email: parsed.gancho_email || null,
    contatos: contacts.slice(0, 8),
    pncp_consultado: pncpOk,
    pncp_candidatos: tenders.length,
    oportunidades_registradas: rows.length,
  };
  return { report, searches };
}

function toTimestamp(v: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v + 'T23:59:00-03:00';
  // PNCP devolve horário local sem fuso (ex.: 2026-10-05T09:00:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return v + (v.length === 16 ? ':00' : '') + '-03:00';
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
