export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Sessão expirada'); }
  if (!res.ok) {
    const err: any = new Error(json.error || `Erro ${res.status}`);
    err.data = json; err.status = res.status;
    throw err;
  }
  return json as T;
}
