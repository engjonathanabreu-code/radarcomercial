import { db } from './db';

export type Briefing = {
  sender_name: string;
  sender_role: string;
  sender_phone: string;
  company_name: string;
  company_pitch: string;
  reurb_offer: string;
  software_offer: string;
  differentials: string;
  cases: string;
  meeting_link: string;
  tone: string;
  signature: string;
  extra_search_hints: string;
};

export const DEFAULT_BRIEFING: Briefing = {
  sender_name: 'Jonathan',
  sender_role: 'Desenvolvimento de Negócios',
  sender_phone: '',
  company_name: 'Integral Soluções em Engenharia',
  company_pitch:
    'Empresa de engenharia fundada em 2017, especializada em regularização fundiária urbana (REURB), estudos técnicos socioambientais (ETSA) e planejamento setorial para municípios. A divisão Integral Gestão Pública (IGP) atende principalmente municípios pequenos e médios de Santa Catarina.',
  reurb_offer:
    'Execução completa da REURB (Lei 13.465/2017): mobilização social, análise documental e de viabilidade, topografia, projeto de regularização, protocolo na prefeitura, CRF e matrícula registrada para as famílias. Atua em REURB-S e REURB-E.',
  software_offer:
    'Software Gestor REURB: sistema para a prefeitura acompanhar cada núcleo e cada morador por etapa, com análise de documentos por IA, levantamento de campo offline e geração de documentos do processo.',
  differentials:
    'Equipe multidisciplinar própria (engenharia, topografia, jurídico e social), experiência com cartórios e prefeituras de SC, processo digital de ponta a ponta.',
  cases: '',
  meeting_link: '',
  tone: 'Institucional, cordial e direto. Frases curtas. Sem exageros de marketing.',
  signature: 'Jonathan\nIntegral Soluções em Engenharia',
  extra_search_hints: '',
};

export async function getBriefing(): Promise<Briefing> {
  const { data } = await db().from('radar_settings').select('value').eq('key', 'briefing').maybeSingle();
  return { ...DEFAULT_BRIEFING, ...((data?.value as Partial<Briefing>) || {}) };
}

export async function saveBriefing(b: Partial<Briefing>): Promise<void> {
  const current = await getBriefing();
  await db().from('radar_settings').upsert({ key: 'briefing', value: { ...current, ...b }, updated_at: new Date().toISOString() });
}
