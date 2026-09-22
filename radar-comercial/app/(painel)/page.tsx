import Link from 'next/link';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { latestReports, toView } from '@/lib/views';
import RunPanel from '@/components/RunPanel';
import OppFeed from '@/components/OppFeed';

export default async function RadarPage() {
  const [{ data: run }, { data: cities }, reports, { data: tendersRaw }, { data: recentRaw }] = await Promise.all([
    db().from('runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db().from('cities').select('id,name,uf,active,contact_email').eq('active', true).order('name'),
    latestReports(),
    db().from('opportunities').select('*, cities(name,uf)').eq('kind', 'licitacao').neq('status', 'descartado')
      .gte('deadline_at', new Date().toISOString()).order('deadline_at', { ascending: true }).limit(40),
    db().from('opportunities').select('*, cities(name,uf)')
      .gte('last_seen', new Date(Date.now() - 7 * 86400_000).toISOString())
      .order('score', { ascending: false }).limit(80),
  ]);

  const { data: items } = run
    ? await db().from('run_items').select('status,city_id,error,cities(name)').eq('run_id', run.id)
    : { data: [] as any[] };

  const tenders = (tendersRaw || []).map((o: any) => toView(o));
  const eligible = tenders.filter((t) => t.eligible);
  const tight = tenders.filter((t) => t.eligible === false && (t.bdl ?? -1) >= 0);
  const recent = (recentRaw || []).map((o: any) => toView(o));

  const { data: counts } = await db().from('opportunities').select('city_id,kind,status')
    .neq('status', 'descartado').gte('last_seen', new Date(Date.now() - 30 * 86400_000).toISOString());
  const perCity = new Map<string, { total: number; bairros: number }>();
  for (const c of counts || []) {
    const cur = perCity.get(c.city_id) || { total: 0, bairros: 0 };
    cur.total++; if (c.kind === 'bairro') cur.bairros++;
    perCity.set(c.city_id, cur);
  }
  const ranked = (cities || []).map((c) => ({ ...c, rep: reports.get(c.id) }))
    .sort((a, b) => (b.rep?.report?.temperatura ?? -1) - (a.rep?.report?.temperatura ?? -1));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Radar do dia</h1>
          <p className="lede">Licitações dentro da margem de {env.minMargin} dias úteis, bairros com histórico de irregularidade e sinais de demanda nas prefeituras monitoradas.</p>
        </div>
      </div>

      <section><RunPanel initialRun={run || null} initialItems={(items || []) as any} /></section>

      <section>
        <h2>Licitações para participar</h2>
        {eligible.length === 0 ? (
          <div className="empty"><p>Nenhuma licitação aderente com prazo suficiente agora. O PNCP é consultado a cada pesquisa.</p></div>
        ) : (
          <div className="stakes">
            {eligible.map((t) => (
              <Link key={t.id} href={`/cidade/${t.city_id}`} className={`stake${(t.bdl ?? 0) >= 8 ? ' ok' : ''}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="stake-count num"><b>{t.bdl}</b><span>dias úteis</span></div>
                <div className="stake-body">
                  <span className="small muted">{t.city_name}</span>
                  <h3>{t.title}</h3>
                  <span className="small muted">
                    Até {new Date(t.deadline_at!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                    {!t.deadline_verified && ' — confirmar no edital'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {tight.length > 0 && (
          <p className="notice" style={{ marginTop: 12 }}>
            {tight.length} licitação(ões) aderente(s) com menos de {env.minMargin} dias úteis: {tight.map((t) => `${t.city_name} (${t.bdl} d.u.)`).join(', ')}.
            Ficam registradas porque mostram que a prefeitura compra esse tipo de serviço.
          </p>
        )}
      </section>

      <section>
        <h2>Cidades por temperatura</h2>
        {ranked.length === 0 ? (
          <div className="empty"><p>Cadastre as prefeituras que o agente deve vigiar.</p><Link href="/cidades" className="btn">Cadastrar cidades</Link></div>
        ) : (
          <table className="cities-table">
            <thead><tr><th>Cidade</th><th>Temperatura</th><th className="hide-sm">Achados (30 dias)</th><th className="hide-sm">Próximo passo</th></tr></thead>
            <tbody>
              {ranked.map((c) => {
                const t = c.rep?.report?.temperatura ?? null;
                const pc = perCity.get(c.id);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/cidade/${c.id}`}><strong>{c.name}</strong></Link> <span className="muted">{c.uf}</span>
                      {!c.contact_email && <div className="small muted">sem e-mail de contato</div>}</td>
                    <td>{t === null ? <span className="muted small">aguardando pesquisa</span> : (
                      <div className="heat"><span className="num" style={{ width: 26 }}>{t}</span><div className="heat-bar"><i style={{ width: `${t}%` }} /></div></div>
                    )}</td>
                    <td className="hide-sm num">{pc ? `${pc.total} (${pc.bairros} bairros)` : '—'}</td>
                    <td className="hide-sm small" style={{ maxWidth: 380 }}>{c.rep?.report?.proximo_passo || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Achados da semana</h2>
        <OppFeed items={recent} showCity emptyText="Os achados aparecem aqui depois da primeira pesquisa." />
      </section>
    </>
  );
}
