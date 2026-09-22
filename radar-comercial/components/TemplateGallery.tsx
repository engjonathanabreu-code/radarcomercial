'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from './api';
import { EMAIL_TEMPLATES } from '@/lib/templates';

type City = { id: string; name: string; uf: string };

export default function TemplateGallery({ cities }: { cities: City[] }) {
  const [cityId, setCityId] = useState(cities[0]?.id || '');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  async function use(templateKey: string) {
    if (!cityId) { setErr('Cadastre uma cidade antes de usar um modelo.'); return; }
    setBusy(templateKey); setErr('');
    try {
      const draft = await api<{ id: string }>('/api/emails/template', 'POST', { templateKey, cityId });
      setResult((r) => ({ ...r, [templateKey]: draft.id }));
    } catch (e: any) { setErr(e.message); }
    setBusy('');
  }

  return (
    <div>
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label className="field" style={{ flex: '1 1 260px', margin: 0 }}>
          <span>Para qual cidade?</span>
          <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {cities.length === 0 && <option value="">Nenhuma cidade cadastrada</option>}
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}/{c.uf}</option>)}
          </select>
        </label>
        <p className="small muted" style={{ margin: 0 }}>Escolha a cidade uma vez e use quantos modelos quiser — cada um vira um rascunho editável nessa cidade.</p>
      </div>
      {err && <p className="error">{err}</p>}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {EMAIL_TEMPLATES.map((t) => (
          <article key={t.key} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{t.situacao}</h3>
            <p className="small muted" style={{ margin: 0 }}>{t.assunto}</p>
            <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>{t.corpo.slice(0, 220)}…</p>
            {result[t.key] ? (
              <Link href={`/cidade/${cityId}`} className="btn" style={{ textAlign: 'center', justifyContent: 'center' }}>Ver rascunho na cidade</Link>
            ) : (
              <button className="teal" onClick={() => use(t.key)} disabled={busy === t.key || !cityId}>
                {busy === t.key ? 'Criando…' : 'Usar este modelo'}
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
