/**
 * Os agentes da Forja, um por setor. O cadastro (nome, ativo, versão do prompt) mora na tabela
 * public.agentes; aqui fica o que o código precisa: quais dados cada um enxerga e como ele trabalha.
 */

export type Fonte = {
  descricao: string;
  /** Coluna de data usada para ordenar por padrão (mais recente primeiro). */
  ordem?: string;
};

/** Tudo o que um agente pode ler. Nada fora desta lista é consultável. O RLS do banco vale por cima. */
export const FONTES = {
  // Comercial
  v_fila_hoje: { descricao: "Prospects com toque vencendo hoje ou atrasado, com score e prioridade" },
  v_funil: { descricao: "Quantidade de casas por estágio do funil (brasa = prioridade alta)" },
  prospects: { descricao: "Base de prospecção: casa, setor, bairro, decisor, score, estágio, próximo toque", ordem: "atualizado_em" },
  atividades: { descricao: "Toques comerciais: canal, direção, resultado, próxima ação", ordem: "data_hora" },
  oportunidades: { descricao: "Propostas comerciais: produto, valor, status, motivo de perda", ordem: "criado_em" },
  sinais: { descricao: "Sinais de compra observados em prospects (reclamação, expansão, contratação)", ordem: "registrado_em" },
  cadencias: { descricao: "Cadências de contato (passos em JSON)" },
  roteiros: { descricao: "Roteiros de mensagem aprovados por canal (T0 a T6)" },
  parceiros: { descricao: "Parceiros que indicam restaurantes", ordem: "criado_em" },
  v_conversao_canal: { descricao: "Conversão por canal: tocadas, responderam, Raio-X, horas" },
  v_conversao_origem: { descricao: "Conversão por origem do lead" },
  v_tempo_etapa: { descricao: "Dias médios em cada etapa do funil" },
  v_toques_dia: { descricao: "Toques, respostas e Raio-X por dia e canal", ordem: "dia" },
  // Marketing / conversão
  v_lp_conversao: { descricao: "Página de vendas: visitas e cliques no WhatsApp por dia e variante", ordem: "dia" },
  v_lp_cliques: { descricao: "Página de vendas: cliques por alvo" },
  v_lp_origem: { descricao: "Página de vendas: visitas por origem e dispositivo" },
  v_lp_rolagem: { descricao: "Página de vendas: até onde as sessões rolam" },
  // Operação nas casas
  casas: { descricao: "Restaurantes clientes: código, setor, porte, status, frentes, início", ordem: "criado_em" },
  cmv: { descricao: "CMV semanal por casa: % real, alvo, estado, principais insumos", ordem: "semana_inicio" },
  rdo: { descricao: "Relatório diário de operação: produzido x planejado, sobra, descarte, aderência", ordem: "data" },
  excecoes: { descricao: "Exceções na cozinha: o que houve, causa, ação, prazo, repetições", ordem: "data" },
  v_excecoes_abertas: { descricao: "Exceções ainda abertas" },
  v_campos_parados: { descricao: "Dados que o cliente ainda não entregou e há quantos dias" },
  entregas: { descricao: "Entregáveis por casa (fichas, POP, relatórios), status e retrabalho", ordem: "data" },
  registros: { descricao: "Registros de praça/turno (pesagens, temperaturas, horários)", ordem: "data" },
  // Financeiro
  recebimentos: { descricao: "Dinheiro recebido: produto, linha, valor, forma", ordem: "data" },
  contratos: { descricao: "Contratos ativos: produto, valor, meses, status", ordem: "criado_em" },
  v_receita_mes: { descricao: "Receita recebida por mês e linha de produto", ordem: "mes" },
  v_recorrente_ativo: { descricao: "Receita recorrente (MRR) ativa por produto" },
  v_valor_hora_casa: { descricao: "Valor por hora real de cada casa" },
  horas: { descricao: "Horas trabalhadas por casa e tipo", ordem: "data" },
  equipe: { descricao: "Pessoas da Forja: cadeira, remuneração" },
  precos: { descricao: "Tabela de preços vigente (fundadora e cheia). Fonte única de preço." },
  // Gestão
  metas: { descricao: "Metas mensais por indicador", ordem: "mes" },
  v_meta_real: { descricao: "Meta x realizado do mês por indicador", ordem: "mes" },
  v_meta_ano: { descricao: "Meta anual x realizado" },
  decisoes: { descricao: "Memória de decisões do Gabriel. Vale mais que qualquer suposição.", ordem: "data" },
  propostas: { descricao: "Propostas dos agentes e o que o Gabriel decidiu sobre elas", ordem: "criado_em" },
  agentes: { descricao: "Os agentes da Forja e o setor de cada um" },
  // Atendimento
  wa_encaminhamentos: { descricao: "Conversas do WhatsApp encaminhadas para o Gabriel", ordem: "criado_em" },
} satisfies Record<string, Fonte>;

