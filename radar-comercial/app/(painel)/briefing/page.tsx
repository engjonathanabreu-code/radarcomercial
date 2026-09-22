import { getBriefing } from '@/lib/settings';
import BriefingForm from '@/components/BriefingForm';

export default async function BriefingPage() {
  const b = await getBriefing();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Briefing</h1>
          <p className="lede">Tudo o que o agente sabe sobre você e a Integral. Ele usa este texto para julgar o que é oportunidade e para escrever em seu nome.</p>
        </div>
      </div>
      <BriefingForm initial={b} />
    </>
  );
}
