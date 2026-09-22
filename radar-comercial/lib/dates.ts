// Datas no fuso de Brasília e contagem de dias úteis (feriados nacionais inclusos).
// A margem de licitação é calculada AQUI, nunca pela IA.

const TZ = 'America/Sao_Paulo';

export function todayBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function formatBR(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00-03:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const holidayCache = new Map<number, Set<string>>();
function holidays(year: number): Set<string> {
  if (holidayCache.has(year)) return holidayCache.get(year)!;
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((md) => `${year}-${md}`);
  const e = easter(year);
  const shift = (days: number) => new Date(e.getTime() + days * 86400000).toISOString().slice(0, 10);
  const movable = [shift(-48), shift(-47), shift(-2), shift(60)]; // carnaval (2), sexta santa, corpus christi
  const set = new Set([...fixed, ...movable]);
  holidayCache.set(year, set);
  return set;
}

function isBusinessDay(isoDate: string): boolean {
  const d = new Date(isoDate + 'T12:00:00Z');
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidays(d.getUTCFullYear()).has(isoDate);
}

/** Converte qualquer data/hora para AAAA-MM-DD no fuso de Brasília. */
export function toDateBR(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Data/hora sem fuso (padrão do PNCP) já está em horário local: usa a data como está.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Dias úteis INTEIROS de preparação: conta os dias úteis estritamente entre hoje e o dia do prazo.
 * Ex.: hoje segunda, prazo sexta → ter, qua, qui = 3.
 */
export function businessDaysUntil(deadline: string, from = todayBR()): number | null {
  const end = toDateBR(deadline);
  if (!end) return null;
  if (end <= from) return end === from ? 0 : -1;
  let count = 0;
  const cur = new Date(from + 'T12:00:00Z');
  while (true) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const iso = cur.toISOString().slice(0, 10);
    if (iso >= end) break;
    if (isBusinessDay(iso)) count++;
    if (count > 400) break;
  }
  return count;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayPt(iso = todayBR()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(iso + 'T12:00:00Z'));
}
