'use client';
import { useState } from 'react';
import { api } from './api';

export type Draft = {
  id: string; to_email: string | null; cc: string | null; subject: string | null; body: string | null;
  status: string; briefing: string | null; error: string | null; sent_at: string | null; created_at: string;
  city_name?: string;
};

export default function DraftEditor({ draft, onChange }: { draft: Draft; onChange?: (d: Draft | null) => void }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [needsForce, setNeedsForce] = useState(false);
  const sent = d.status === 'enviado';

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });

  async function save(silent = false) {
    setBusy('save'); setErr('');
    try {
      await api(`/api/emails/${d.id}`, 'PATCH', { to_email: d.to_email, cc: d.cc, subject: d.subject, body: d.body });
      if (!silent) setMsg('Rascunho salvo.');
    } catch (e: any) { setErr(e.message); throw e; }
    finally { setBusy(''); }
  }

  async function send(force = false) {
    if (!force && !confirm(`Enviar agora para ${d.to_email}?\n\nO e-mail sai da sua caixa corporativa, assinado por você.`)) return;
    try { await save(true); } catch { return; }
    setBusy('send'); setErr(''); setMsg('');
    try {
      await api(`/api/emails/${d.id}/send`, 'POST', { force });
      const nd = { ...d, status: 'enviado', sent_at: new Date().toISOString() };
      setD(nd); onChange?.(nd); setMsg('E-mail enviado.'); setNeedsForce(false);
    } catch (e: any) {
      setErr(e.message);
      if (e.data?.needsForce) setNeedsForce(true);
    } finally { setBusy(''); }
  }

  async function remove() {
    if (!confirm('Excluir este rascunho?')) return;
    await api(`/api/emails/${d.id}`, 'DELETE');
    onChange?.(null);
  }

  return (
    <div className="panel draft" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {d.city_name && <strong>{d.city_name}</strong>}
      {sent && <span className="tag bairro" style={{ alignSelf: 'flex-start' }}>Enviado em {new Date(d.sent_at!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span>}
      {d.briefing && !sent && <p className="notice" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.briefing}</p>}
      <label className="field"><span>Para</span><input value={d.to_email || ''} onChange={set('to_email')} disabled={sent} placeholder="email@prefeitura.sc.gov.br" /></label>
      <label className="field"><span>Cópia</span><input value={d.cc || ''} onChange={set('cc')} disabled={sent} placeholder="opcional" /></label>
      <label className="field"><span>Assunto</span><input value={d.subject || ''} onChange={set('subject')} disabled={sent} /></label>
      <label className="field"><span>Mensagem</span><textarea name="body" value={d.body || ''} onChange={set('body')} disabled={sent} /></label>
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
      {msg && <p className="small" style={{ margin: 0, color: 'var(--teal)' }}>{msg}</p>}
      {!sent && (
        <div className="row">
          <button className="teal" onClick={() => send(false)} disabled={!!busy}>{busy === 'send' ? 'Enviando…' : 'Enviar e-mail'}</button>
          {needsForce && <button className="secondary" onClick={() => send(true)} disabled={!!busy}>Enviar mesmo assim</button>}
          <button className="secondary" onClick={() => save()} disabled={!!busy}>{busy === 'save' ? 'Salvando…' : 'Salvar rascunho'}</button>
          <button className="ghost" onClick={remove} disabled={!!busy}>Excluir</button>
        </div>
      )}
    </div>
  );
}
