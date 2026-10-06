import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';
import { BudgetExceededError, TOKENS_PER_SEARCH, WEB_SEARCH_USD, estimate, priceFor, remainingToday, reserve, settle, usageFrom } from './budget';

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey, maxRetries: 4, timeout: 240_000 });
  return client;
}

export type SearchSource = { url: string; title: string };

/**
 * Executa uma tarefa com a ferramenta de busca na web do Claude.
 * Trata `pause_turn` (a API pausa turnos longos de busca) continuando a conversa.
 */
export async function runWithWebSearch(opts: {
  system: string;
  user: string;
  maxSearches: number;
  model?: string;
  maxTokens?: number;
}): Promise<{ text: string; searches: number; sources: SearchSource[] }> {
  const messages: any[] = [{ role: 'user', content: opts.user }];
  let searches = 0;
  const sources: SearchSource[] = [];
  let finalText = '';

  // Cada turno reenvia todo o histórico (buscas incluídas), então poucos turnos bastam —
  // mais que isso só multiplica o custo de entrada sem trazer achados novos.
  const model = opts.model || env.modelResearch;
  const maxTokens = opts.maxTokens || 4096;
  for (let turn = 0; turn < 4; turn++) {
    // Orçamento diário: cabe quantas buscas ainda? Sem orçamento para ao menos uma, a cidade fica para amanhã;
    // numa continuação, devolve o que já foi apurado em vez de gastar além do teto.
    const promptChars = opts.system.length + JSON.stringify(messages).length;
    const left = Math.max(0, opts.maxSearches - searches);
    const remaining = await remainingToday();
    const base = estimate(model, promptChars, maxTokens, 0);
    const perSearch = WEB_SEARCH_USD + (TOKENS_PER_SEARCH * priceFor(model).input) / 1e6;
    // Começar uma cidade com menos de 2 buscas daria uma pesquisa rasa: melhor deixá-la para amanhã.
    if (turn === 0 && Math.floor((remaining - base) / perSearch) < Math.min(2, opts.maxSearches)) {
      throw new BudgetExceededError(env.dailyBudgetUsd);
    }
    // A API exige ao menos 1 uso da ferramenta; a reserva cobre esse mínimo.
    const maxUses = Math.max(1, Math.min(Math.max(left, 1), Math.floor((remaining - base) / perSearch)));
    let reservation: number;
    try {
      reservation = await reserve('pesquisa', model, estimate(model, promptChars, maxTokens, maxUses));
    } catch (e) {
      if (turn === 0) throw e; // sem orçamento nem para começar: a cidade fica para amanhã
      break;                   // continuação: devolve o que já foi apurado em vez de passar do teto
    }
    let res: any;
    try {
      res = await anthropic().messages.create({
        model,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }] as any,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: maxUses,
            user_location: { type: 'approximate', country: 'BR', timezone: 'America/Sao_Paulo' },
          } as any,
        ],
      });
    } catch (e) {
      await settle(reservation, model, null, 'erro');
      throw e;
    }
    await settle(reservation, model, usageFrom(res), 'concluido');

    searches += res.usage?.server_tool_use?.web_search_requests || 0;
    for (const block of res.content || []) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r?.url) sources.push({ url: r.url, title: r.title || r.url });
      }
    }
    // A ferramenta de busca às vezes anota o texto com <cite index="...">...</cite> em volta de
    // trechos citados; isso quebra o JSON quando cai dentro de um campo. Mantém o conteúdo, remove só a tag.
    const text = (res.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .replace(/<\/?cite[^>]*>/g, '');

    if (text) finalText = text;
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    // stop_reason === 'max_tokens' (resposta cortada antes de fechar o JSON) também cai aqui:
    // pedir para refazer do zero custaria caro (reenvia todo o histórico de busca) e é frágil.
    // extractJson (lib/text.ts) sabe fechar strings/colchetes pendentes e aproveitar o que já
    // foi gerado, em vez de descartar a cidade inteira por causa do último item cortado.
    break;
  }
  return { text: finalText, searches, sources };
}

export async function complete(opts: { system: string; user: string; model?: string; maxTokens?: number; kind?: string }): Promise<string> {
  const model = opts.model || env.modelWriting;
  const maxTokens = opts.maxTokens || 2000;
  const reservation = await reserve(opts.kind || 'redacao', model, estimate(model, opts.system.length + opts.user.length, maxTokens));
  let res: any;
  try {
    res = await anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    });
  } catch (e) {
    await settle(reservation, model, null, 'erro');
    throw e;
  }
  await settle(reservation, model, usageFrom(res), 'concluido');
  return (res.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}
