'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

type Item = { status: string; city_id: string; error: string | null; cities?: { name: string } | null };
type Run = { id: string; status: string; started_at: string; finished_at: string | null; trigger: string } | null;

export default function RunPanel({ initialRun, initialItems }: { initialRun: Run; initialItems: Item[] }) {
  const router = useRouter();
  const [run, setRun] = useState<Run>(initialRun);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const running = run?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const data = await api<{ run: Run; items: Item[] }>('/api/run');
        const finishedNow = data.run?.status === 'done';
        setRun(data.run); setItems(data.items);
        if (finishedNow) router.refresh();
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 8000);
    return () => clearInterval(t);
  }, [running, router]);

  async function start(resume = false) {
    setBusy(true); setError('');
    try {
      await api('/api/run', 'POST', resume && run ? { resumeRunId: run.id } : {});
      const data = await api<{ run: Run; items: Item[] }>('/api/run');
      setRun(data.run); setItems(data.items);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  const done = items.filter((i) => i.status === 'done' || i.status === 'error').length;
  const errors = items.filter((i) => i.status === 'error');
  const inProgress = items.filter((i) => i.status === 'running').map((i) => i.cities?.name).filter(Boolean);
  const stalled = running && inProgress.length === 0 && done < items.length &&
    Date.now() - new Date(run!.started_at).getTime() > 6 * 60_000;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="panel run-strip">
      <div className="run-progress">
        {!run && <p style={{ margin: 0 }}>Nenhuma pesquisa feita ainda. A primeira varredura mapeia cada cidade do zero.</p>}
        {run && running && (
          <>
            <strong>Pesquisando {done} de {items.length} cidades</strong>
            <span className="muted small">{inProgress.length ? ` — agora: ${inProgress.join(', ')}` : ''}</span>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </>
        )}
        {run && !running && (
          <span>
            <strong>Última pesquisa: </strong>
            {new Date(run.finished_at || run.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
            <span className="muted"> ({run.trigger === 'cron' ? 'automática' : 'manual'}, {items.length} cidades)</span>
          </span>
        )}
        {errors.length > 0 && (
          <p className="error small" style={{ margin: '6px 0 0' }}>
            Falhou em {errors.map((e) => e.cities?.name).join(', ')}. Motivo: {errors[0].error?.slice(0, 160)}
          </p>
        )}
        {error && <p className="error small" style={{ margin: '6px 0 0' }}>{error}</p>}
      </div>
      <div className="row">
        {stalled && <button className="secondary" onClick={() => start(true)} disabled={busy}>Retomar pesquisa</button>}
        <button className="teal" onClick={() => start(false)} disabled={busy || running}>
          {running ? 'Pesquisa em andamento' : busy ? 'Iniciando…' : 'Pesquisar agora'}
        </button>
      </div>
    </div>
  );
}
