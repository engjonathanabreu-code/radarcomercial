// Orquestração da rodada diária.
// Cada cidade roda numa invocação serverless própria (cabe no limite de tempo da Vercel):
// o worker processa uma cidade e chama o próximo worker, formando uma cadeia.
import { db, type City } from './db';
import { env } from './env';
import { researchCity } from './research';
import { sendMail, smtpConfigured } from './mailer';
import { formatBR, todayBR } from './dates';
import { discoverCities } from './discovery';
import { getBriefing } from './settings';
import { complete } from './claude';
import { runSummarySystemPrompt, runSummaryUserPrompt } from './prompts';
import { extractJson } from './text';

export async function startRun(trigger: 'cron' | 'manual', cityIds?: string[]): Promise<string | null> {
  // Evita rodadas duplicadas: se há uma em andamento com menos de 3h, reaproveita.
  const { data: running } = await db()
    .from('radar_runs').select('id,started_at').eq('status', 'running')
    .gte('started_at', new Date(Date.now() - 3 * 3600_000).toISOString())
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (running && !cityIds) return running.id;

  // Rodada automática do cron: antes de selecionar as cidades, a IA pode incluir
  // novos municípios de SC/PR/RS que ainda não estão monitorados (com teto de custo).
  if (trigger === 'cron' && !cityIds) {
    await discoverCities().catch((e) => console.error('Falha na descoberta automática de cidades', e));
  }

  let q = db().from('radar_cities').select('id').eq('active', true);
  if (cityIds?.length) q = q.in('id', cityIds);
  const { data: cities } = await q;
  if (!cities?.length) return null;

  const { data: run, error } = await db().from('radar_runs').insert({ trigger }).select('id').single();
  if (error || !run) throw new Error(error?.message || 'Falha ao criar rodada');
  await db().from('radar_run_items').insert(cities.map((c) => ({ run_id: run.id, city_id: c.id })));
  return run.id;
}

export async function kickWorkers(runId: string, n = env.concurrency): Promise<void> {
  await Promise.all(Array.from({ length: n }, () => callWorker(runId)));
}

