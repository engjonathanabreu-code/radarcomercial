'use client';
import { useState } from 'react';
import { api } from './api';
import type { Briefing } from '@/lib/settings';

const FIELDS: { key: keyof Briefing; label: string; hint?: string; rows?: number }[] = [
  { key: 'sender_name', label: 'Seu nome' },
  { key: 'sender_role', label: 'Seu cargo' },
  { key: 'sender_phone', label: 'Telefone / WhatsApp' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'company_pitch', label: 'Apresentação da empresa', rows: 3 },
  { key: 'reurb_offer', label: 'Oferta de REURB', rows: 3 },
  { key: 'software_offer', label: 'Oferta do Software Gestor REURB', rows: 3 },
  { key: 'differentials', label: 'Diferenciais', rows: 3 },
  { key: 'cases', label: 'Casos e referências citáveis', hint: 'Só o que pode ser dito a prefeituras. Em branco, a IA não cita nenhum caso.', rows: 3 },
  { key: 'meeting_link', label: 'Link de agendamento', hint: 'Opcional: Google Agenda, Calendly etc.' },
  { key: 'tone', label: 'Tom dos e-mails', rows: 2 },
  { key: 'signature', label: 'Assinatura', rows: 4 },
  { key: 'extra_search_hints', label: 'Orientações extras para a pesquisa', hint: 'Ex.: priorizar municípios com menos de 30 mil habitantes; ignorar obras de pavimentação.', rows: 3 },
];

export default function BriefingForm({ initial }: { initial: Briefing }) {
  const [b, setB] = useState(initial);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    try { await api('/api/settings', 'PUT', b); setMsg('Briefing salvo. A próxima pesquisa e os próximos e-mails já usam esta versão.'); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      {FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          {f.rows ? <textarea rows={f.rows} value={b[f.key]} onChange={(e) => setB({ ...b, [f.key]: e.target.value })} />
            : <input value={b[f.key]} onChange={(e) => setB({ ...b, [f.key]: e.target.value })} />}
          {f.hint && <small>{f.hint}</small>}
        </label>
      ))}
      <div className="row"><button className="teal" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar briefing'}</button>{msg && <span className="small muted">{msg}</span>}</div>
    </div>
  );
}
