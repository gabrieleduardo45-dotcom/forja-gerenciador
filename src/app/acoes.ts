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
  const { data: antes } = await sb.from("prospects").select("estagio").eq("id", id).single();
  const agora = new Date().toISOString();
  const { error } = await sb.from("prospects").update({ estagio, estagio_desde: agora, atualizado_em: agora }).eq("id", id);
  if (error) throw new Error(error.message);
  await sb.from("estagio_historico").insert({ prospect_id: id, de: antes?.estagio ?? null, para: estagio, data_hora: agora, motivo: "central" });
  revalidatePath("/comercial");
}

export async function apagarConversa(id: string) {
  const { sb } = await sessao();
  await sb.from("agente_conversas").delete().eq("id", id);
  revalidatePath("/agentes");
}