export async function callWorker(runId: string): Promise<void> {
  try {
    await fetch(`${env.appUrl}/api/worker`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.cronSecret}` },
      body: JSON.stringify({ runId }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.error('Falha ao acionar worker', e);
  }
}

/** Processa a próxima cidade da fila. Retorna true se ainda houver trabalho. */
export async function processNext(runId: string): Promise<boolean> {
  const { data: claimed, error } = await db().rpc('radar_claim_next_item', { p_run_id: runId });
  if (error) throw new Error(error.message);
  const item = Array.isArray(claimed) ? claimed[0] : null;
  if (!item) {
    await finalizeIfDone(runId);
    return false;
  }

  // Teto diário de buscas: corta o restante da rodada em vez de deixar o custo crescer sem limite.
  const usedSearches = await searchesUsedInRun(runId);
  if (usedSearches >= env.maxSearchesPerDay) {
    await db().from('radar_run_items').update({
      status: 'error',
      error: `Orçamento diário de buscas (${env.maxSearchesPerDay}) atingido nesta rodada. Esta cidade fica para a próxima pesquisa.`,
      finished_at: new Date().toISOString(),
    }).eq('id', item.id);
    return true;
  }

  const { data: city } = await db().from('radar_cities').select('*').eq('id', item.city_id).single();
  try {
    const { report, searches } = await researchCity(city as City, runId);
    await db().from('radar_run_items').update({
      status: 'done', report, searches, finished_at: new Date().toISOString(), error: null,
    }).eq('id', item.id);
  } catch (e: any) {
    console.error(`Erro pesquisando ${city?.name}:`, e);
    const retry = item.attempts < 2;
    await db().from('radar_run_items').update({
      status: retry ? 'pending' : 'error',
      error: String(e?.message || e).slice(0, 1000),
      finished_at: retry ? null : new Date().toISOString(),
    }).eq('id', item.id);
  }
  return true;
}

async function searchesUsedInRun(runId: string): Promise<number> {
  const { data } = await db().from('radar_run_items').select('searches').eq('run_id', runId).eq('status', 'done');
  return (data || []).reduce((sum, r: any) => sum + (r.searches || 0), 0);
}

async function finalizeIfDone(runId: string): Promise<void> {
  const { count } = await db().from('radar_run_items').select('id', { count: 'exact', head: true })
    .eq('run_id', runId).in('status', ['pending', 'running']);
  if ((count ?? 0) > 0) return;

  // Só uma cadeia consegue fechar a rodada
  const { data: closed } = await db().from('radar_runs')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', runId).eq('status', 'running').select('id');
  if (!closed?.length) return;

  // Resumo executivo exibido no painel (não depende de e-mail configurado).
  try {
    const summary = await generateRunSummary(runId);
    if (summary) await db().from('radar_runs').update({ summary }).eq('id', runId);
  } catch (e) {
    console.error('Falha ao gerar o resumo da rodada', e);
  }

  if (env.reportEmail && smtpConfigured()) {
    try {
      await sendDigest(runId);
      await db().from('radar_runs').update({ digest_sent: true }).eq('id', runId);
    } catch (e) {
      console.error('Falha no relatório por e-mail', e);
    }
  }
}

async function generateRunSummary(runId: string): Promise<{ resumo: string; destaques: string[] } | null> {
  const { data: run } = await db().from('radar_runs').select('started_at').eq('id', runId).single();
  const { data: opps } = await db()
    .from('radar_opportunities')
    .select('title,kind,score,eligible,business_days_left,neighborhood,cities:radar_cities(name,uf)')
    .gte('first_seen', run!.started_at)
    .neq('status', 'descartado')
    .order('score', { ascending: false })
    .limit(60);

  const list = (opps || []) as any[];
  if (!list.length) return { resumo: 'Nenhum achado novo relevante nesta rodada.', destaques: [] };

  const raw = await complete({
    system: runSummarySystemPrompt(await getBriefing()),
    user: runSummaryUserPrompt({ date: todayBR(), opps: list }),
    model: env.modelWriting,
    maxTokens: 700,
  });
  return extractJson(raw);
}

async function sendDigest(runId: string): Promise<void> {
  const { data: run } = await db().from('radar_runs').select('started_at').eq('id', runId).single();
  const { data: opps } = await db()
    .from('radar_opportunities')
    .select('title,kind,score,eligible,business_days_left,deadline_at,neighborhood,source_url,cities:radar_cities(name,uf)')
    .gte('first_seen', run!.started_at)
    .neq('status', 'descartado')
    .order('score', { ascending: false })
    .limit(40);

  const list = (opps || []) as any[];
  const tenders = list.filter((o) => o.kind === 'licitacao' && o.eligible);
  const rest = list.filter((o) => !(o.kind === 'licitacao')).filter((o) => o.score >= 50).slice(0, 20);

  const line = (o: any) =>
    `<li style="margin-bottom:8px"><b>${o.cities?.name}/${o.cities?.uf}</b> — ${escape(o.title)}` +
    `${o.neighborhood ? ` <i>(${escape(o.neighborhood)})</i>` : ''} · score ${o.score}` +
    `${o.kind === 'licitacao' ? ` · encerra ${formatBR(o.deadline_at, true)} (${o.business_days_left} dias úteis)` : ''}` +
    `${o.source_url ? ` · <a href="${o.source_url}">fonte</a>` : ''}</li>`;

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2a2b;max-width:680px">
  <h2 style="margin:0 0 4px">Radar comercial — ${formatBR(run!.started_at)}</h2>
  <p style="margin:0 0 16px;color:#5b6b6c">${list.length} achados novos · ${tenders.length} licitações dentro da margem</p>
  ${tenders.length ? `<h3>Licitações para participar</h3><ul>${tenders.map(line).join('')}</ul>` : ''}
  ${rest.length ? `<h3>Oportunidades e bairros</h3><ul>${rest.map(line).join('')}</ul>` : '<p>Nenhum achado forte hoje.</p>'}
  <p><a href="${env.appUrl}">Abrir o painel</a></p></div>`;

  await sendMail({
    to: env.reportEmail,
    subject: `Radar comercial: ${tenders.length} licitações, ${rest.length} oportunidades`,
    text: `Relatório disponível em ${env.appUrl}`,
    html,
    bcc: null,
  });
}

function escape(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
