import { normalize } from './text';

export type Municipio = { id: number; nome: string };

/** Lista completa de municípios de uma UF (usada para resolver o código IBGE e para a descoberta automática de cidades). */
export async function listMunicipios(uf: string): Promise<Municipio[]> {
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`,
      { signal: AbortSignal.timeout(12000), cache: 'force-cache' }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Busca o código IBGE de 7 dígitos de um município (necessário para filtrar o PNCP). */
export async function resolveIbgeCode(name: string, uf: string): Promise<string | null> {
  const list = await listMunicipios(uf);
  const target = normalize(name);
  const hit = list.find((m) => normalize(m.nome) === target);
  return hit ? String(hit.id) : null;
}
