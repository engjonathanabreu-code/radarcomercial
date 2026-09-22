'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from './api';

type C = { id: string; name: string; uf: string; ibge_code: string | null; active: boolean; contact_email: string | null };

export default function CitiesManager({ initial }: { initial: C[] }) {
  const [cities, setCities] = useState(initial);
  const [name, setName] = useState('');
  const [uf, setUf] = useState('SC');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const active = cities.filter((c) => c.active).length;

  async function add(n: string, u: string) {
    const c = await api<C>('/api/cities', 'POST', { name: n, uf: u });
    setCities((all) => [...all, c].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await add(name, uf); setName(''); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function addBulk() {
    setBusy(true); setErr('');
    const errors: string[] = [];
    for (const line of bulk.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/^(.+?)[\s\/,;-]+(SC|PR|RS)$/i);
      if (!m) { errors.push(`"${line}": use o formato Cidade/UF`); continue; }
      try { await add(m[1].trim(), m[2].toUpperCase()); } catch (e: any) { errors.push(`${line}: ${e.message}`); }
    }
    setErr(errors.join('\n')); if (!errors.length) setBulk('');
    setBusy(false);
  }

  async function toggle(c: C) {
    await api('/api/cities', 'PATCH', { id: c.id, active: !c.active });
    setCities((all) => all.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
  }

  async function remove(c: C) {
    if (!confirm(`Remover ${c.name}? Os achados e rascunhos desta cidade também serão apagados.`)) return;
    await api('/api/cities', 'DELETE', { id: c.id });
    setCities((all) => all.filter((x) => x.id !== c.id));
  }

  return (
    <>
      {active > 15 && <p className="notice">{active} cidades ativas. Acima de 15 o custo diário e o tempo da pesquisa crescem na mesma proporção.</p>}
      <section className="grid-2">
        <form className="panel" onSubmit={addOne} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Adicionar uma cidade</h2>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input placeholder="Nome do município" value={name} onChange={(e) => setName(e.target.value)} />
            <select value={uf} onChange={(e) => setUf(e.target.value)} style={{ width: 90 }}>
              <option>SC</option><option>PR</option><option>RS</option>
            </select>
          </div>
          <button className="teal" disabled={busy || !name}>Adicionar</button>
        </form>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Adicionar várias</h2>
          <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Uma por linha, no formato Cidade/UF\nPomerode/SC\nRio Negro/PR'} />
          <button className="secondary" onClick={addBulk} disabled={busy || !bulk.trim()}>Adicionar lista</button>
        </div>
      </section>
      {err && <p className="error" style={{ whiteSpace: 'pre-wrap' }}>{err}</p>}
      <section>
        <h2>{active} cidades monitoradas</h2>
        {cities.length === 0 ? <div className="empty"><p>Nenhuma cidade ainda. O código IBGE é conferido automaticamente ao adicionar.</p></div> : (
          <table className="cities-table">
            <thead><tr><th>Cidade</th><th className="hide-sm">IBGE</th><th className="hide-sm">E-mail de contato</th><th>Monitorar</th><th /></tr></thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/cidade/${c.id}`}>{c.name}</Link> <span className="muted">{c.uf}</span></td>
                  <td className="hide-sm num muted">{c.ibge_code || '—'}</td>
                  <td className="hide-sm small">{c.contact_email || <span className="muted">a descobrir</span>}</td>
                  <td><input type="checkbox" checked={c.active} onChange={() => toggle(c)} aria-label={`Monitorar ${c.name}`} style={{ width: 18, height: 18 }} /></td>
                  <td style={{ textAlign: 'right' }}><button className="ghost" onClick={() => remove(c)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
