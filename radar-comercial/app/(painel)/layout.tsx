import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
