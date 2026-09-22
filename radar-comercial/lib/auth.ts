// Autenticação simples por senha única (cookie assinado). Funciona no Edge e no Node.
export const SESSION_COOKIE = 'integral_session';

export async function sessionToken(password: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}::${secret}::agente-comercial`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
