// Descoberta automática de novas cidades: a IA escolhe, entre os municípios de
// SC/PR/RS ainda não monitorados, quais valem entrar no radar — sem perguntar antes.
// Roda uma vez por dia (acoplada à rodada do cron), com teto de custo e de crescimento.
import { db } from './db';
import { env } from './env';
import { complete } from './claude';
import { listMunicipios, resolveIbgeCode } from './ibge';
import { getBriefing } from './settings';
import { discoverySystemPrompt, discoveryUserPrompt } from './prompts';
import { extractJson, normalize } from './text';

const UFS = ['SC', 'PR', 'RS'];

export async function discoverCities(): Promise<{ added: string[] }> {
  const { count: activeCount } = await db().from('radar_cities').select('id', { count: 'exact', head: true }).eq('active', true);
  const slots = env.maxActiveCities - (activeCount ?? 0);
  const perDay = Math.min(env.maxNewCitiesPerDay, slots);
  if (perDay <= 0) return { added: [] };

  const { data: known } = await db().from('radar_cities').select('name,uf');
  const knownSet = new Set((known || []).map((c: any) => `${normalize(c.name)}|${c.uf}`));

  const pool: { nome: string; uf: string }[] = [];
  for (const uf of UFS) {
    const list = await listMunicipios(uf);
    for (const m of list) {
      if (!knownSet.has(`${normalize(m.nome)}|${uf}`)) pool.push({ nome: m.nome, uf });
    }
  }
  if (!pool.length) return { added: [] };

  const briefing = await getBriefing();
  const raw = await complete({
    system: discoverySystemPrompt(briefing),
    user: discoveryUserPrompt(pool, perDay),
    model: env.modelWriting,
    maxTokens: 1200,
  });
  const parsed = extractJson<{ cidades: { nome: string; uf: string; motivo: string }[] }>(raw);
  const picks = (parsed?.cidades || []).slice(0, perDay);

  const added: string[] = [];
  for (const p of picks) {
    const uf = String(p?.uf || '').toUpperCase();
    if (!UFS.includes(uf) || !p?.nome) continue;
    const ibge = await resolveIbgeCode(p.nome, uf);
    if (!ibge) continue;
    const { error } = await db().from('radar_cities').insert({
      name: p.nome,
      uf,
      ibge_code: ibge,
      active: true,
      notes: `Adicionada automaticamente pela IA em ${new Date().toISOString().slice(0, 10)}: ${(p.motivo || '').slice(0, 300)}`,
    });
    if (!error) added.push(`${p.nome}/${uf}`);
  }
  return { added };
}
