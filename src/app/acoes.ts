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

/* ---------- Financeiro: extrato, categorias, parâmetros ---------- */

export type LinhaImportada = { ref: string; data: string; descricao: string; valor: number; categoria: string; confianca: number };

/** Lê o extrato (OFX ou CSV), tira o que já foi importado e pede para a IA classificar. Não grava ainda. */
export async function importarExtrato(f: FormData): Promise<{ ok: boolean; msg: string; linhas: LinhaImportada[]; saldo?: number; saldoData?: string }> {
  const { sb } = await sessao();
  const { lerExtrato } = await import("@/lib/financeiro");
  const { classificarComIA } = await import("@/lib/financeiro-ia");
  const arq = f.get("arquivo");
  if (!(arq instanceof File) || !arq.size) return { ok: false, msg: "Escolha o arquivo do extrato.", linhas: [] };
  const bytes = new Uint8Array(await arq.arrayBuffer());
  let texto = new TextDecoder("utf-8").decode(bytes);
  if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(bytes);
  const ex = lerExtrato(arq.name, texto);
  if (!ex.linhas.length) return { ok: false, msg: ex.erro ?? "Não achei lançamentos no arquivo.", linhas: [] };
  const { data: ja } = await sb.from("lancamentos").select("ref").in("ref", ex.linhas.map((l) => l.ref));
  const jaTem = new Set((ja ?? []).map((x) => x.ref));
  const novas = ex.linhas.filter((l) => !jaTem.has(l.ref));
  const lotes: (typeof novas)[] = [];
  for (let i = 0; i < novas.length; i += 60) lotes.push(novas.slice(i, i + 60));
  const classes = new Map<number, { categoria: string; confianca: number }>();
  await Promise.all(
    lotes.map(async (lote, n) => {
      try {
        const r = await classificarComIA(lote.map((l, j) => ({ i: n * 60 + j, descricao: l.descricao, valor: l.valor })));
        r.forEach((x) => classes.set(x.i, x));
      } catch { /* fica a classificar */ }
    }),
  );
  const linhas = novas.map((l, i) => ({ ...l, categoria: classes.get(i)?.categoria ?? "a_classificar", confianca: classes.get(i)?.confianca ?? 0 }));
  const repetidas = ex.linhas.length - novas.length;
  return {
    ok: true,
    msg: `${novas.length} lançamentos novos${repetidas ? ` (${repetidas} já estavam no sistema)` : ""}. Confira os marcados e salve.`,
    linhas, saldo: ex.saldo, saldoData: ex.saldoData,
  };
}

export async function salvarExtrato(linhas: LinhaImportada[], saldo?: number, saldoData?: string): Promise<Resultado> {
  const { sb } = await sessao();
  if (!linhas.length && saldo == null) return { ok: false, msg: "Nada para salvar." };
  if (linhas.length) {
    const { error } = await sb.from("lancamentos").upsert(
      linhas.map((l) => ({ ref: l.ref, data: l.data, descricao: l.descricao, valor: l.valor, categoria: l.categoria, confianca: l.confianca, conferido: true, origem: "extrato" })),
      { onConflict: "ref", ignoreDuplicates: true },
    );
    if (error) return { ok: false, msg: error.message };
  }
  if (saldo != null && saldoData) {
    await sb.from("parametros").upsert([{ chave: "saldo_banco", valor: String(saldo) }, { chave: "saldo_banco_data", valor: saldoData }]);
  }
  revalidatePath("/numeros");
  return { ok: true, msg: `${linhas.length} lançamentos salvos.` };
}

