/**
 * Leitura das casas (restaurantes) que vêm do FORJA OS, pelo /api/integracao dele.
 * Só leitura, autenticada por Bearer (FORJA_OS_INTEGRACAO_CHAVE). Limite do lado de lá: 30 pedidos/min,
 * por isso a resposta fica em cache por 5 minutos.
 */

export type SemanaOS = { sem: string; cmv: number | null; desp: number | null; chk: number | null; uso: number | null };
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
  atual?: { cmv?: number | null; desp?: number | null; chk?: number | null; uso?: number | null; vencido?: number | null; pagar_7d?: number | null } | null;
  inicioVal?: { cmv?: number | null; desp?: number | null; chk?: number | null; uso?: number | null } | null;
  semanas?: SemanaOS[];
  mudou?: { tipo: string; t: string; d?: string }[];
  excecoes?: unknown[];
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

/** Fração (0,32) em porcentagem (32). */
export const emPct = (v: number | null | undefined) => (v == null ? null : v * 100);

/** Resumo enxuto para os agentes: sem as 16 semanas inteiras, só a tendência. */
export function resumoParaAgente(c: CasaOS) {
  const sem = c.semanas ?? [];
  const ult = sem.slice(-4).map((s) => ({ semana: s.sem, cmv_pct: emPct(s.cmv), checklist_pct: emPct(s.chk), desperdicio: s.desp, uso_equipe_pct: emPct(s.uso) }));
  return {
    casa: c.nome,
    cidade: c.cidade,
    estado: c.estado === "ok" ? "no alvo" : c.estado === "at" ? "atenção" : c.estado === "cr" ? "crítico" : c.estado,
    cmv_atual_pct: emPct(c.atual?.cmv),
    cmv_alvo_pct: emPct(c.metaCmv),
    cmv_no_inicio_pct: emPct(c.inicioVal?.cmv),
    checklist_pct: emPct(c.atual?.chk),
    uso_equipe_pct: emPct(c.atual?.uso),
    contas_vencidas: c.atual?.vencido ?? null,
    contas_7_dias: c.atual?.pagar_7d ?? null,
    ultima_visita: c.ultimaVisita,
    ultimas_semanas: ult,
    mudancas_recentes: (c.mudou ?? []).slice(0, 5),
  };
}
