// Modelos prontos de e-mail, um por situação comercial recorrente. Diferente do
// gerador com IA (lib/outreach.ts), estes são textos fixos com placeholders —
// não custam busca nem chamada ao Claude, e servem de ponto de partida editável.
export type EmailTemplate = {
  key: string;
  situacao: string;
  assunto: string;
  corpo: string;
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'apresentacao_empresa',
    situacao: 'Apresentação institucional da empresa',
    assunto: 'Apresentação — {{empresa}} e a prefeitura de {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

Me chamo {{remetente_nome}}, {{remetente_cargo}} da {{empresa}}, empresa de engenharia especializada em regularização fundiária urbana (REURB), estudos técnicos e sistemas de gestão para prefeituras, com atuação em municípios do Sul do Brasil.

Gostaria de apresentar brevemente nosso trabalho e entender se {{cidade}} tem hoje demandas relacionadas a núcleos urbanos informais, escrituração de famílias, planejamento territorial ou cadastro imobiliário.

Poderíamos conversar por 20 minutos em algum momento da próxima semana? Fico à disposição para o melhor horário.`,
  },
  {
    key: 'reuniao_reurb',
    situacao: 'Pedido de reunião para falar de REURB',
    assunto: 'Conversa sobre regularização fundiária em {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

Somos a {{empresa}} e atuamos na execução completa da REURB (Lei 13.465/2017): mobilização social, análise documental e de viabilidade, topografia, projeto de regularização, protocolo junto à prefeitura e matrícula registrada para as famílias.

Gostaríamos de entender a situação atual de {{cidade}} quanto a núcleos informais e apresentar como costumamos apoiar prefeituras nesse processo, do diagnóstico até a entrega dos títulos.

Seria possível uma reunião de 20 minutos, presencial ou online, para conversarmos sobre o tema?

Atenciosamente.`,
  },
  {
    key: 'reuniao_etsa',
    situacao: 'Pedido de reunião para falar de ETSA',
    assunto: 'Estudo Técnico Socioambiental (ETSA) — {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

A Lei Federal 14.285/2021 exige Estudo Técnico Socioambiental (ETSA) para a delimitação de faixas de proteção permanente (APP) em áreas urbanas consolidadas — um passo importante para municípios que estão revendo o plano diretor ou lidando com ocupações próximas a cursos d'água.

A {{empresa}} elabora esse tipo de estudo e gostaríamos de entender se {{cidade}} já iniciou esse movimento ou tem interesse em conhecer como o processo funciona na prática, incluindo prazos e etapas técnicas.

Podemos agendar uma conversa de 20 minutos nas próximas semanas?

Atenciosamente.`,
  },
  {
    key: 'apresentacao_software',
    situacao: 'Apresentação do Software Gestor REURB',
    assunto: 'Sistema de gestão de processos REURB para {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

A {{empresa}} desenvolveu o Software Gestor REURB, um sistema para a prefeitura acompanhar cada núcleo e cada morador por etapa do processo de regularização, com análise de documentos por IA, levantamento de campo offline e geração automática dos documentos do processo.

Se {{cidade}} já tem processos de REURB em andamento — sejam conduzidos por vocês ou por terceiros —, o sistema ajuda a organizar, fiscalizar e dar transparência ao andamento de cada caso, sem depender de planilhas soltas.

Podemos mostrar o sistema em uma demonstração rápida de 20 minutos?

Atenciosamente.`,
  },
  {
    key: 'apresentacao_matricula_ia',
    situacao: 'Apresentar o Matrícula.IA',
    assunto: 'Matrícula.IA: leitura automática de documentos de matrícula',
    corpo: `Prezado(a) {{saudacao}},

Além da REURB, a {{empresa}} desenvolveu o Matrícula.IA, uma ferramenta que usa inteligência artificial para ler, organizar e cruzar documentos de matrícula imobiliária e demais peças de um processo de regularização — reduzindo o tempo gasto na análise documental manual de cada núcleo ou família.

Pode ser útil para equipes de {{cidade}} que lidam com grande volume de documentos em processos de regularização, cadastro ou análise jurídica de imóveis.

Se fizer sentido, posso mostrar como funciona em uma demonstração de 15 a 20 minutos.

Atenciosamente.`,
  },
  {
    key: 'diagnostico_gratuito',
    situacao: 'Oferecer diagnóstico preliminar gratuito',
    assunto: 'Diagnóstico preliminar de núcleos informais em {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

A {{empresa}} pode realizar um diagnóstico preliminar, sem custo, sobre a situação de núcleos urbanos informais em {{cidade}} — um levantamento inicial que ajuda a dimensionar o problema antes de qualquer decisão sobre contratação de REURB ou de estudos técnicos.

O objetivo é entregar à prefeitura uma visão clara do cenário local, com base em informações públicas e no que a equipe técnica municipal já conhece.

Podemos agendar uma conversa de 20 minutos para entender melhor o contexto de {{cidade}} e propor os próximos passos?

Atenciosamente.`,
  },
  {
    key: 'convite_demonstracao',
    situacao: 'Convite para demonstração do software',
    assunto: 'Convite: demonstração do Software Gestor REURB',
    corpo: `Prezado(a) {{saudacao}},

Gostaríamos de convidar a equipe de {{cidade}} para uma demonstração online do Software Gestor REURB, mostrando na prática como o sistema organiza o acompanhamento de núcleos e moradores em processos de regularização fundiária, com análise de documentos por IA e geração automática de peças do processo.

A demonstração dura cerca de 25 minutos e pode incluir quem a prefeitura considerar relevante: planejamento, habitação, obras ou procuradoria.

Qual seria um bom dia e horário nas próximas duas semanas?

Atenciosamente.`,
  },
  {
    key: 'interesse_licitacao',
    situacao: 'Manifestar interesse em licitação aberta',
    assunto: 'Interesse em processo licitatório — {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

A {{empresa}} tomou conhecimento do processo licitatório em andamento em {{cidade}} relacionado a REURB, ETSA, topografia, georreferenciamento ou cadastro técnico, e gostaríamos de manifestar nosso interesse em participar.

Ficamos à disposição para eventuais pedidos de esclarecimento pelos canais oficiais do certame e para qualquer informação complementar que a comissão julgar necessária.

Desde já agradecemos a atenção e aguardamos as próximas etapas conforme o edital.

Atenciosamente.`,
  },
  {
    key: 'parabenizacao_avanco',
    situacao: 'Parabenizar avanço institucional e oferecer apoio',
    assunto: 'Parabéns pelo avanço na regularização fundiária em {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

Acompanhamos o avanço de {{cidade}} em relação à regularização fundiária e gostaríamos de parabenizar a iniciativa — é um passo importante para as famílias que aguardam a escritura de seus imóveis.

A {{empresa}} atua nessa área há anos e fica à disposição caso a prefeitura tenha interesse em conversar sobre como apoiar tecnicamente as próximas etapas do processo, seja na execução da REURB, em estudos técnicos ou no acompanhamento via sistema de gestão.

Se fizer sentido, podemos conversar por 20 minutos nas próximas semanas.

Atenciosamente.`,
  },
  {
    key: 'followup',
    situacao: 'Retomar contato sem resposta',
    assunto: 'Retomando contato — {{empresa}} e {{cidade}}',
    corpo: `Prezado(a) {{saudacao}},

Escrevo para retomar um contato anterior sobre regularização fundiária e os serviços da {{empresa}} para {{cidade}}. Entendo que a rotina da prefeitura é intensa, então segue um lembrete caso o tema ainda seja de interesse.

Seguimos à disposição para uma conversa breve, sem compromisso, sobre a situação atual do município e como podemos ajudar — seja com REURB, estudos técnicos ou o Software Gestor REURB.

Qualquer retorno é bem-vindo, mesmo que seja para dizer que não é o momento.

Atenciosamente.`,
  },
];
