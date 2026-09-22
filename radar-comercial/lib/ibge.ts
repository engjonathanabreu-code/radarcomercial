import { normalize } from './text';

/** Busca o código IBGE de 7 dígitos de um município (necessário para filtrar o PNCP). */
export async function resolveIbgeCode(name: string, uf: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`,
      { signal: AbortSignal.timeout(12000), cache: 'force-cache' }
    );
    if (!res.ok) return null;
    const list: { id: number; nome: string }[] = await res.json();
    const target = normalize(name);
    const hit = list.find((m) => normalize(m.nome) === target);
    return hit ? String(hit.id) : null;
  } catch {
    return null;
  }
}
