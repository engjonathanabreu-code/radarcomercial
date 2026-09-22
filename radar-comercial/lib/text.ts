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
  for (const c of candidates) {
    try { return JSON.parse(c.trim()) as T; } catch { /* tenta o próximo */ }
  }
  return null;
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
