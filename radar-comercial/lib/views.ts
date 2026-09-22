import 'server-only';
import { db, type Opportunity } from './db';
import { businessDaysUntil, todayBR } from './dates';
import { env } from './env';
import type { OppView } from '@/components/OppFeed';

export function toView(o: Opportunity & { cities?: { name: string; uf: string } | null }): OppView {
  const bdl = o.kind === 'licitacao' && o.deadline_at ? businessDaysUntil(o.deadline_at, todayBR()) : null;
  return {
    id: o.id, city_id: o.city_id, kind: o.kind, product: o.product, title: o.title, summary: o.summary,
    why_it_matters: o.why_it_matters, suggested_action: o.suggested_action, neighborhood: o.neighborhood,
    source_url: o.source_url, source_name: o.source_name, published_at: o.published_at, deadline_at: o.deadline_at,
    deadline_verified: o.deadline_verified, bdl,
    eligible: o.kind === 'licitacao' ? (bdl === null ? null : bdl >= env.minMargin) : null,
    score: o.score, confidence: o.confidence, status: o.status,
    is_new: Date.now() - new Date(o.first_seen).getTime() < 36 * 3600_000,
    city_name: o.cities ? `${o.cities.name}/${o.cities.uf}` : undefined,
  };
}

export async function latestReports(): Promise<Map<string, { report: any; finished_at: string }>> {
  const { data } = await db().from('run_items').select('city_id,report,finished_at').eq('status', 'done')
    .order('finished_at', { ascending: false }).limit(300);
  const map = new Map<string, { report: any; finished_at: string }>();
  for (const r of data || []) if (!map.has(r.city_id)) map.set(r.city_id, { report: r.report, finished_at: r.finished_at });
  return map;
}
