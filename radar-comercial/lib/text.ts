import { createHash } from 'crypto';

export function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function fingerprint(...parts: (string | null | undefined)[]): string {
  return createHash('sha1').update(parts.map((p) => normalize(p || '')).join('|')).digest('hex');
}

/** Extrai o JSON final da resposta do modelo (entre <json>…</json>, bloco ``` ou o maior {…}). */
export function extractJson<T = any>(text: string): T | null {
  const candidates: string[] = [];
  const tag = text.match(/<json>([\s\S]*?)<\/json>/i);
  if (tag) candidates.push(tag[1]);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  // Resposta cortada por limite de tokens (sem </json> nem } final): tenta a partir do
  // primeiro '{' até o fim do texto, mesmo incompleta — a etapa de reparo abaixo fecha o resto.
  const openTag = text.match(/<json>([\s\S]*)$/i);
  if (openTag) candidates.push(openTag[1]);
  else if (first >= 0) candidates.push(text.slice(first));

  for (const c of candidates) {
    try { return JSON.parse(c.trim()) as T; } catch { /* tenta o próximo */ }
  }
  // Nenhum candidato é JSON válido de cara: provavelmente foi cortado no meio de uma
  // string ou de um item de lista. Fecha o que ficou pendente e aproveita o que já
  // foi gerado, em vez de descartar a cidade inteira por causa do último item.
  for (const c of candidates) {
    const repaired = repairTruncatedJson(c);
    if (repaired) {
      try { return JSON.parse(repaired) as T; } catch { /* tenta o próximo candidato */ }
    }
  }
  return null;
}

function repairTruncatedJson(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  const s = raw.slice(start).trimEnd();

  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  if (!stack.length && !inString) return null; // já estava fechado — não era truncamento

  let repaired = s;
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, ''); // remove vírgula pendurada antes de fechar
  for (let i = stack.length - 1; i >= 0; i--) repaired += stack[i] === '{' ? '}' : ']';
  return repaired;
}

export function clamp(n: unknown, min: number, max: number, fallback = 0): number {
  const v = Number(n);
  if (isNaN(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function isHttpUrl(u: unknown): u is string {
  return typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u);
}

export function isEmail(e: unknown): e is string {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}
