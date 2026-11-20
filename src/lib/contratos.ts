import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasaOS } from "./forja-os";
import { normalizar } from "./funil";

import type { Ligada, PrecoPlano } from "./tipos-contrato";

/** Tabela de preços e, para cada casa do FORJA OS, o contrato ativo que ela já tem na Gestão. */
export async function contratosDasCasas(sb: SupabaseClient, casasOS: CasaOS[]) {
  const [{ data: precos }, { data: casas }, { data: contratos }] = await Promise.all([
    sb.from("precos").select("produto,fundadora,cheia,unidade").neq("produto", "Personalizado").order("id"),
    sb.from("casas").select("id,nome,forja_os_id"),
    sb.from("contratos").select("casa_id,produto,valor,unidade,status,criado_em").eq("status", "ativo").order("criado_em", { ascending: false }),
  ]);
  const ligadas = new Map<string, Ligada>();
  const cadastradas = new Set<string>();
  for (const os of casasOS) {
    const c = (casas ?? []).find((x) => x.forja_os_id === os.id) ?? (casas ?? []).find((x) => normalizar(x.nome ?? "") === normalizar(os.nome));
    if (c) cadastradas.add(os.id);
    const k = c && (contratos ?? []).find((x) => x.casa_id === c.id);
    if (k) ligadas.set(os.id, { contrato: k.produto, valor: Number(k.valor), mensal: k.unidade === "mes" });
  }
  return {
    precos: (precos ?? []).map((p) => ({ produto: p.produto, fundadora: p.fundadora == null ? null : Number(p.fundadora), cheia: p.cheia == null ? null : Number(p.cheia), unidade: p.unidade })) as PrecoPlano[],
    ligadas,
    cadastradas,
  };
}
