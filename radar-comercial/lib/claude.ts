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

  for (let turn = 0; turn < 12; turn++) {
    const res: any = await anthropic().messages.create({
      model: opts.model || env.modelResearch,
      max_tokens: opts.maxTokens || 8192,
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
    const text = (res.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');

    // Resposta cortada por limite de tamanho antes de fechar o JSON: pede pra continuar
    // exatamente de onde parou, em vez de descartar tudo e falhar a cidade.
    if (res.stop_reason === 'max_tokens') {
      finalText += text;
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: 'Sua resposta foi cortada por limite de tamanho antes de fechar o JSON. Continue exatamente de onde parou, sem repetir o que já foi escrito, até fechar </json> corretamente.',
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
