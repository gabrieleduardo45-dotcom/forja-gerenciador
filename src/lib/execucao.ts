import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O que um agente pode pedir para o banco fazer quando o Gabriel aprova uma proposta.
 * Tudo fora desta lista é recusado: o agente propõe, o código decide se é permitido.
 */
export const PERMITIDO = {
  atualizar: {
    prospects: ["estagio", "prioridade_manual", "proximo_toque_em", "obs", "bairro", "decisor_nome", "decisor_cargo", "whatsapp_decisor", "instagram_casa", "instagram_decisor", "motivo_perda"],
    excecoes: ["estado", "resolvida", "acao", "prazo", "responsavel", "causa"],
    oportunidades: ["status", "motivo_perda"],
    entregas: ["status"],
  },
  inserir: {
    prospects: ["nome_casa", "setor", "bairro", "endereco", "decisor_nome", "decisor_cargo", "whatsapp_decisor", "instagram_casa", "instagram_decisor", "fonte_url", "origem", "origem_detalhe", "prioridade_manual", "proximo_toque_em", "obs"],
    sinais: ["prospect_id", "tipo", "descricao", "fonte_url", "data_sinal", "natureza"],
    excecoes: ["casa_id", "o_que", "causa", "acao", "responsavel", "prazo"],
  },
} as const;

/** Valores aceitos pelo banco (checks da tabela). Recusar aqui evita aprovação que falha. */
export const VALORES: Record<string, readonly string[]> = {
  prioridade_manual: ["brasa", "faisca", "temperado", "descarte"],
  setor: ["self_service", "marmitaria", "cozinha_producao", "a_la_carte", "pizzaria", "hamburgueria", "lanchonete", "bar", "cafe", "food_service", "outro"],
  origem: ["pesquisa_a1", "indicacao_cliente", "parceiro", "inbound_calculadora", "inbound_fichas", "inbound_whatsapp", "inbound_instagram", "evento", "trafego_pago", "visita_fria", "ligacao_fria", "outro"],
  estagio: ["identificado", "na_lista", "em_cadencia", "conversa", "qualificado", "conversa_presencial", "raiox_proposto", "raiox_agendado", "raiox_pago", "raiox_entregue", "proposta_enviada", "implantacao_fechada", "care_ativo", "nutricao", "perdido", "descartado"],
  motivo_perda: ["preco", "momento", "nao_ve_problema", "sem_decisor", "ja_tem_consultor", "sumiu", "nao_cabe_icp", "outro"],
};

export type Operacao = keyof typeof PERMITIDO;
export type Acao = { operacao: Operacao; tabela: string; id?: number; campos: Record<string, unknown> };

export const TABELAS_ACAO = [...new Set([...Object.keys(PERMITIDO.atualizar), ...Object.keys(PERMITIDO.inserir)])] as [string, ...string[]];

/** Confere a ação contra a lista. Devolve o motivo da recusa, ou null se está tudo certo. */
export function validarAcao(a: Acao): string | null {
  const tabelas = PERMITIDO[a.operacao] as Record<string, readonly string[]> | undefined;
  const colunas = tabelas?.[a.tabela];
  if (!colunas) return `Não é permitido ${a.operacao} em ${a.tabela}.`;
  if (a.operacao === "atualizar" && !a.id) return "Falta o id da linha a atualizar.";
  const chaves = Object.keys(a.campos ?? {});
  if (!chaves.length) return "Nenhum campo informado.";
  const fora = chaves.filter((c) => !colunas.includes(c));
  if (fora.length) return `Campos não permitidos em ${a.tabela}: ${fora.join(", ")}.`;
  if (a.tabela === "prospects") {
    for (const [c, v] of Object.entries(a.campos)) {
      if (VALORES[c] && v != null && !VALORES[c].includes(String(v))) return `${c} inválido (${v}). Use um de: ${VALORES[c].join(", ")}.`;
    }
  }
  if (a.operacao === "inserir" && a.tabela === "prospects" && !a.campos.nome_casa) return "Prospect novo precisa de nome_casa.";
  if (a.operacao === "inserir" && a.tabela === "excecoes" && (!a.campos.casa_id || !a.campos.o_que)) return "Exceção precisa de casa_id e o_que.";
  if (a.operacao === "inserir" && a.tabela === "sinais" && !a.campos.prospect_id) return "Sinal precisa de prospect_id.";
  return null;
}

/** Texto curto do que vai acontecer, para mostrar no cartão da proposta. */
export function descreverAcao(a: Acao) {
  const campos = Object.entries(a.campos ?? {})
    .map(([k, v]) => `${k} → ${String(v)}`)
    .join(", ");
  return a.operacao === "atualizar" ? `Atualiza ${a.tabela} #${a.id}: ${campos}` : `Cria em ${a.tabela}: ${campos}`;
}

/** Aplica a ação com o login de quem aprovou (o RLS vale). */
export async function aplicarAcao(sb: SupabaseClient, a: Acao): Promise<{ ok: boolean; msg: string }> {
  const erro = validarAcao(a);
  if (erro) return { ok: false, msg: erro };
  if (a.operacao === "atualizar") {
    const { data, error } = await sb.from(a.tabela).update(a.campos).eq("id", a.id!).select("id");
    if (error) return { ok: false, msg: error.message };
    if (!data?.length) return { ok: false, msg: `Linha ${a.tabela} #${a.id} não encontrada.` };
    return { ok: true, msg: descreverAcao(a) };
  }
  const valores = a.tabela === "prospects" ? { ...a.campos, aprovado_gabriel: true } : a.campos;
  const { data, error } = await sb.from(a.tabela).insert(valores).select("*").single();
  if (error) return { ok: false, msg: error.message };
  const ref = (data as { codigo?: string; id?: number }).codigo ?? `#${(data as { id?: number }).id}`;
  return { ok: true, msg: `${descreverAcao(a)} (${ref})` };
}
