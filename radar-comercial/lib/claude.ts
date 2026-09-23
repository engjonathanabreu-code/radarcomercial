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

export async function complete(opts: { system: string; user: string; model?: string; maxTokens?: number }): Promise<string> {
  const res: any = await anthropic().messages.create({
    model: opts.model || env.modelWriting,
    max_tokens: opts.maxTokens || 2000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  return (res.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}
