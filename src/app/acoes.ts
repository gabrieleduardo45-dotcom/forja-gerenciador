"use server";

import { revalidatePath } from "next/cache";
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

export async function apagarConversa(id: string) {
  const { sb } = await sessao();
  await sb.from("agente_conversas").delete().eq("id", id);
  revalidatePath("/agentes");
}
