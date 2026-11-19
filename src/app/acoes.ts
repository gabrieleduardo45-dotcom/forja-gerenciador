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

/* ---------- Sobra e descarte por foto ---------- */

export type LeituraFoto = { foto: string; itens: import("@/lib/desperdicio").ItemLido[]; erro?: string };

/** Sobe as fotos (já reduzidas no celular) e pede para a IA ler cada uma. Não grava nada ainda: o Gabriel confere antes. */
export async function analisarFotos(f: FormData): Promise<{ ok: boolean; msg: string; leituras: LeituraFoto[] }> {
  const { sb } = await sessao();
  const { lerFoto } = await import("@/lib/desperdicio");
  const casa = txt(f, "casa_nome") ?? "sem-casa";
  const legenda = txt(f, "legenda") ?? undefined;
  const fotos = f.getAll("fotos").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 12);
  if (!fotos.length) return { ok: false, msg: "Escolha ao menos uma foto.", leituras: [] };
  const pasta = `${hojeManaus()}/${casa.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;
  const leituras = await Promise.all(
    fotos.map(async (arq): Promise<LeituraFoto> => {
      const bytes = new Uint8Array(await arq.arrayBuffer());
      const tipo = arq.type || "image/jpeg";
      const caminho = `${pasta}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("desperdicio").upload(caminho, bytes, { contentType: tipo });
      try {
        const itens = await lerFoto(bytes, tipo, legenda);
        return { foto: up.error ? "" : caminho, itens };
      } catch (e) {
        return { foto: up.error ? "" : caminho, itens: [], erro: e instanceof Error ? e.message : "Não consegui ler" };
      }
    }),
  );
  const n = leituras.reduce((a, l) => a + l.itens.length, 0);
  return { ok: true, msg: `${n} itens lidos em ${fotos.length} fotos. Confira e salve.`, leituras };
}

export type RegistroDesperdicio = {
  casa_os_id?: string | null; casa_nome: string; data?: string; item: string; tipo: "sobra" | "descarte";
  peso_kg: number | null; peso_fonte: "balanca" | "estimado" | "informado" | null; motivo: string | null; foto: string | null; confianca: number | null;
};

export async function salvarDesperdicio(registros: RegistroDesperdicio[]): Promise<Resultado> {
  const { sb } = await sessao();
  const linhas = registros.filter((r) => r.item?.trim() && r.casa_nome?.trim()).map((r) => ({ ...r, data: r.data || hojeManaus(), origem: "app" }));
  if (!linhas.length) return { ok: false, msg: "Nada para salvar." };
  const { error } = await sb.from("desperdicio").insert(linhas);
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/casas");
  revalidatePath("/painel");
  const kg = (t: string) => linhas.filter((l) => l.tipo === t).reduce((a, l) => a + Number(l.peso_kg ?? 0), 0);
  return { ok: true, msg: `Salvo: ${kg("sobra").toFixed(1)} kg de sobra e ${kg("descarte").toFixed(1)} kg de descarte.` };
}

/** Casas do FORJA OS para escolher no lançamento (lido só quando o formulário abre). */
export async function casasParaLancar(): Promise<{ id: string; nome: string }[]> {
  await sessao();
  const { casasDoForjaOS } = await import("@/lib/forja-os");
  const r = await casasDoForjaOS();
  return r.casas.map((c) => ({ id: c.id, nome: c.nome }));
}

/* ---------- Modo simples: Clientes em 4 colunas ---------- */

/** Cadastro de 3 campos: nome, contato (WhatsApp ou @) e coluna. O resto é opcional. */
export async function novoRestaurante(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const { COLUNAS, lerContato } = await import("@/lib/funil");
  const nome_casa = txt(f, "nome_casa");
  if (!nome_casa) return { ok: false, msg: "Escreva o nome do restaurante." };
  const coluna = COLUNAS.find((c) => c.k === txt(f, "coluna")) ?? COLUNAS[0];
  const ehCliente = coluna.k === "cliente";
  const { data, error } = await sb
    .from("prospects")
    .insert({
      nome_casa,
      ...lerContato(txt(f, "contato")),
      setor: txt(f, "setor") ?? "outro",
      bairro: txt(f, "bairro"),
      origem: txt(f, "origem") ?? "outro",
      estagio: coluna.destino,
      proximo_toque_em: ehCliente ? null : hojeManaus(),
      aprovado_gabriel: true,
      obs: txt(f, "obs"),
    })
    .select("codigo")
    .single();
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/", "layout");
  return { ok: true, msg: ehCliente ? `${nome_casa} entrou como cliente.` : `${nome_casa} cadastrado (${data.codigo}).` };
}

/** Move o restaurante de coluna. Cliente ganha a casa sozinho (gatilho prospect_vira_casa). */
export async function moverColuna(id: number, coluna: string) {
  const { sb } = await sessao();
  const { COLUNAS } = await import("@/lib/funil");
  const estagio = coluna === "perdido" ? "perdido" : COLUNAS.find((c) => c.k === coluna)?.destino;
  if (!estagio) throw new Error("Coluna inválida");
  const { error } = await sb.from("prospects").update({ estagio, ...(coluna === "perdido" ? { motivo_perda: "outro" } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** "Falei": registra o toque de hoje e tira da lista do dia. */
export async function faleiHoje(id: number, canal: "whatsapp" | "instagram" | "visita" | "ligacao") {
  const { sb, email } = await sessao();
  const nomeCanal = { whatsapp: "whatsapp", instagram: "instagram_dm", visita: "visita_fria", ligacao: "ligacao_fria" }[canal];
  const { error } = await sb.from("atividades").insert({ prospect_id: id, canal: nomeCanal, direcao: "saida", tipo: "primeiro_toque", resultado: "sem_resposta", quem: email.split("@")[0] });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
