import { generateText, isStepCount, tool, type ToolSet } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FONTES, REGRAS_FORJA, SETORES, type NomeFonte } from "./agentes";
import { PERMITIDO, TABELAS_ACAO, validarAcao, type Acao } from "./execucao";
import { casasDoForjaOS, resumoParaAgente } from "./forja-os";

export const MODELO = process.env.FORJA_MODELO || "anthropic/claude-sonnet-5.5";
export const PASSOS_MAX = 12;

export function hojeManaus() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());
}

/** Instruções completas de um agente: missão do setor, fontes que ele lê e as regras da Forja. */
export function instrucoes(codigo: string, nome: string) {
  const s = SETORES[codigo];
  const hoje = hojeManaus();
  const fontes = s.fontes.map((f) => `- ${f}: ${FONTES[f].descricao}`).join("\n");
  return `Você é ${nome} (${codigo}), agente do setor ${s.setor} da Forja, consultoria de padrão de cozinha para restaurantes em Manaus. O dono é o Gabriel.

${s.missao}

Hoje é ${hoje} (horário de Manaus).

Dados que você pode ler com a ferramenta consultar:
${fontes}

Como trabalhar:
- Antes de afirmar qualquer número, consulte. Prefira as views (v_*) que já trazem a conta feita.
- Quando chegar a uma recomendação acionável, registre com a ferramenta propor (uma proposta por ação). Diga ao Gabriel que ela está na fila de aprovação.
- Se a base estiver vazia, diga isso com clareza e proponha como começar a preenchê-la.

${REGRAS_FORJA}`;
}

