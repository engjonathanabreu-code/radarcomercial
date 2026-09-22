'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) window.location.href = '/';
    else { setError((await res.json()).error || 'Não foi possível entrar.'); setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div>
          <h1 style={{ fontSize: 28 }}>Radar comercial</h1>
          <p className="muted small" style={{ margin: '6px 0 0' }}>Integral Soluções em Engenharia</p>
        </div>
        <label className="field"><span>Senha</span>
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <button className="teal" disabled={busy || !password}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
