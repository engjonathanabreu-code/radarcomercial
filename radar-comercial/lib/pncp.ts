// Licitações com recebimento de propostas em aberto, direto da API pública do PNCP.
// Fonte oficial: datas e links vêm daqui, não da IA.
import { addDays, todayBR } from './dates';
import { normalize } from './text';

export type Tender = {
  pncp_id: string;
  objeto: string;
  orgao: string;
  modalidade: string;
  abertura: string | null;
  encerramento: string | null;
  valor: number | null;
  url: string;
};

const MODALIDADES: Record<number, string> = {
  4: 'Concorrência eletrônica',
  5: 'Concorrência presencial',
  6: 'Pregão eletrônico',
  7: 'Pregão presencial',
  8: 'Dispensa',
  12: 'Credenciamento',
};

// Itens claramente fora do escopo (economiza tokens; o resto a IA julga).
const IRRELEVANTES = [
  'medicament', 'hospitalar', 'odontolog', 'merenda', 'genero alimenticio', 'generos alimenticios', 'alimentacao escolar',
  'combustivel', 'pneu', 'uniforme', 'material de limpeza', 'material de expediente', 'material escolar', 'fraldas',
  'oxigenio', 'exame', 'laboratori', 'vacina', 'transporte escolar', 'coleta de lixo', 'residuos solidos',
  'lanche', 'carne', 'hortifruti', 'brinquedo', 'show', 'evento', 'buffet', 'veiculo automotor', 'peca automotiva',
  'pecas automotivas', 'mecanica', 'aquisicao de veiculo', 'asfalto', 'cbuq', 'brita', 'tubos de concreto',
];

function isRelevantCandidate(objeto: string): boolean {
  const n = normalize(objeto);
  return !IRRELEVANTES.some((k) => n.includes(k));
}

async function fetchModalidade(ibge: string, modalidade: number): Promise<any[]> {
  const dataFinal = addDays(todayBR(), 120).replace(/-/g, '');
  const url =
    `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${dataFinal}` +
    `&codigoModalidadeContratacao=${modalidade}&codigoMunicipioIbge=${ibge}&pagina=1&tamanhoPagina=50`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' }, cache: 'no-store' });
    if (res.status === 204 || !res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function fetchOpenTenders(ibge: string | null): Promise<{ tenders: Tender[]; ok: boolean }> {
  if (!ibge) return { tenders: [], ok: false };
  const results = await Promise.all(Object.keys(MODALIDADES).map((m) => fetchModalidade(ibge, Number(m))));
  const seen = new Set<string>();
  const tenders: Tender[] = [];
  results.forEach((list, idx) => {
    const modCode = Number(Object.keys(MODALIDADES)[idx]);
    for (const it of list) {
      const cnpj = it?.orgaoEntidade?.cnpj;
      const ano = it?.anoCompra;
      const seq = it?.sequencialCompra;
      const id = it?.numeroControlePNCP || `${cnpj}-${ano}-${seq}`;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const objeto: string = it?.objetoCompra || '';
      if (!objeto || !isRelevantCandidate(objeto)) continue;
      tenders.push({
        pncp_id: String(id),
        objeto: objeto.slice(0, 400),
        orgao: it?.orgaoEntidade?.razaoSocial || it?.unidadeOrgao?.nomeUnidade || '',
        modalidade: it?.modalidadeNome || MODALIDADES[modCode],
        abertura: it?.dataAberturaProposta || null,
        encerramento: it?.dataEncerramentoProposta || null,
        valor: typeof it?.valorTotalEstimado === 'number' ? it.valorTotalEstimado : null,
        url: cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : it?.linkSistemaOrigem || 'https://pncp.gov.br',
      });
    }
  });
  return { tenders: tenders.slice(0, 60), ok: true };
}
