import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { toView } from '@/lib/views';
import CityWorkspace from '@/components/CityWorkspace';

export default async function CityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: city } = await db().from('cities').select('*').eq('id', id).maybeSingle();
  if (!city) notFound();

  const [{ data: last }, { data: opps }, { data: drafts }] = await Promise.all([
    db().from('run_items').select('report,finished_at,searches').eq('city_id', id).eq('status', 'done')
      .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    db().from('opportunities').select('*').eq('city_id', id).order('score', { ascending: false }).limit(150),
    db().from('email_drafts').select('*').eq('city_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const r = last?.report;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}><Link href="/">Radar</Link> / {city.uf}</p>
          <h1>{city.name}</h1>
          {last && <p className="lede small">Pesquisado em {new Date(last.finished_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}, {last.searches} buscas na web.</p>}
        </div>
        {r && (
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontStretch: '70%', fontWeight: 700, fontSize: 56, lineHeight: 1 }}>{r.temperatura}</div>
            <div className="small muted">temperatura comercial</div>
          </div>
        )}
      </div>

      {r ? (
        <section className="panel">
          <p className="summary-text">{r.resumo}</p>
          {r.justificativa_temperatura && <p className="muted small">{r.justificativa_temperatura}</p>}
          {r.proximo_passo && <p style={{ marginBottom: 0 }}><strong>Melhor movimento agora:</strong> {r.proximo_passo}</p>}
          {r.contatos?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3>Contatos encontrados na pesquisa</h3>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {r.contatos.map((c: any, i: number) => (
                  <li key={i}>
                    {[c.nome, c.cargo, c.orgao].filter(Boolean).join(', ')}{c.email ? ` — ${c.email}` : ''}{c.telefone ? ` — ${c.telefone}` : ''}
                    {!c.verificado && <em className="muted"> (não verificado)</em>}
                    {c.fonte_url && <> <a href={c.fonte_url} target="_blank" rel="noreferrer">fonte</a></>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.pncp_consultado === false && <p className="notice" style={{ marginBottom: 0 }}>O PNCP não respondeu nesta pesquisa; licitações vieram apenas da web.</p>}
        </section>
      ) : (
        <section className="empty"><p>Esta cidade ainda não foi pesquisada. Rode uma pesquisa no Radar.</p></section>
      )}

      <CityWorkspace city={city} opps={(opps || []).map((o: any) => toView(o))} drafts={(drafts || []) as any} />
    </>
  );
}
