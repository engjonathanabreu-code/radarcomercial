# Radar Comercial Integral

Agente de prospecção que pesquisa, todos os dias, as prefeituras que você escolher (SC, PR e RS) atrás de oportunidades de **REURB** e do **Software Gestor REURB**, e redige e-mails institucionais em seu nome — que só saem quando você clica em enviar.

## O que ele faz a cada manhã (6h)

1. **Licitações oficiais** — consulta a API pública do PNCP para cada município e pega as contratações com propostas em aberto. Prazo e link vêm do PNCP, não da IA.
2. **Pesquisa humana na web** — o Claude, com busca na web, lê notícias, diários oficiais, câmara de vereadores e MP procurando sinais diretos (REURB, Lar Legal, lei municipal) e **indiretos**: loteamento clandestino, "moradores sem escritura", rua que não pode receber asfalto por não ser oficial, ocupação em APP, pedido de vereador etc. Registra o **nome do bairro** sempre que a fonte cita.
3. **Ângulo do dia** — cada cidade recebe um foco diferente por dia (câmara, MP, áreas de risco, plano diretor/ETSA, cadastro/software, habitação, secretariado), cobrindo a semana inteira sem repetir.
4. **Memória** — o agente recebe o que já foi encontrado e só traz novidades. Status que você marca (descartado, em andamento) é preservado.
5. **Margem de licitação** — calculada pelo sistema em **dias úteis inteiros** (feriados nacionais inclusos). Padrão: 3. Licitações com menos margem ficam registradas como "fora da margem" — mostram que a prefeitura compra esse serviço.
6. **Relatório** — painel com temperatura por cidade, estacas de prazo das licitações e feed de achados; opcionalmente um resumo no seu e-mail.

## Como o agente foi calibrado para as limitações do Claude

- Nunca calcula prazos: transcreve datas em ISO e o código calcula.
- Licitações do PNCP têm data e link oficiais sobrescrevendo o que a IA disser.
- Não inventa e-mails de prefeitura; contatos deduzidos vêm marcados como "não verificado".
- Confirma a UF em cada fonte (homônimos são comuns no Sul).
- Planeja um orçamento fixo de buscas por cidade e é instruído a não inflar achados fracos.
- Trata `pause_turn` da API (buscas longas) e usa cache de prompt no system prompt.
- E-mails: proibido inventar casos, números ou contatos anteriores; em licitação aberta, só manifesta interesse pelos canais oficiais.

## Publicar (GitHub → Vercel)

### 1. Banco (Supabase)
Crie um projeto novo (recomendado, separado do CRM e do ERP) e rode `supabase/schema.sql` no SQL Editor. Copie a URL e a **service role key** (Settings → API).

### 2. Claude
Crie uma chave em console.anthropic.com. **Habilite a busca na web** para a organização no Console (Settings → Privacy/Features), senão as pesquisas falham.

### 3. GitHub
```bash
git init && git add . && git commit -m "Radar comercial"
git branch -M main
git remote add origin https://github.com/engjonathanabreu-code/radar-comercial.git
git push -u origin main
```
Deixe o repositório **privado**.

### 4. Vercel
Importe o repositório e cadastre as variáveis de `.env.example` em Settings → Environment Variables. Pontos de atenção:

- `APP_URL` precisa ser o **domínio de produção** (ex.: `https://radar-comercial.vercel.app`). A pesquisa encadeia uma cidade por vez chamando o próprio app; se apontar para um preview protegido, a cadeia para.
- `CRON_SECRET` é enviado pela Vercel ao cron automaticamente.
- O worker usa `maxDuration = 300`s (uma cidade por invocação). Isso exige Fluid Compute, padrão em projetos novos.
- O plano Hobby da Vercel é para uso não comercial; para uso da empresa, o correto é o plano Pro.

### 5. E-mail corporativo (SMTP)
- **Google Workspace**: `smtp.gmail.com`, porta 465, `SMTP_PASS` = senha de app (exige verificação em duas etapas).
- **Microsoft 365**: `smtp.office365.com`, porta 587, com SMTP AUTH habilitado na caixa pelo admin. A Microsoft vem desativando autenticação básica no SMTP; se for bloqueado, dá para trocar o envio por Microsoft Graph.
- Configure SPF, DKIM e DMARC do domínio para os e-mails não caírem no spam.

### 6. Primeiro uso
Entre com `APP_PASSWORD` → **Briefing** (revise textos, telefone, casos citáveis) → **Cidades** (cole as 15 no formato `Cidade/UF`) → **Radar → Pesquisar agora**.

## Fluxo de e-mail
Abra uma cidade → marque os achados que devem ser citados → escolha o objetivo (apresentação, pedir informações, reunião, software, licitação, follow-up) → escreva suas instruções → **Gerar rascunho** → edite → **Enviar e-mail**.
Travas: nenhum envio automático; intervalo mínimo por prefeitura (`EMAIL_COOLDOWN_DAYS`); teto diário (`MAX_EMAILS_PER_DAY`); cópia oculta opcional para você (`SMTP_BCC`).

## Custos e ajustes
- Cada cidade usa até `MAX_SEARCHES_PER_CITY` buscas (padrão 8). 15 cidades ≈ 120 buscas/dia, cobradas à parte dos tokens. Acompanhe no Console da Anthropic nos primeiros dias.
- Mais profundidade: `CLAUDE_MODEL_RESEARCH=claude-opus-5`. Mais economia: menos buscas por cidade.
- `RESEARCH_CONCURRENCY` controla quantas cidades rodam em paralelo; suba só se o limite de taxa da sua conta aguentar.

## Estrutura
```
lib/prompts.ts     cérebro do agente (pesquisa e redação)
lib/research.ts    pipeline de uma cidade: PNCP → Claude → banco
lib/runs.ts        rodada diária encadeada + relatório por e-mail
lib/pncp.ts        licitações oficiais
lib/dates.ts       dias úteis e feriados
lib/outreach.ts    redação dos e-mails
app/(painel)/      Radar, Cidade, Cidades, E-mails, Briefing
app/api/           cron, worker, e-mails, cidades, configurações
supabase/schema.sql
```

## Próximos passos possíveis
Ler respostas das prefeituras (IMAP/Gmail) e sugerir a réplica; follow-up automático sugerido após N dias sem resposta; exportar oportunidades para o CRM Integral.
