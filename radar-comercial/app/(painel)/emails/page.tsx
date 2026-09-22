import { db } from '@/lib/db';
import { smtpConfigured } from '@/lib/mailer';
import EmailsTabs from '@/components/EmailsTabs';

export default async function EmailsPage() {
  const [{ data }, { data: cities }] = await Promise.all([
    db().from('radar_email_drafts').select('*, cities:radar_cities(name,uf)').order('created_at', { ascending: false }).limit(100),
    db().from('radar_cities').select('id,name,uf').order('name'),
  ]);
  const drafts = (data || []).map((d: any) => ({ ...d, city_name: d.cities ? `${d.cities.name}/${d.cities.uf}` : undefined }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>E-mails</h1>
          <p className="lede">Nada sai sem você clicar em enviar. Todo e-mail parte da sua caixa corporativa e fica registrado aqui.</p>
        </div>
      </div>
      {!smtpConfigured() && <p className="notice">O envio está desligado: configure SMTP_HOST, SMTP_USER e SMTP_PASS nas variáveis da Vercel.</p>}
      <EmailsTabs cities={(cities || []) as any} drafts={drafts} />
    </>
  );
}
