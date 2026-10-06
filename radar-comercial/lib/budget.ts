// Teto diário de gasto com a IA (tokens + buscas na web), em dólares.
// Cada chamada reserva uma estimativa antes de ir para a Anthropic e registra o custo real depois,
// numa tabela compartilhada por todos os workers (radar_ai_usage). Se a reserva não cabe no teto
// do dia (fuso de Brasília), a chamada não é feita.
import { db } from './db';
import { env } from './env';

export class BudgetExceededError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`Orçamento diário de IA (US$ ${limit.toFixed(2)}) atingido. A pesquisa continua amanhã.`);
    this.name = 'BudgetExceededError';
    this.limit = limit;
  }
}

export function isBudgetError(e: unknown): e is BudgetExceededError {
  return e instanceof BudgetExceededError || (e as any)?.name === 'BudgetExceededError';
}

/** Preço por milhão de tokens (US$), conforme a tabela da Anthropic. */
export function priceFor(model: string): { input: number; output: number } {
  const pin = env.priceInputOverride, pout = env.priceOutputOverride;
  if (pin !== null && pout !== null && Number.isFinite(pin) && Number.isFinite(pout)) {
    return { input: pin, output: pout };
  }
  const m = model.toLowerCase();
  if (m.includes('fable')) return { input: 10, output: 50 };
  if (m.includes('opus-5-5')) return { input: 4, output: 20 };
  if (m.includes('opus')) return { input: 5, output: 25 };
  if (m.includes('haiku-3')) return { input: 0.8, output: 4 };
  if (m.includes('haiku')) return { input: 1, output: 5 };
  if (/sonnet-5/.test(m)) return { input: 2, output: 10 };
  if (m.includes('sonnet')) return { input: 3, output: 15 };
  return { input: 5, output: 25 }; // modelo desconhecido: assume o mais caro comum, para não estourar
}

export const WEB_SEARCH_USD = 0.01; // US$ 10 por 1.000 buscas
/** Tokens de resultado que cada busca costuma acrescentar à entrada (estimativa conservadora). */
export const TOKENS_PER_SEARCH = 8000;

export type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number; searches: number };

export function costOf(model: string, u: Usage): number {
  const p = priceFor(model);
  return (u.input * p.input + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.input * 0.1 + u.output * p.output) / 1e6
    + u.searches * WEB_SEARCH_USD;
}

export function usageFrom(res: any): Usage {
  const u = res?.usage || {};
  return {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    searches: u.server_tool_use?.web_search_requests || 0,
  };
}

/** Estimativa do pior caso de uma chamada: contexto enviado + resultados de busca + saída máxima. */
export function estimate(model: string, promptChars: number, maxTokens: number, maxSearches = 0): number {
  const promptTokens = Math.ceil(promptChars / 3);
  return costOf(model, {
    input: promptTokens + maxSearches * TOKENS_PER_SEARCH,
    output: maxTokens,
    cacheWrite: 0,
    cacheRead: 0,
    searches: maxSearches,
  });
}

export async function spentToday(): Promise<number> {
  const { data, error } = await db().rpc('radar_ia_gasto_hoje');
  if (error) throw new Error('Não foi possível conferir o orçamento de IA: ' + error.message);
  return Number(data || 0);
}

export async function remainingToday(): Promise<number> {
  return Math.max(0, env.dailyBudgetUsd - (await spentToday()));
}

/** Reserva a estimativa no orçamento do dia; lança BudgetExceededError se não couber. */
export async function reserve(kind: string, model: string, estimateUsd: number): Promise<number> {
  const { data, error } = await db().rpc('radar_ia_reservar', {
    p_limite: env.dailyBudgetUsd, p_estimativa: estimateUsd, p_kind: kind, p_model: model,
  });
  if (error) throw new Error('Não foi possível reservar o orçamento de IA: ' + error.message);
  if (data === null || data === undefined) throw new BudgetExceededError(env.dailyBudgetUsd);
  return Number(data);
}

/** Troca a reserva pelo custo real da chamada (ou zero, se a chamada falhou antes de ser cobrada). */
export async function settle(id: number, model: string, usage: Usage | null, status: 'concluido' | 'erro'): Promise<number> {
  const u = usage || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const cost = costOf(model, u);
  const { error } = await db().rpc('radar_ia_registrar', {
    p_id: id, p_input: u.input, p_output: u.output, p_cache_write: u.cacheWrite, p_cache_read: u.cacheRead,
    p_searches: u.searches, p_cost: cost, p_status: status,
  });
  if (error) console.error('Falha ao registrar o custo da IA', error);
  return cost;
}
