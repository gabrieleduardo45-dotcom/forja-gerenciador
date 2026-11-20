/**
 * Leitura das casas (restaurantes) que vêm do FORJA OS, pelo /api/integracao dele.
 * Só leitura, autenticada por Bearer (FORJA_OS_INTEGRACAO_CHAVE). Limite do lado de lá: 30 pedidos/min,
 * por isso a resposta fica em cache por 5 minutos.
 */

export type SemanaOS = { sem: string; cmv: number | null; desp: number | null; chk: number | null; uso: number | null; margem?: number | null; fat?: number | null };
export type CasaOS = {
  id: string;
  nome: string;
  sub?: string | null;
  cidade?: string | null;
  inicio?: string | null;
  ultimaVisita?: string | null;
  usuarios?: number | null;
  estado: "ok" | "at" | "cr" | string;
  metaCmv?: number | null;
  atual?: { cmv?: number | null; desp?: number | null; chk?: number | null; uso?: number | null; vencido?: number | null; pagar_7d?: number | null; margem?: number | null } | null;
  demo?: boolean | null;
  inicioVal?: { cmv?: number | null; desp?: number | null; chk?: number | null; uso?: number | null } | null;
  semanas?: SemanaOS[];
  mudou?: { tipo: string; t: string; d?: string }[];
  excecoes?: unknown[];
  // versão 2 da integração (null quando a casa não tem o dado)
  slug?: string | null;
  data_ref?: string | null;
  pagar_7d?: number | null;
  vencido?: number | null;
  limite_semanal?: number | null;
  semana_atual?: unknown;
  proxima_semana?: unknown;
  itens_abaixo_metade?: unknown[] | null;
  cmv_acima_meta?: unknown[] | null;
  alertas_vigia?: unknown[] | null;
  faturamento_semana?: number | null;
  compras_semana?: number | null;
  top5_insumos_valor?: unknown[] | null;
  metas_vigentes?: { meta_cmv?: number | null; limite_semanal_pagamentos?: number | null; vigente_desde?: string | null; definido_por?: string | null } | null;
};

export type ResultadoOS = { ok: true; gerado?: string; casas: CasaOS[] } | { ok: false; erro: string; casas: CasaOS[] };

export async function casasDoForjaOS(): Promise<ResultadoOS> {
  const url = process.env.FORJA_OS_INTEGRACAO_URL;
  const chave = process.env.FORJA_OS_INTEGRACAO_CHAVE;
  if (!url || !chave) return { ok: false, erro: "Integração com o FORJA OS não configurada.", casas: [] };
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${chave}` },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, erro: `FORJA OS respondeu ${r.status}.`, casas: [] };
    const j = (await r.json()) as { ok?: boolean; gerado?: string; casas?: CasaOS[] };
    return { ok: true, gerado: j.gerado, casas: Array.isArray(j.casas) ? j.casas : [] };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao ler o FORJA OS.", casas: [] };
  }
}

/** Casa de demonstração (para apresentar o sistema): nunca conta como cliente real. */
export const ehDemo = (c: Pick<CasaOS, "nome" | "slug" | "demo">) => !!c.demo || c.slug === "demo" || /demonstra/i.test(c.nome);

/** Fração (0,32) em porcentagem (32). */
export const emPct = (v: number | null | undefined) => (v == null ? null : v * 100);

/** Resumo enxuto para os agentes: sem as 16 semanas inteiras, só a tendência. */
export function resumoParaAgente(c: CasaOS) {
  const sem = c.semanas ?? [];
  const ult = sem.slice(-4).map((s) => ({ semana: s.sem, cmv_pct: emPct(s.cmv), checklist_pct: emPct(s.chk), desperdicio: s.desp, uso_equipe_pct: emPct(s.uso), margem_pct: emPct(s.margem) }));
  return {
    casa: c.nome,
    cidade: c.cidade,
    estado: c.estado === "ok" ? "no alvo" : c.estado === "at" ? "atenção" : c.estado === "cr" ? "crítico" : c.estado,
    cmv_atual_pct: emPct(c.atual?.cmv),
    margem_liquida_pct: emPct(c.atual?.margem),
    cmv_alvo_pct: emPct(c.metaCmv),
    cmv_no_inicio_pct: emPct(c.inicioVal?.cmv),
    checklist_pct: emPct(c.atual?.chk),
    uso_equipe_pct: emPct(c.atual?.uso),
    contas_vencidas: c.vencido ?? c.atual?.vencido ?? null,
    contas_7_dias: c.pagar_7d ?? c.atual?.pagar_7d ?? null,
    limite_semanal_pagamentos: c.limite_semanal ?? null,
    faturamento_semana: c.faturamento_semana ?? null,
    compras_semana: c.compras_semana ?? null,
    itens_abaixo_da_metade: (c.itens_abaixo_metade ?? []).slice(0, 8),
    pratos_cmv_acima_meta: (c.cmv_acima_meta ?? []).slice(0, 5),
    alertas_vigia: (c.alertas_vigia ?? []).slice(0, 5),
    top5_insumos_valor: (c.top5_insumos_valor ?? []).slice(0, 5),
    metas_vigentes: c.metas_vigentes ?? null,
    ultima_visita: c.ultimaVisita,
    ultimas_semanas: ult,
    mudancas_recentes: (c.mudou ?? []).slice(0, 5),
  };
}

/** Grava meta de CMV e limite semanal de pagamentos de uma casa no FORJA OS (vale por cima das regras da casa). */
export async function gravarMetaOS(corpo: { casa_id: string; meta_cmv?: number | null; limite_semanal_pagamentos?: number | null; vigente_desde: string }) {
  const base = process.env.FORJA_OS_INTEGRACAO_URL;
  const chave = process.env.FORJA_OS_METAS_CHAVE;
  if (!base || !chave) return { ok: false as const, erro: "Chave de metas do FORJA OS não configurada (FORJA_OS_METAS_CHAVE)." };
  const url = base.replace(/\/?$/, "") + "/metas";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...corpo, definido_por: "gestao" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; msg?: string; erro?: string; aplicada?: boolean; repetido?: boolean; anterior?: unknown; atual?: unknown };
    if (!r.ok || !j.ok) return { ok: false as const, erro: j.msg ?? j.erro ?? `FORJA OS respondeu ${r.status}.` };
    return { ok: true as const, repetido: !!j.repetido, aplicada: j.aplicada !== false, anterior: j.anterior, atual: j.atual };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Falha ao falar com o FORJA OS." };
  }
}