const filtro = z.object({
  coluna: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is"]),
  valor: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

type Ctx = { sb: SupabaseClient; codigo: string; conversaId?: string | null; profundidade?: number };

/** Ferramentas de um agente. A leitura é limitada às fontes do setor; a escrita é só na fila de propostas. */
export function ferramentas({ sb, codigo, conversaId, profundidade = 0 }: Ctx): ToolSet {
  const s = SETORES[codigo];
  const fontes = s.fontes as [NomeFonte, ...NomeFonte[]];

  const t: ToolSet = {
    consultar: tool({
      description:
        "Lê linhas de uma tabela ou view da Forja. Use filtros para recortar (ex.: estagio eq 'proposta', data gte '2026-11-01'). Retorna no máximo 'limite' linhas.",
      inputSchema: z.object({
        fonte: z.enum(fontes),
        filtros: z.array(filtro).max(6).optional(),
        ordenar_por: z.string().regex(/^[a-z_][a-z0-9_]*$/).optional(),
        crescente: z.boolean().optional(),
        limite: z.number().int().min(1).max(200).optional(),
      }),
      execute: async ({ fonte, filtros, ordenar_por, crescente, limite }) => {
        let q = sb.from(fonte).select("*", { count: "exact" });
        for (const f of filtros ?? []) {
          q = f.op === "is" ? q.is(f.coluna, f.valor as null | boolean) : q.filter(f.coluna, f.op, f.valor);
        }
        const ordem = ordenar_por ?? (FONTES[fonte] as { ordem?: string }).ordem;
        if (ordem) q = q.order(ordem, { ascending: crescente ?? false, nullsFirst: false });
        const { data, error, count } = await q.limit(limite ?? 50);
        if (error) return { erro: error.message };
        return { total: count, linhas: data };
      },
    }),
    propor: tool({
      description:
        "Coloca uma proposta na fila de aprovação do Gabriel. Use para toda ação concreta: tarefa, mensagem pronta para enviar, decisão a tomar, alerta ou dado a atualizar. " +
        "Se a proposta for mudar o banco (tipo atualizacao), preencha 'acao': ao aprovar, o sistema executa sozinho. Permitido: " +
        Object.entries(PERMITIDO)
          .map(([op, t]) => `${op} → ` + Object.entries(t).map(([tab, cols]) => `${tab}(${cols.join(",")})`).join("; "))
          .join(" | ") +
        ". Use o id numérico da linha (consulte antes).",
      inputSchema: z.object({
        tipo: z.enum(["tarefa", "mensagem", "decisao", "alerta", "atualizacao"]),
        prioridade: z.enum(["alta", "media", "baixa"]),
        titulo: z.string().min(4).max(140).describe("Ação em uma linha, começando com verbo"),
        detalhe: z.string().max(4000).describe("Por quê, com os números. Se for mensagem, coloque o texto pronto para enviar em linhas citadas com > (markdown)."),
        alvo: z.string().max(120).optional().describe("Casa, prospect ou contrato envolvido (código)"),
        prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        acao: z
          .object({
            operacao: z.enum(["atualizar", "inserir"]),
            tabela: z.enum(TABELAS_ACAO),
            id: z.number().int().optional().describe("Obrigatório para atualizar"),
            campos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
          })
          .optional()
          .describe("Só para tipo atualizacao: o que o sistema faz no banco quando o Gabriel aprovar."),
      }),
      execute: async ({ acao, ...p }) => {
        if (acao) {
          const erro = validarAcao(acao as Acao);
          if (erro) return { erro: `Ação recusada: ${erro}` };
        }
        const { data, error } = await sb
          .from("propostas")
          .insert({ ...p, payload: acao ? { acao } : {}, agente: codigo, conversa_id: conversaId ?? null })
          .select("id")
          .single();
        if (error) return { erro: error.message };
        return { ok: true, id: data.id, aviso: acao ? "Na fila. Ao aprovar, o sistema executa." : "Na fila de aprovação." };
      },
    }),
  };

  // Casas reais, lidas do FORJA OS (só leitura). Quem cuida de cozinha, custo e conteúdo enxerga.
  if (["A0", "A2", "A3", "A4", "A5", "A7"].includes(codigo)) {
    t.casas_forja_os = tool({
      description:
        "Lê as casas (restaurantes clientes) no FORJA OS: CMV da semana contra o alvo, checklist cumprido, uso da equipe, desperdício, contas vencidas e as últimas 4 semanas. Use para falar de casa com número real. Para conteúdo público, nunca cite o nome da casa.",
      inputSchema: z.object({ casa: z.string().optional().describe("Parte do nome para filtrar; vazio traz todas") }),
      execute: async ({ casa }) => {
        const r = await casasDoForjaOS();
        if (!r.ok) return { erro: r.erro };
        const lista = r.casas.filter((c) => !casa || c.nome.toLowerCase().includes(casa.toLowerCase()));
        return { gerado: r.gerado, total: lista.length, casas: lista.map(resumoParaAgente) };
      },
    });
  }

  // O Diretor de Gestão coordena: pode consultar qualquer setor (um nível só, sem cascata).
  if (codigo === "A0" && profundidade === 0) {
    const outros = Object.keys(SETORES).filter((c) => c !== "A0") as [string, ...string[]];
    t.perguntar_ao_setor = tool({
      description:
        "Faz uma pergunta a outro agente da Forja e devolve a resposta dele. Use para consolidar a visão da empresa. Códigos: " +
        outros.map((c) => `${c}=${SETORES[c].setor}`).join(", "),
      inputSchema: z.object({ setor: z.enum(outros), pergunta: z.string().min(4).max(1500) }),
      execute: async ({ setor, pergunta }) => {
        const r = await executarAgente({ sb, codigo: setor, prompt: pergunta, profundidade: 1 });
        return { setor: SETORES[setor].setor, resposta: r.texto, propostas_criadas: r.propostas };
      },
    });
  }
  return t;
}

export async function nomeAgente(sb: SupabaseClient, codigo: string) {
  const { data } = await sb.from("agentes").select("nome").eq("codigo", codigo).maybeSingle();
  return data?.nome ?? SETORES[codigo]?.setor ?? codigo;
}

/** Executa um agente sem streaming (rodada do dia, pergunta entre setores). */
export async function executarAgente({
  sb,
  codigo,
  prompt,
  profundidade = 0,
  conversaId,
}: Ctx & { prompt: string }) {
  const nome = await nomeAgente(sb, codigo);
  const r = await generateText({
    model: MODELO,
    instructions: instrucoes(codigo, nome),
    prompt,
    tools: ferramentas({ sb, codigo, profundidade, conversaId }),
    stopWhen: isStepCount(PASSOS_MAX),
  });
  const propostas = r.steps
    .flatMap((st) => st.toolResults)
    .filter((tr) => tr.toolName === "propor" && (tr.output as { ok?: boolean })?.ok).length;
  return { texto: r.text, propostas };
}

/** Data (AAAA-MM-DD) de n dias atrás. */
export function diasAtras(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}
