"use server";

import { revalidatePath } from "next/cache";
import { aplicarAcao, type Acao } from "@/lib/execucao";
import { hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

async function sessao() {
  const { sb, user } = await usuarioAtual();
  if (!user) throw new Error("Sessão expirada. Entre de novo.");
  return { sb, email: user.email ?? "" };
}

/** Decide uma proposta. Aprovar uma proposta do tipo "decisao" grava na memória de decisões. */
export async function decidirProposta(id: number, status: "aprovada" | "descartada" | "feita" | "pendente", nota?: string) {
  const { sb, email } = await sessao();
  const { data: p, error } = await sb
    .from("propostas")
    .update({
      status,
      decidido_em: status === "pendente" ? null : new Date().toISOString(),
      decidido_por: status === "pendente" ? null : email,
      nota_decisao: nota || null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (status === "aprovada" && p.tipo === "decisao") {
    await sb.from("decisoes").insert({
      data: hojeManaus(),
      assunto: p.titulo,
      decisao: p.detalhe ?? p.titulo,
      motivo: nota || `Proposta #${p.id} aprovada na central`,
      agente: p.agente,
      reversivel: true,
    });
  }

  // Proposta com ação no banco: aprovar executa. Deu certo, vira "feita"; deu errado, fica aprovada com o motivo.
  const acao = (p.payload as { acao?: Acao } | null)?.acao;
  if (status === "aprovada" && acao) {
    const r = await aplicarAcao(sb, acao);
    await sb
      .from("propostas")
      .update({ status: r.ok ? "feita" : "aprovada", nota_decisao: r.ok ? `Executado: ${r.msg}` : `Não executou: ${r.msg}` })
      .eq("id", id);
  }
  revalidatePath("/", "layout");
}

export async function alternarAgente(codigo: string, ativo: boolean) {
  const { sb } = await sessao();
  const { error } = await sb.from("agentes").update({ ativo, instalado_em: ativo ? hojeManaus() : null }).eq("codigo", codigo);
  if (error) throw new Error(error.message);
  revalidatePath("/agentes");
}

export async function registrarDecisao(form: FormData) {
  const { sb } = await sessao();
  const assunto = String(form.get("assunto") ?? "").trim();
  const decisao = String(form.get("decisao") ?? "").trim();
  if (!assunto || !decisao) return;
  const { error } = await sb.from("decisoes").insert({
    data: hojeManaus(),
    assunto,
    decisao,
    motivo: String(form.get("motivo") ?? "").trim() || null,
    agente: String(form.get("agente") ?? "") || null,
    reversivel: form.get("reversivel") === "on",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/decisoes");
}

export async function moverProspect(id: number, estagio: string) {
  const { sb } = await sessao();
  // O gatilho prospect_antes/depois grava estagio_desde e o histórico.
  const { error } = await sb.from("prospects").update({ estagio }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/comercial");
}

export type Resultado = { ok: boolean; msg: string };

const txt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Registra um toque comercial. O gatilho atividade_depois move o funil e marca o próximo toque. */
export async function registrarToque(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb, email } = await sessao();
  const prospect_id = Number(f.get("prospect_id"));
  if (!prospect_id) return { ok: false, msg: "Escolha a casa." };
  const { error } = await sb.from("atividades").insert({
    prospect_id,
    canal: txt(f, "canal") ?? "whatsapp",
    direcao: txt(f, "direcao") ?? "saida",
    tipo: txt(f, "tipo") ?? "primeiro_toque",
    resultado: txt(f, "resultado") ?? "sem_resposta",
    variante_roteiro: txt(f, "roteiro"),
    proxima_acao: txt(f, "proxima_acao"),
    proxima_acao_em: txt(f, "proxima_acao_em"),
    obs: txt(f, "obs"),
    quem: email.split("@")[0],
  });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/", "layout");
  return { ok: true, msg: "Toque registrado." };
}

export async function novoProspect(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const nome_casa = txt(f, "nome_casa");
  if (!nome_casa) return { ok: false, msg: "Nome da casa é obrigatório." };
  const { data, error } = await sb
    .from("prospects")
    .insert({
      nome_casa,
      setor: txt(f, "setor") ?? "outro",
      bairro: txt(f, "bairro"),
      decisor_nome: txt(f, "decisor_nome"),
      whatsapp_decisor: txt(f, "whatsapp_decisor"),
      instagram_casa: txt(f, "instagram_casa"),
      origem: txt(f, "origem") ?? "outro",
      prioridade_manual: txt(f, "prioridade_manual"),
      proximo_toque_em: txt(f, "proximo_toque_em"),
      estagio: txt(f, "proximo_toque_em") ? "na_lista" : "identificado",
      aprovado_gabriel: true,
      obs: txt(f, "obs"),
    })
    .select("codigo")
    .single();
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/comercial");
  return { ok: true, msg: `${data.codigo} cadastrado.` };
}

export async function lancarRecebimento(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const valor = Number(String(f.get("valor") ?? "").replace(",", "."));
  const produto = txt(f, "produto");
  if (!produto || !(valor > 0)) return { ok: false, msg: "Produto e valor são obrigatórios." };
  const { error } = await sb.from("recebimentos").insert({
    produto,
    valor,
    data: txt(f, "data") ?? hojeManaus(),
    linha: txt(f, "linha") ?? "outro",
    forma: txt(f, "forma"),
    obs: txt(f, "obs"),
  });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/", "layout");
  return { ok: true, msg: "Recebimento lançado." };
}

/** Fecha a implantação: casa + contrato + oportunidade ganha + prospect em "implantação fechada", numa transação. */
export async function fecharImplantacao(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const prospect_id = Number(f.get("prospect_id"));
  const valor = Number(String(f.get("valor") ?? "").replace(",", "."));
  const produto = txt(f, "produto");
  if (!prospect_id || !produto || !(valor > 0)) return { ok: false, msg: "Casa, produto e valor são obrigatórios." };
  const meses = Number(f.get("meses")) || null;
  const { data, error } = await sb.rpc("fechar_implantacao", {
    p_prospect_id: prospect_id,
    p_produto: produto,
    p_valor: valor,
    p_condicao: txt(f, "condicao") ?? "fundadora",
    p_meses: meses,
    p_inicio: txt(f, "inicio") ?? hojeManaus(),
    p_forma_pagamento: txt(f, "forma_pagamento"),
    p_unidade: txt(f, "unidade") ?? "avulso",
    p_frentes: f.getAll("frentes").map(String),
  });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/", "layout");
  return { ok: true, msg: `Fechado. ${data} criada com contrato.` };
}

/** Proposta comercial enviada: abre uma oportunidade e leva o prospect para "proposta enviada". */
export async function novaOportunidade(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const prospect_id = Number(f.get("prospect_id"));
  const preco_id = Number(f.get("preco_id"));
  if (!prospect_id || !preco_id) return { ok: false, msg: "Casa e produto são obrigatórios." };
  const condicao = txt(f, "condicao") ?? "fundadora";
  const { data: preco, error: e1 } = await sb.from("precos").select("produto,fundadora,cheia").eq("id", preco_id).single();
  if (e1) return { ok: false, msg: e1.message };
  const tabela = Number(f.get("valor")) || Number(condicao === "cheia" ? preco.cheia : preco.fundadora) || null;
  const { error } = await sb.from("oportunidades").insert({
    prospect_id,
    preco_id,
    produto: preco.produto,
    valor_tabela: tabela,
    condicao,
    desconto_avista: f.get("desconto_avista") === "on",
    data_proposta: txt(f, "data_proposta") ?? hojeManaus(),
    status: "aberta",
  });
  if (error) return { ok: false, msg: error.message };
  const { data: p } = await sb.from("prospects").select("estagio").eq("id", prospect_id).single();
  const antes = ["identificado", "na_lista", "em_cadencia", "conversa", "qualificado", "conversa_presencial", "raiox_proposto", "raiox_agendado", "raiox_pago", "raiox_entregue", "nutricao"];
  if (p && antes.includes(p.estagio)) await sb.from("prospects").update({ estagio: "proposta_enviada" }).eq("id", prospect_id);
  revalidatePath("/comercial");
  return { ok: true, msg: "Proposta registrada." };
}

export async function perderOportunidade(id: number, motivo: string) {
  const { sb } = await sessao();
  const { data: o, error } = await sb.from("oportunidades").update({ status: "perdida", motivo_perda: motivo }).eq("id", id).select("prospect_id").single();
  if (error) throw new Error(error.message);
  if (o?.prospect_id) await sb.from("prospects").update({ estagio: "perdido", motivo_perda: motivo }).eq("id", o.prospect_id);
  revalidatePath("/comercial");
}

export async function registrarExcecao(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const casa_id = Number(f.get("casa_id"));
  const o_que = txt(f, "o_que");
  if (!casa_id || !o_que) return { ok: false, msg: "Casa e o que aconteceu são obrigatórios." };
  const { error } = await sb.from("excecoes").insert({
    casa_id,
    o_que,
    data: txt(f, "data") ?? hojeManaus(),
    causa: txt(f, "causa"),
    acao: txt(f, "acao"),
    responsavel: txt(f, "responsavel"),
    prazo: txt(f, "prazo"),
    estado: txt(f, "estado") ?? "faisca",
  });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/", "layout");
  return { ok: true, msg: "Exceção registrada." };
}

export async function resolverExcecao(id: number) {
  const { sb } = await sessao();
  const { error } = await sb.from("excecoes").update({ resolvida: true, estado: "temperado" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** CMV da semana. Estado no semáforo da Forja: temperado (no alvo), faísca (até 2 pontos acima), brasa (mais que isso). */
export async function lancarCmv(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const casa_id = Number(f.get("casa_id"));
  const cmv = Number(String(f.get("cmv_pct") ?? "").replace(",", "."));
  const alvo = Number(String(f.get("alvo_pct") ?? "").replace(",", "."));
  const semana = txt(f, "semana_inicio");
  if (!casa_id || !semana || !(cmv > 0) || !(alvo > 0)) return { ok: false, msg: "Casa, semana, CMV e alvo são obrigatórios." };
  const estado = cmv <= alvo ? "temperado" : cmv <= alvo + 2 ? "faisca" : "brasa";
  const { error } = await sb.from("cmv").insert({ casa_id, semana_inicio: semana, cmv_pct: cmv, alvo_pct: alvo, estado, conta_md: txt(f, "obs") });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/casas");
  return { ok: true, msg: `CMV lançado (${estado}).` };
}

export async function apagarConversa(id: string) {
  const { sb } = await sessao();
  await sb.from("agente_conversas").delete().eq("id", id);
  revalidatePath("/agentes");
}
