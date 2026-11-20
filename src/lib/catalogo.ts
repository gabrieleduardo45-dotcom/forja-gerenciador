import type { SupabaseClient } from "@supabase/supabase-js";

/** Textos curtos de cada produto para o FORJA OS (o conteúdo completo do método fica lá). */
const EXTRA: Record<string, { curto?: string; publico?: string; desc?: string; garantia?: string; dias?: number }> = {
  raiox: { curto: "Raio-X", dias: 2, desc: "2 dias na cozinha e relatório em 48 h: vazamento em R$/mês, nota das 5 frentes e plano 30/60/90.", garantia: "Se o vazamento medido não chegar a 2× o valor cobrado (piso R$ 1.000/mês), não cobra." },
  start: { curto: "Start", publico: "marmitaria", desc: "Ficha e custo por marmita, porcionador, compra pela produção e painel do dono.", garantia: "Vazamento cai pela metade em 90 dias ou a Forja volta sem cobrar." },
  pro: { curto: "Pro", publico: "restaurante", desc: "Produto, Custo e Rotina a fundo: fichas, porção, compras, perdas, checklists e treino.", garantia: "Vazamento cai pela metade em 90 dias ou a Forja volta sem cobrar." },
  master: { curto: "Master", publico: "restaurante", desc: "As 5 frentes + engenharia de cardápio, com 8 semanas de controle ao lado.", garantia: "Vazamento cai pela metade em 90 dias ou a Forja volta sem cobrar." },
  so_sistema: { curto: "Forja OS", desc: "O sistema no celular, sem visitas." },
  care: { curto: "Care", desc: "Sistema + 2 visitas por mês, leitura semanal e fechamento mensal.", garantia: "Visita perdida reposta; CMV fora da meta 2 meses seguidos, o mês seguinte é por conta da Forja." },
  care_plus: { curto: "Care Plus", desc: "Sistema + 4 visitas por mês, leitura semanal, fechamento mensal e mini Raio-X trimestral.", garantia: "Visita perdida reposta; CMV fora da meta 2 meses seguidos, o mês seguinte é por conta da Forja." },
  personalizado: { curto: "Personalizado", desc: "Valor e visitas definidos pelo Gabriel em cada caso." },
};

type Linha = { chave: string | null; produto: string; fundadora: number | string | null; cheia: number | string | null; unidade: string; grupo: string | null; semanas: number | null; visitas: number | null; visitas_mes: number | null; fichas_max: number | null; observacao: string | null };

export async function montarCatalogo(sb: SupabaseClient) {
  const { data } = await sb.from("precos").select("chave,produto,fundadora,cheia,unidade,grupo,semanas,visitas,visitas_mes,fichas_max,observacao").not("chave", "is", null).order("id");
  const produtos = ((data ?? []) as Linha[]).map((p) => {
    const e = EXTRA[p.chave!] ?? {};
    const tipo = p.chave === "personalizado" ? "sob_medida" : p.unidade === "mes" ? "mensal" : "unico";
    const o: Record<string, unknown> = { id: p.chave, nome: p.produto, tipo, grupo: p.grupo ?? "avulso", preco: p.fundadora == null ? null : Number(p.fundadora) };
    if (p.cheia != null && Number(p.cheia) !== Number(p.fundadora)) o.cheio = Number(p.cheia);
    if (e.curto) o.curto = e.curto;
    if (p.semanas != null) o.semanas = p.semanas;
    if (p.visitas != null && tipo === "unico") o.visitas = p.visitas;
    if (p.visitas_mes != null) o.visitas_mes = p.visitas_mes;
    if (p.fichas_max != null) o.fichas_max = p.fichas_max;
    if (e.dias) o.dias = e.dias;
    if (e.publico) o.publico = e.publico;
    if (e.desc) o.desc = e.desc;
    if (e.garantia) o.garantia = e.garantia;
    if (p.chave === "care_plus") o.mini_raiox_trimestral = true;
    if (p.chave === "pagina_vendas") o.preco_com_consultoria = 800;
    return o;
  });
  return { versao: 1, atualizado_em: new Date().toISOString(), fonte: "gestao", produtos };
}

/** Manda o catálogo inteiro para o FORJA OS (substitui o de lá). */
export async function enviarCatalogo(sb: SupabaseClient) {
  const base = process.env.FORJA_OS_INTEGRACAO_URL;
  const chave = process.env.FORJA_OS_METAS_CHAVE;
  if (!base || !chave) return { ok: false as const, erro: "Integração com o FORJA OS não configurada." };
  const corpo = await montarCatalogo(sb);
  try {
    const r = await fetch(base.replace(/\/?$/, "") + "/catalogo", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; produtos?: number; msg?: string; erro?: string; invalidos?: unknown };
    if (!r.ok || !j.ok) return { ok: false as const, erro: j.msg ?? j.erro ?? (j.invalidos ? JSON.stringify(j.invalidos).slice(0, 300) : `FORJA OS respondeu ${r.status}.`) };
    return { ok: true as const, produtos: j.produtos ?? corpo.produtos.length };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Falha ao falar com o FORJA OS." };
  }
}
