'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api } from './api';

export type OppView = {
  id: string; city_id: string; kind: string; product: string | null; title: string; summary: string | null;
  why_it_matters: string | null; suggested_action: string | null; neighborhood: string | null;
  source_url: string | null; source_name: string | null; published_at: string | null; deadline_at: string | null;
  deadline_verified: boolean; bdl: number | null; eligible: boolean | null; score: number; confidence: string | null;
  status: string; is_new: boolean; city_name?: string;
};

const KIND_LABEL: Record<string, string> = { licitacao: 'Licitação', bairro: 'Bairro-alvo', noticia: 'Notícia', sinal: 'Sinal', contato: 'Contato' };
const PRODUCT_LABEL: Record<string, string> = { reurb: 'REURB', software: 'Software', ambos: 'REURB + software', etsa: 'ETSA', outro: 'Outro' };
const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'licitacao', label: 'Licitações' },
  { key: 'bairro', label: 'Bairros-alvo' },
  { key: 'noticia', label: 'Notícias e sinais' },
  { key: 'descartado', label: 'Descartados' },
];

function fmtDate(iso: string | null, time = false) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00-03:00' : iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', ...(time ? { timeStyle: 'short' } : {}) });
}

export default function OppFeed({
  items, showCity = false, selectable = false, selected = [], onToggle, emptyText,
}: {
  items: OppView[]; showCity?: boolean; selectable?: boolean; selected?: string[];
  onToggle?: (id: string) => void; emptyText?: string;
}) {
  const [filter, setFilter] = useState('todos');
  const [local, setLocal] = useState<Record<string, string>>({});

  const list = useMemo(() => {
    const withStatus = items.map((o) => ({ ...o, status: local[o.id] || o.status }));
    return withStatus.filter((o) => {
      if (filter === 'descartado') return o.status === 'descartado';
      if (o.status === 'descartado') return false;
      if (filter === 'todos') return true;
      if (filter === 'noticia') return o.kind === 'noticia' || o.kind === 'sinal' || o.kind === 'contato';
      return o.kind === filter;
    });
  }, [items, filter, local]);

  async function setStatus(id: string, status: string) {
    setLocal((s) => ({ ...s, [id]: status }));
    try { await api(`/api/opportunities/${id}`, 'PATCH', { status }); }
    catch { setLocal((s) => { const n = { ...s }; delete n[id]; return n; }); }
  }

  return (
    <div>
      <div className="filters" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key}
            className={filter === f.key ? '' : 'secondary'} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {list.length === 0 && <div className="empty"><p>{emptyText || 'Nada nesta visão por enquanto.'}</p></div>}
      {list.map((o) => {
        const isSel = selected.includes(o.id);
        const late = o.kind === 'licitacao' && o.eligible === false;
        return (
          <article key={o.id} className={`opp${isSel ? ' selected' : ''}${o.status === 'descartado' ? ' discarded' : ''}`}>
            <div>
              {selectable ? (
                <input type="checkbox" aria-label="Usar no e-mail" checked={isSel} onChange={() => onToggle?.(o.id)} style={{ width: 18, height: 18, marginTop: 3 }} />
              ) : <span style={{ display: 'block', width: 0 }} />}
            </div>
            <div>
              <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                <span className={`tag ${o.kind}`}>{KIND_LABEL[o.kind] || o.kind}</span>
                {o.product && <span className="tag">{PRODUCT_LABEL[o.product] || o.product}</span>}
                {o.is_new && <span className="tag new">Novo</span>}
                {late && <span className="tag late">Fora da margem</span>}
                {o.status === 'em_andamento' && <span className="tag bairro">Em andamento</span>}
                {o.status === 'ganho' && <span className="tag bairro">Ganho</span>}
              </div>
              <h3>
                {showCity && o.city_name && <Link href={`/cidade/${o.city_id}`}>{o.city_name}: </Link>}
                {o.title}
              </h3>
              {o.summary && <p>{o.summary}</p>}
              {o.why_it_matters && <p className="muted">{o.why_it_matters}</p>}
              {o.suggested_action && <p><strong>Próximo passo:</strong> {o.suggested_action}</p>}
              <div className="meta">
                {o.neighborhood && <span>Bairro: {o.neighborhood}</span>}
                {o.kind === 'licitacao' && o.deadline_at && (
                  <span className="num">
                    Propostas até {fmtDate(o.deadline_at, true)}
                    {o.bdl !== null && o.bdl >= 0 ? ` (${o.bdl} dias úteis)` : ''}
                    {!o.deadline_verified && ' — confirmar no edital'}
                  </span>
                )}
                {o.published_at && <span>Publicado em {fmtDate(o.published_at)}</span>}
                {o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer">{o.source_name || 'Fonte'}</a>}
                {o.confidence === 'baixa' && <span>Confiança baixa</span>}
              </div>
              <div className="row" style={{ gap: 4, marginTop: 8 }}>
                {o.status !== 'em_andamento' && o.status !== 'descartado' && <button className="ghost" onClick={() => setStatus(o.id, 'em_andamento')}>Marcar em andamento</button>}
                {o.status !== 'ganho' && o.status !== 'descartado' && <button className="ghost" onClick={() => setStatus(o.id, 'ganho')}>Marcar como ganho</button>}
                {o.status !== 'descartado'
                  ? <button className="ghost" onClick={() => setStatus(o.id, 'descartado')}>Descartar</button>
                  : <button className="ghost" onClick={() => setStatus(o.id, 'novo')}>Restaurar</button>}
              </div>
            </div>
            <div className="score num">{o.score}<small>score</small></div>
          </article>
        );
      })}
    </div>
  );
}