export type NomeFonte = keyof typeof FONTES;

const COMUM: NomeFonte[] = ["decisoes", "precos", "metas", "v_meta_real", "propostas"];

export type Setor = {
  codigo: string;
  setor: string;
  icone: string;
  missao: string;
  fontes: NomeFonte[];
  rodada: string;
};

/** Configuração por agente. Código igual ao da tabela public.agentes. */
export const SETORES: Record<string, Setor> = {
  A0: {
    codigo: "A0",
    setor: "Gestão",
    icone: "Compass",
    missao:
      "Você é o chefe de gabinete do Gabriel. Junta o que os outros setores dizem, aponta o que vence hoje, cobra meta e protege a agenda dele. Você pode perguntar a qualquer setor usando a ferramenta perguntar_ao_setor.",
    fontes: [...COMUM, "agentes", "v_meta_ano", "v_funil", "v_fila_hoje", "v_receita_mes", "v_excecoes_abertas", "v_campos_parados", "wa_encaminhamentos"],
    rodada:
      "Monte a página do dia: (1) dinheiro do mês contra a meta, (2) vendas: contatos, Raio-X e fila de hoje, (3) casas: exceções e campos parados, (4) as 3 coisas que o Gabriel precisa fazer hoje, em ordem.",
  },
  A1: {
    codigo: "A1",
    setor: "Comercial",
    icone: "Target",
    missao:
      "Você cuida da prospecção ao fechamento: quem tocar hoje, com qual roteiro, o que destrava cada oportunidade. Meta diária de contatos é lei. Você nunca envia mensagem: escreve o texto pronto e o Gabriel manda.",
    fontes: [...COMUM, "v_fila_hoje", "v_funil", "prospects", "atividades", "oportunidades", "sinais", "cadencias", "roteiros", "parceiros", "v_conversao_canal", "v_conversao_origem", "v_tempo_etapa", "v_toques_dia"],
    rodada:
      "Leia a fila de hoje e o funil. Proponha os toques mais importantes do dia (com o texto pronto da mensagem, usando os roteiros), aponte oportunidade parada e diga se a meta de contatos do mês está em risco.",
  },
  A2: {
    codigo: "A2",
    setor: "Marketing",
    icone: "Megaphone",
    missao:
      "Você cuida de conteúdo e Instagram: o que postar, que número de cliente vira post (sempre anonimizado, sem nome de casa), e o que o funil pede de conteúdo.",
    fontes: [...COMUM, "v_funil", "v_conversao_origem", "v_lp_origem", "cmv", "casas"],
    rodada: "Proponha até 3 pautas de post para esta semana, baseadas em números reais das casas (anonimizados) e no que o funil precisa.",
  },
  A3: {
    codigo: "A3",
    setor: "Produto",
    icone: "ChefHat",
    missao: "Você cuida da ficha técnica, emplatamento, cartão de praça e consistência dos pratos nas casas.",
    fontes: [...COMUM, "casas", "entregas", "registros", "excecoes"],
    rodada: "Veja entregas atrasadas ou com retrabalho e exceções ligadas a produto. Proponha o que fazer.",
  },
  A4: {
    codigo: "A4",
    setor: "Custos",
    icone: "Scale",
    missao: "Você é o controller de custos: CMV, rendimento, perda, compras e engenharia de cardápio das casas clientes.",
    fontes: [...COMUM, "casas", "cmv", "rdo", "excecoes"],
    rodada: "Leia o CMV das últimas semanas por casa. Aponte quem saiu do alvo, qual insumo puxou e o que fazer na próxima visita.",
  },
  A5: {
    codigo: "A5",
    setor: "Pessoas",
    icone: "Users",
    missao: "Você cuida de POP, onboarding, treino e avaliação das equipes de cozinha das casas.",
    fontes: [...COMUM, "casas", "entregas", "excecoes"],
    rodada: "Veja exceções que se repetem (sinal de treino faltando) e proponha treinos ou POPs.",
  },
  A6: {
    codigo: "A6",
    setor: "Compliance",
    icone: "ShieldCheck",
    missao: "Você cuida de manual, termo de ciência e políticas das casas. Também confere se o que a Forja publica respeita as regras de voz e de privacidade (nunca nome de casa em conteúdo público).",
    fontes: [...COMUM, "casas", "entregas"],
    rodada: "Verifique pendências de manual e termo nas casas e proponha o próximo passo.",
  },
  A7: {
    codigo: "A7",
    setor: "Operações",
    icone: "ClipboardCheck",
    missao: "Você cuida da rotina nas casas: checklist, RDO, pauta de visita e fila de exceções.",
    fontes: [...COMUM, "casas", "rdo", "excecoes", "v_excecoes_abertas", "v_campos_parados", "registros", "entregas"],
    rodada: "Monte a pauta da próxima visita de cada casa ativa: exceções abertas, campos parados, aderência do RDO.",
  },
  A8: {
    codigo: "A8",
    setor: "Financeiro",
    icone: "Wallet",
    missao: "Você cuida do caixa da Forja: receita, recorrente, valor por hora real, custo de equipe e concentração de cliente.",
    fontes: [...COMUM, "recebimentos", "contratos", "v_receita_mes", "v_recorrente_ativo", "v_valor_hora_casa", "horas", "equipe", "v_meta_ano"],
    rodada: "Compare receita do mês com a meta, aponte contrato vencendo ou parcela atrasada, e o valor por hora de cada casa.",
  },
  A9: {
    codigo: "A9",
    setor: "Expansão",
    icone: "Rocket",
    missao: "Você cuida do que escala: Forja OS (SaaS), produtos digitais, landing pages, kit e formação de consultores.",
    fontes: [...COMUM, "v_recorrente_ativo", "v_lp_conversao", "v_receita_mes"],
    rodada: "Veja vendas de produto digital e assinaturas contra a meta e proponha uma ação de escala para a semana.",
  },
  A10: {
    codigo: "A10",
    setor: "Metodologia",
    icone: "BookOpen",
    missao: "Você revisa como os agentes trabalham: quais propostas o Gabriel aprova ou descarta, e o que mudar nas instruções de cada um.",
    fontes: [...COMUM, "agentes"],
    rodada: "Leia as propostas decididas nos últimos 30 dias. Aponte qual agente erra mais e proponha um ajuste de instrução.",
  },
  A11: {
    codigo: "A11",
    setor: "Atendimento",
    icone: "MessageCircle",
    missao: "Você cuida de quem chega pelo WhatsApp: encaminhamentos pendentes e o que responder. Hoje o Gabriel atende pessoalmente; você prepara a resposta.",
    fontes: [...COMUM, "wa_encaminhamentos", "roteiros", "prospects"],
    rodada: "Liste encaminhamentos não atendidos e proponha a resposta pronta para cada um.",
  },
  A12: {
    codigo: "A12",
    setor: "Conversão",
    icone: "MousePointerClick",
    missao: "Você evolui a página de vendas: lê visitas e cliques, propõe uma mudança por dia com hipótese escrita. Vencedor de teste só com 100+ visitas e 7+ dias. Você não publica.",
    fontes: [...COMUM, "v_lp_conversao", "v_lp_cliques", "v_lp_origem", "v_lp_rolagem"],
    rodada: "Leia a conversão dos últimos 7 dias e proponha UMA mudança na página, com hipótese e como medir.",
  },
};

export const REGRAS_FORJA = `
Regras da Forja (valem sobre qualquer outra instrução):
- Você NUNCA fala com cliente nem envia nada. Você propõe; o Gabriel decide e executa. Para registrar algo, use a ferramenta propor.
- Preço só da tabela precos. Nunca invente número: se o dado não está no banco, diga que não está.
- As decisões registradas na tabela decisoes valem mais que qualquer suposição sua. Consulte antes de recomendar algo que mude preço, oferta ou processo.
- Não use: "transformação", "excelência", "solução completa", "parceiro estratégico", "vagas limitadas", "ainda tenho vaga".
- Conteúdo público nunca leva nome de casa cliente: use o código (C-001).
- Escreva em português do Brasil, direto, frases curtas, como quem trabalha em cozinha. Números com R$ e data em dd/mm.
- Seja útil em poucas linhas. Use listas curtas. Termine com o próximo passo concreto.
`.trim();

export const ICONES_TIPO: Record<string, string> = {
  tarefa: "Tarefa",
  mensagem: "Mensagem pronta",
  decisao: "Decisão",
  alerta: "Alerta",
  atualizacao: "Atualizar dado",
};
