'use client';
import { useState } from 'react';
import OppFeed, { type OppView } from './OppFeed';
import DraftEditor, { type Draft } from './DraftEditor';
import { api } from './api';

const INTENTS = [
  { key: 'apresentacao', label: 'Apresentação institucional' },
  { key: 'informacao', label: 'Pedir informações' },
  { key: 'reuniao', label: 'Propor reunião' },
  { key: 'software', label: 'Apresentar o software' },
  { key: 'licitacao', label: 'Interesse em licitação' },
  { key: 'followup', label: 'Retomar contato' },
];

type CityInfo = { id: string; name: string; uf: string; contact_name: string | null; contact_role: string | null; contact_email: string | null; contact_phone: string | null; notes: string | null };

export default function CityWorkspace({ city, opps, drafts: initialDrafts }: { city: CityInfo; opps: OppView[]; drafts: Draft[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [intent, setIntent] = useState('apresentacao');
  const [briefing, setBriefing] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [contact, setContact] = useState(city);
  const [contactMsg, setContactMsg] = useState('');

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function generate() {
    setBusy(true); setErr('');
    try {
      const d = await api<Draft>('/api/emails/draft', 'POST', { cityId: city.id, opportunityIds: selected, intent, briefing });
      setDrafts((all) => [d, ...all]);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function saveContact() {
    setContactMsg('');
    try {
      await api('/api/cities', 'PATCH', {
        id: city.id, contact_name: contact.contact_name, contact_role: contact.contact_role,
        contact_email: contact.contact_email, contact_phone: contact.contact_phone, notes: contact.notes,
      });
      setContactMsg('Contato salvo.');
    } catch (e: any) { setContactMsg(e.message); }
  }
  const setC = (k: keyof CityInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact({ ...contact, [k]: e.target.value });

  return (
    <div className="city-layout">
      <div>
        <section>
          <h2>Achados</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Marque os achados que o e-mail deve mencionar.</p>
          <OppFeed items={opps} selectable selected={selected} onToggle={toggle} emptyText="Nenhum achado para esta cidade ainda. Rode uma pesquisa no Radar." />
        </section>
        <section>
          <h2>Contato na prefeitura</h2>
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <label className="field"><span>Nome</span><input value={contact.contact_name || ''} onChange={setC('contact_name')} /></label>
              <label className="field"><span>Cargo</span><input value={contact.contact_role || ''} onChange={setC('contact_role')} /></label>
              <label className="field"><span>E-mail</span><input value={contact.contact_email || ''} onChange={setC('contact_email')} /></label>
              <label className="field"><span>Telefone</span><input value={contact.contact_phone || ''} onChange={setC('contact_phone')} /></label>
            </div>
            <label className="field"><span>Anotações</span><textarea rows={3} value={contact.notes || ''} onChange={setC('notes')} placeholder="Histórico de conversas, quem decide, próximos passos" /></label>
            <div className="row"><button className="secondary" onClick={saveContact}>Salvar contato</button>{contactMsg && <span className="small muted">{contactMsg}</span>}</div>
          </div>
        </section>
      </div>

      <aside className="composer">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Escrever para a prefeitura</h2>
          <label className="field"><span>Objetivo</span>
            <select value={intent} onChange={(e) => setIntent(e.target.value)}>
              {INTENTS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
          </label>
          <label className="field"><span>Suas instruções</span>
            <textarea rows={4} value={briefing} onChange={(e) => setBriefing(e.target.value)}
              placeholder="Ex.: mencionar que estaremos na região na semana que vem e pedir o levantamento de núcleos do bairro Progresso." />
          </label>
          <p className="small muted" style={{ margin: 0 }}>{selected.length ? `${selected.length} achado(s) selecionado(s).` : 'Sem achados selecionados: o e-mail usa o resumo da cidade.'}</p>
          {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
          <button className="teal" onClick={generate} disabled={busy}>{busy ? 'Redigindo…' : 'Gerar rascunho'}</button>
        </div>
        {drafts.map((d) => (
          <DraftEditor key={d.id} draft={d} onChange={(nd) => setDrafts((all) => (nd ? all.map((x) => (x.id === nd.id ? nd : x)) : all.filter((x) => x.id !== d.id)))} />
        ))}
      </aside>
    </div>
  );
}
