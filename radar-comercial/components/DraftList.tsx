'use client';
import { useState } from 'react';
import DraftEditor, { type Draft } from './DraftEditor';

export default function DraftList({ drafts }: { drafts: Draft[] }) {
  const [tab, setTab] = useState<'rascunho' | 'enviado'>('rascunho');
  const [list, setList] = useState(drafts);
  const shown = list.filter((d) => (tab === 'enviado' ? d.status === 'enviado' : d.status !== 'enviado'));
  return (
    <>
      <div className="filters">
        <button className={tab === 'rascunho' ? '' : 'secondary'} onClick={() => setTab('rascunho')}>Rascunhos ({list.filter((d) => d.status !== 'enviado').length})</button>
        <button className={tab === 'enviado' ? '' : 'secondary'} onClick={() => setTab('enviado')}>Enviados ({list.filter((d) => d.status === 'enviado').length})</button>
      </div>
      {shown.length === 0 && <div className="empty"><p>{tab === 'rascunho' ? 'Nenhum rascunho. Abra uma cidade no Radar e gere um e-mail.' : 'Nenhum e-mail enviado ainda.'}</p></div>}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
        {shown.map((d) => (
          <DraftEditor key={d.id} draft={d} onChange={(nd) => setList((all) => (nd ? all.map((x) => (x.id === nd.id ? { ...nd, city_name: x.city_name } : x)) : all.filter((x) => x.id !== d.id)))} />
        ))}
      </div>
    </>
  );
}
