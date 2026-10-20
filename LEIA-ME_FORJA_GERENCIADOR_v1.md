# Forja · Gerenciador v1.0 · out/2026

**Problema que resolve:** a FORJA_CENTRAL tinha 11 abas, fórmulas espalhadas e cada agente copiando linhas à mão. Aqui a planilha vira só o banco (6 abas) e tudo se opera pelo app.
**Como você percebe que resolveu:** abre o app, vê o que vence hoje e o próximo passo de cada casa. Não abre mais a planilha.

---

## Passo 1 · Modelo de dados (a planilha)

Você não monta nada à mão: o menu **FORJA APP > 1 Preparar sistema** cria as abas, os cabeçalhos e carrega as categorias, os 19 pitches e os 23 posts do calendário atual.

| Aba | Colunas (linha 1) |
|---|---|
| CLIENTES | id, codigo, nome, contato, whatsapp, tipo, porte, cidade, origem, dor, estagio, responsavel, vazamento_mes, ultima_interacao, proxima_acao, data_proxima, plano, status_impl, inicio, semanas, p_produto, p_custo, p_gente, p_conduta, p_rotina, cmv_base, cmv_atual, economia_mes, valor_rx, autorizada_case, motivo, notas, criado_em, atualizado_em |
| ATIVIDADES | id, cliente_id, tipo, data, hora, status, resumo, valor, prazo, criado_em, atualizado_em |
| PITCHES | id, titulo, categoria, etapa, ordem, texto, ativo |
| CONTEUDO | id, data, hora, tipo, linha, peca, status, gate, conversas, salvamentos, compartilhamentos, obs |
| CATEGORIAS | id, lista, valor, ordem |
| CONFIG | chave, valor |

**De 11 abas para 6.** Lead e cliente são a mesma linha (o estágio muda). LEADS, RAIO_X, IMPLANTACOES e ACOMPANHAMENTO viraram CLIENTES + ATIVIDADES (visita, relatório, proposta, RDO são atividades com data). LISTAS virou CATEGORIAS. PARAMETROS virou CONFIG. PAINEL e METRICAS deixaram de existir: o app calcula na hora. FILA_AGENTES ficou fora desta versão (decisão abaixo).

Datas sempre AAAA-MM-DD. Não edite as abas à mão.

## Passo 2 · Backend (Code.gs)

Arquivo `Code.gs`, completo e comentado. `doGet` serve o app, `doPost` recebe JSON, resposta sempre `{ status, message, data }`. Leitura e escrita em bloco, trava de escrita, código guardado só como hash, sessão de 12 h, bloqueio após 8 tentativas erradas.

## Passo 3 · App (um arquivo HTML)

`Index.html` (para o Apps Script) e `index.html` (para a Vercel/GitHub) são o mesmo app. O que você faz nele:

- **Painel:** o que vence hoje, os 16 indicadores da FORJA_CENTRAL em Temperado/Atenção/Crítico, funil, semana a semana, CMV por casa. Toque num indicador e vê as casas.
- **Clientes:** lista com busca e filtros, visão Funil (cartões, move com ◀ ▶), ficha completa com as 5 frentes da implantação, WhatsApp direto, exportar CSV.
- **Agenda:** visita, Raio-X, proposta, tarefa. Atrasadas, hoje, 7 dias. Feita, +1 dia, +7 dias. Ao marcar, o app sugere mover o cliente no funil.
- **Pitches (roteirizar):** um roteiro por etapa do funil, em ordem, com ▲▼ para reordenar. Escolha o cliente e os campos {nome}, {casa}, {dor}, {valor_rx}, {vazamento} se preenchem sozinhos; o que faltar aparece em amarelo. Copiar, abrir no WhatsApp, "marcar como usado" (vira atividade no histórico). O app **nunca envia sozinho**: você revisa e manda.
- **Conteúdo:** calendário de posts, status, gate, métricas, fila à frente.
- **Config:** crie, renomeie, reordene e remova categorias (renomear atualiza todos os registros); parâmetros de preço, prazo e capacidade.

## Passo 4 · Implantar (15 minutos)

**A. Backend**
1. Crie uma planilha Google nova e vazia (não use a FORJA_CENTRAL; ela fica intacta como arquivo).
2. Extensões > Apps Script. Apague o que houver, cole o `Code.gs`.
3. Botão **+** ao lado de Arquivos > HTML > nome exatamente `Index`. Cole o conteúdo de `Index.html`.
4. Salve. Volte à planilha e recarregue a página. Aparece o menu **FORJA APP**.
5. FORJA APP > **1 Preparar sistema** (autorize quando pedir). Depois **2 Definir meu código de acesso** (mínimo 6 caracteres).
6. Apps Script > Implantar > Nova implantação > App da Web. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. Copie o endereço que termina em `/exec`.
7. Abra o endereço: o app já funciona por ali.

**B. Hospedar no celular/PC (opcional, recomendado)**
1. Crie um repositório novo no GitHub (outro, não o da marmitaria) e envie os 9 arquivos da pasta `web`: index.html, config.js, vercel.json, manifest.webmanifest, sw.js e os 4 ícones, todos na raiz.
2. Vercel > Add New Project > escolha o repositório > Framework "Other" > Deploy.
3. Abra o site, cole o endereço `/exec` quando o app pedir, digite o código. Fica salvo só nesse aparelho. Se preferir fixar, cole o endereço entre as aspas do `config.js`.
4. No celular: menu do navegador > Adicionar à tela inicial.

Sempre que mudar o `Code.gs`: Implantar > Gerenciar implantações > lápis > Nova versão.

---

## O que está implementado × testado × depende de fora

| | Estado |
|---|---|
| Backend (CRUD, validação, cascata, auth, bloqueio, lote) | Implementado e testado: 28 testes em simulador do Apps Script rodando o `Code.gs` real |
| App (login, painel, clientes, funil, agenda, pitches, conteúdo, config, mobile) | Implementado e testado: 32 testes de tela, desktop e celular, nos dois arquivos |
| Rodando no Google e na Vercel de verdade | **Não verificado.** Depende do seu deploy. O padrão de chamada é o mesmo do app da marmitaria, que você já abriu |
| Limites do semáforo, horas, preços | Hipóteses herdadas da FORJA_CENTRAL. Preço conferir com a tabela vigente |

## Decisões que são suas

1. **Nome de cliente na planilha.** A regra da FORJA_CENTRAL era só código (C-001). Um gerenciador precisa de nome e WhatsApp para funcionar, então criei os campos `nome` e `contato` (privados, só na sua planilha). O código C-001 é gerado automático e é o que vale para posts e cases. Conteúdo público continua sem nome de casa.
2. **Piso da garantia.** O app calcula 2 × valor do Raio-X (R$ 994 no fundador). O documento fixa R$ 1.000. Continua pendente.
3. **FILA_AGENTES** (fichas entre agentes) não entrou. Se você ainda usa os agentes copiando linhas, diga e entra como uma aba a mais.
4. **Tailwind.** Usei CSS próprio no arquivo, não o Tailwind do CDN. Motivo: a identidade proíbe canto arredondado, sombra e degradê, e o Tailwind puxa para o contrário. Também não depende de internet para carregar o visual.

## Migrar o que existe

- **Leads:** cadastre pelo app (Marmitaria da casa, Caboclo, Chacara turimo, Yara; leva 2 minutos). Ou copie a aba LEADS para a planilha nova e rode FORJA APP > Importar dados da FORJA_CENTRAL antiga.
- **Calendário de posts:** já vem carregado (23 peças, 19/10 a 13/11).
- Nada foi alterado na FORJA_CENTRAL.