export async function mudarCategoria(id: number, categoria: string) {
  const { sb } = await sessao();
  const { error } = await sb.from("lancamentos").update({ categoria, conferido: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/numeros");
}

/** Saída ou entrada lançada à mão (dinheiro, cartão pessoal usado pela empresa etc.). */
export async function lancarManual(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const valor = Number(String(f.get("valor") ?? "").replace(/\./g, "").replace(",", "."));
  const descricao = txt(f, "descricao");
  if (!descricao || !valor) return { ok: false, msg: "Preencha descrição e valor." };
  const tipo = txt(f, "tipo") ?? "saida";
  const { error } = await sb.from("lancamentos").insert({
    data: txt(f, "data") ?? hojeManaus(),
    descricao,
    valor: tipo === "saida" ? -Math.abs(valor) : Math.abs(valor),
    categoria: txt(f, "categoria") ?? "a_classificar",
    origem: "manual",
    conferido: true,
    ref: "manual:" + crypto.randomUUID(),
  });
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/numeros");
  return { ok: true, msg: "Lançado." };
}

export async function salvarParametros(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const linhas: { chave: string; valor: string }[] = [];
  const aliq = txt(f, "aliquota_simples");
  if (aliq) linhas.push({ chave: "aliquota_simples", valor: String(Number(aliq.replace(",", ".")) / 100) });
  const saldo = txt(f, "saldo_banco");
  if (saldo) linhas.push({ chave: "saldo_banco", valor: String(Number(saldo.replace(/\./g, "").replace(",", "."))) }, { chave: "saldo_banco_data", valor: txt(f, "saldo_banco_data") ?? hojeManaus() });
  if (!linhas.length) return { ok: false, msg: "Nada para salvar." };
  const { error } = await sb.from("parametros").upsert(linhas.map((l) => ({ ...l, atualizado_em: new Date().toISOString() })));
  if (error) return { ok: false, msg: error.message };
  revalidatePath("/numeros");
  return { ok: true, msg: "Salvo." };
}

/* ---------- Contrato de uma casa (FORJA OS ou cliente do quadro) ---------- */

/**
 * Fecha um contrato: garante a casa (ligada ao FORJA OS quando vier de lá), marca como cliente no quadro,
 * cria o contrato com o plano da tabela ou personalizado e, se já recebeu, lança o recebimento.
 */
export async function fecharContratoCasa(_: Resultado | null, f: FormData): Promise<Resultado> {
  const { sb } = await sessao();
  const { normalizar } = await import("@/lib/funil");
  const nome = txt(f, "casa_nome");
  const osId = txt(f, "casa_os_id");
  let casaId = Number(f.get("casa_id")) || null;
  const plano = txt(f, "plano");
  const produto = plano === "personalizado" ? txt(f, "plano_nome") : plano;
  const valor = Number(String(f.get("valor") ?? "").replace(/\./g, "").replace(",", "."));
  const mensal = txt(f, "tipo") === "mensal";
  const inicio = txt(f, "inicio") ?? hojeManaus();
  if (!nome) return { ok: false, msg: "Falta a casa." };
  if (!produto) return { ok: false, msg: "Escolha o plano ou dê um nome ao plano personalizado." };
  if (!(valor > 0)) return { ok: false, msg: "Informe o valor." };

  // 1. Casa
  if (!casaId) {
    const { data: casas } = await sb.from("casas").select("id,codigo,nome,forja_os_id");
    const achada = (casas ?? []).find((c) => (osId && c.forja_os_id === osId) || normalizar(c.nome ?? "") === normalizar(nome));
    if (achada) {
      casaId = achada.id;
      await sb.from("casas").update({ status: "ativa", ...(osId ? { forja_os_id: osId } : {}) }).eq("id", achada.id);
    } else {
      const maior = Math.max(0, ...(casas ?? []).map((c) => Number(/^C-(\d+)$/.exec(c.codigo)?.[1] ?? 0)));
      const { data: nova, error } = await sb.from("casas")
        .insert({ codigo: `C-${String(maior + 1).padStart(3, "0")}`, nome, cidade: "Manaus", status: "ativa", inicio, forja_os_id: osId })
        .select("id").single();
      if (error) return { ok: false, msg: error.message };
      casaId = nova.id;
    }
  }

  // 2. Quadro de clientes: a casa aparece como Cliente
  const { data: prosps } = await sb.from("prospects").select("id,nome_casa,casa_id,estagio");
  const p = (prosps ?? []).find((x) => x.casa_id === casaId) ?? (prosps ?? []).find((x) => normalizar(x.nome_casa) === normalizar(nome));
  if (p) {
    if (!["implantacao_fechada", "care_ativo"].includes(p.estagio) || p.casa_id !== casaId)
      await sb.from("prospects").update({ casa_id: casaId, estagio: mensal ? "care_ativo" : "implantacao_fechada" }).eq("id", p.id);
  } else {
    await sb.from("prospects").insert({ nome_casa: nome, casa_id: casaId, estagio: mensal ? "care_ativo" : "implantacao_fechada", origem: "outro", aprovado_gabriel: true });
  }

  // 3. Contrato
  const { data: contrato, error: e3 } = await sb.from("contratos")
    .insert({ casa_id: casaId, produto, valor, unidade: mensal ? "mes" : "avulso", inicio, meses: mensal ? Number(f.get("meses")) || null : null, forma_pagamento: txt(f, "forma"), status: "ativo" })
    .select("id").single();
  if (e3) return { ok: false, msg: e3.message };

  // 4. Recebimento (se já pagou)
  if (f.get("recebido")) {
    const { error: e4 } = await sb.from("recebimentos").insert({
      casa_id: casaId, contrato_id: contrato.id, produto, valor, data: txt(f, "data_recebido") ?? hojeManaus(),
      linha: mensal ? "recorrente" : "consultoria", forma: txt(f, "forma") ?? "pix",
    });
    if (e4) return { ok: false, msg: `Contrato salvo, mas o recebimento falhou: ${e4.message}` };
  }
  revalidatePath("/", "layout");
  return { ok: true, msg: `${nome}: ${produto} ${mensal ? "mensal" : ""} salvo${f.get("recebido") ? " e recebimento lançado" : ""}.` };
}

/** O Gabriel define a meta de uma casa; vai direto para o FORJA OS (ele é quem aprova). */
export async function definirMetaCasa(_: Resultado | null, f: FormData): Promise<Resultado> {
  await sessao();
  const { gravarMetaOS } = await import("@/lib/forja-os");
  const casa_id = txt(f, "casa_id");
  if (!casa_id) return { ok: false, msg: "Falta a casa." };
  const num = (k: string) => { const v = txt(f, k); return v == null ? null : Number(v.replace(/\./g, "").replace(",", ".")); };
  const cmv = num("meta_cmv");
  const limite = num("limite");
  if (cmv == null && limite == null) return { ok: false, msg: "Preencha a meta de CMV ou o limite semanal." };
  if (cmv != null && !(cmv > 0 && cmv < 100)) return { ok: false, msg: "CMV em %, entre 1 e 99." };
  const hoje = hojeManaus();
  const vigente = txt(f, "vigente_desde") ?? hoje;
  const r = await gravarMetaOS({ casa_id, meta_cmv: cmv == null ? null : cmv / 100, limite_semanal_pagamentos: limite, vigente_desde: vigente > hoje ? hoje : vigente });
  if (!r.ok) return { ok: false, msg: r.erro };
  revalidatePath("/", "layout");
  return { ok: true, msg: r.repetido ? "Essa meta já estava gravada." : "Meta gravada no FORJA OS." };
}
