'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Radar' },
  { href: '/cidades', label: 'Cidades' },
  { href: '/emails', label: 'E-mails' },
  { href: '/briefing', label: 'Briefing' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/cidade/') : path.startsWith(href));

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">Radar comercial<small>Integral Soluções em Engenharia</small></div>
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="foot"><button onClick={logout}>Sair</button></div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
