import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

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
  for (let turn = 0; turn < 4; turn++) {
    const res: any = await anthropic().messages.create({
      model: opts.model || env.modelResearch,
      max_tokens: opts.maxTokens || 4096,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }] as any,
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: opts.maxSearches,
          user_location: { type: 'approximate', country: 'BR', timezone: 'America/Sao_Paulo' },
        } as any,
      ],
    });

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

    // Resposta cortada por limite de tamanho antes de fechar o JSON. Pedir para "continuar
    // de onde parou" é frágil (o modelo tende a recomeçar do zero, e a colagem dos dois
    // pedaços fica quebrada) — em vez disso, descarta o trecho truncado e pede uma resposta
    // nova e completa, mais direta na prosa de cada campo, sem reduzir as oportunidades.
    if (res.stop_reason === 'max_tokens') {
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: 'Sua resposta foi cortada por limite de tamanho antes de fechar o JSON. Não continue de onde parou: responda de novo, do zero, com um <json>...</json> completo e bem formado, cabendo no limite. Pode ser mais direto e objetivo no texto de cada campo (resumo, por_que_importa, justificativa_temperatura etc.), mas mantenha todas as oportunidades e contatos encontrados — não reduza a quantidade.',
      });
      continue;
    }

    if (text) finalText = text;
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    break;
  }
  return { text: finalText, searches, sources };
}

export async function complete(opts: { system: string; user: string; model?: string; maxTokens?: number }): Promise<string> {
  const res: any = await anthropic().messages.create({
    model: opts.model || env.modelWriting,
    max_tokens: opts.maxTokens || 2000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  return (res.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}
