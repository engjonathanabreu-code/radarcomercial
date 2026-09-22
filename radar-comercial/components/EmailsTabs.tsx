'use client';
import { useState } from 'react';
import TemplateGallery from './TemplateGallery';
import DraftList from './DraftList';
import type { Draft } from './DraftEditor';

type City = { id: string; name: string; uf: string };

export default function EmailsTabs({ cities, drafts }: { cities: City[]; drafts: Draft[] }) {
  const [tab, setTab] = useState<'modelos' | 'rascunhos'>('modelos');
  return (
    <div>
      <div className="filters" style={{ marginBottom: 16 }}>
        <button className={tab === 'modelos' ? '' : 'secondary'} onClick={() => setTab('modelos')}>Modelos prontos</button>
        <button className={tab === 'rascunhos' ? '' : 'secondary'} onClick={() => setTab('rascunhos')}>Rascunhos e enviados</button>
      </div>
      {tab === 'modelos' ? <TemplateGallery cities={cities} /> : <DraftList drafts={drafts} />}
    </div>
  );
}
