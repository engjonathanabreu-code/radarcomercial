import { db } from '@/lib/db';
import CitiesManager from '@/components/CitiesManager';

export default async function CidadesPage() {
  const { data } = await db().from('cities').select('id,name,uf,ibge_code,active,contact_email').order('name');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cidades monitoradas</h1>
          <p className="lede">O agente pesquisa todas as cidades ativas uma vez por dia, às 6h. Cada cidade recebe um ângulo de aprofundamento diferente a cada dia.</p>
        </div>
      </div>
      <CitiesManager initial={(data || []) as any} />
    </>
  );
}
