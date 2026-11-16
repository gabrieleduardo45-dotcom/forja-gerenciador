# Forja · Central de comando

**O que é:** o painel da Forja com um agente de IA por setor. Os agentes leem os dados reais do Supabase (`forja-proprio`), propõem ações e esperam o seu ok. Nenhum agente envia mensagem nem fala com cliente.

**Stack:** Next.js 16 (App Router) · Tailwind 4 · Supabase (Postgres + Auth + RLS) · AI SDK 7 via Vercel AI Gateway (Claude) · Vercel (região gru1, São Paulo).

## Telas

| Tela | Para quê |
|---|---|
| **Hoje** | Metas do mês × realizado, propostas esperando você, quem tocar hoje, alertas das casas, página do dia do Diretor de Gestão |
| **Aprovar** | Fila de propostas dos agentes: aprovar, descartar, marcar feita, copiar mensagem, abrir no WhatsApp |
| **Agentes** | Os 13 agentes (A0 a A12). Chat com cada um, liga/desliga da rodada do dia |
| **Comercial** | Funil, prospects (mudar estágio na tabela), conversão por canal, oportunidades |
| **Casas** | Carteira, CMV × alvo, exceções, entregas, valor por hora |
| **Financeiro** | Recebido × meta, MRR, receita por mês, preços vigentes |
| **Marketing** | Página de vendas: visitas, cliques no WhatsApp, origem |
| **Decisões** | Memória da Forja. Todo agente lê antes de recomendar |

## Como os agentes trabalham

- Cada agente lê **só as fontes do seu setor** (lista em `src/lib/agentes.ts`), sempre com o seu login, então o RLS do banco vale.
- Escrever, só numa coisa: a tabela `propostas` (fila de aprovação).
- **A0 · Diretor de Gestão** pode perguntar a qualquer outro setor e monta a página do dia.
- **Rodada do dia:** botão "Rodar agentes" ou automático às 5h de Manaus (Vercel Cron). Rodam só os agentes ligados na tela Agentes; o A0 roda sempre no fim e consolida.
- Aprovar uma proposta do tipo **decisão** grava em `decisoes`.
- Regras de voz e de privacidade estão em `REGRAS_FORJA` (`src/lib/agentes.ts`).

## Implantar

Já configurado na Vercel (projeto `forja-gerenciador`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (produção, prévia, desenvolvimento)
- `CRON_SECRET` (produção, prévia)
- `vercel.json` fixa o framework Next.js, a região gru1 e o cron.

Falta você:
1. **AI Gateway:** no painel da Vercel, aba *AI Gateway*, confirme que está ativo para o time (sem isso os agentes não respondem). Na Vercel não precisa de chave: o projeto usa OIDC.
2. **Rodada automática (opcional):** Supabase > Project Settings > API Keys > copie a `service_role` e cadastre na Vercel como `SUPABASE_SERVICE_ROLE_KEY` (tipo *Sensitive*, só produção). Sem ela a rodada só acontece pelo botão.
3. **Publicar:** junte o branch na `main` (pull request). A produção troca o app antigo (planilha) por este. O app antigo continua em `legado/`.
4. Entre com o seu e-mail e senha do Supabase (o mesmo login do forja-proprio). Esqueceu a senha: botão "me mande um link" na tela de login.

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # e preencha AI_GATEWAY_API_KEY (ou: vercel env pull)
npm run dev
```

## Banco

Migração desta versão: `supabase/migrations/20261116_central_agentes_propostas.sql` (já aplicada). Só adiciona `agente_conversas`, `propostas` e `v_propostas_resumo`, todas com RLS `eh_membro()`.

## Custos de IA

Modelo padrão `anthropic/claude-sonnet-5.5` (troque com a variável `FORJA_MODELO`). Uma conversa curta custa centavos; uma rodada com todos os 13 agentes ligados, alguns reais. Comece com 2 ou 3 agentes ligados (Comercial, Financeiro, Conversão).
