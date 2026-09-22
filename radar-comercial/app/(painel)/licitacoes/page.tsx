import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { toView } from '@/lib/views';
import OppFeed from '@/components/OppFeed';

export const dynamic = 'force-dynamic';

export default async function LicitacoesPage() {
  const { data } = await db()
    .from('radar_opportunities')
    .select('*, cities:radar_cities(name,uf)')
    .eq('kind', 'licitacao')
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .limit(200);

  const items = (data || []).map((o: any) => toView(o));
  const eligible = items.filter((t) => t.eligible).length;
  const tight = items.filter((t) => t.eligible === false && (t.bdl ?? -1) >= 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Licitações</h1>
          <p className="lede">
            Todas as licitações aderentes ao objeto do sistema — REURB, ETSA, topografia, georreferenciamento,
            cadastro técnico, plano diretor, habitação e assessoria de engenharia — encontradas nas cidades
            monitoradas. Prazo e link vêm do PNCP quando disponível; margem de {env.minMargin} dias úteis.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty"><p>Nenhuma licitação encontrada ainda. Elas aparecem aqui conforme as pesquisas diárias rodam (PNCP + web).</p></div>
      ) : (
        <>
          <p className="small muted" style={{ marginTop: -8, marginBottom: 16 }}>
            {items.length} licitação(ões) rastreada(s) · {eligible} dentro da margem · {tight} fora da margem
          </p>
          <OppFeed items={items} showCity emptyText="Nenhuma licitação nesta visão." />
        </>
      )}
    </>
  );
}
