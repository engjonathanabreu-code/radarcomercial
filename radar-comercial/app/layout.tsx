import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  title: 'Radar Comercial · Integral',
  description: 'Agente de prospecção de REURB e Software Gestor REURB',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
