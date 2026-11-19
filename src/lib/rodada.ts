import type { SupabaseClient } from "@supabase/supabase-js";
import { PROSPECCAO, SETORES } from "./agentes";
import { executarAgente, hojeManaus } from "./motor";

/**
 * Rodada do dia: cada agente ativo lê o próprio setor e deixa propostas na fila.
 * Depois o Diretor de Gestão (A0) lê a fila e escreve a página do dia.
 */
export async function rodarAgentes(sb: SupabaseClient, apenas?: string[]) {
  const { data: ativos } = await sb.from("agentes").select("codigo,nome,ativo").order("codigo");
  const lista = (ativos ?? [])
    .filter((a) => SETORES[a.codigo] && a.codigo !== "A0")
    .filter((a) => (apenas?.length ? apenas.includes(a.codigo) : a.ativo));
  const hoje = hojeManaus();
  // Sugestão que ninguém decidiu em 5 dias expira (dá para reabrir em Sugestões). Mantém o Hoje limpo.
  await sb.from("propostas").update({ status: "descartada", nota_decisao: "expirou sem decisão", decidido_em: new Date().toISOString() })
    .eq("status", "pendente").lt("criado_em", new Date(Date.now() - 5 * 864e5).toISOString());

  // Prospecção diária do Comercial: roda em paralelo com os setores, se o A1 estiver ativo.
  const prospeccao = lista.some((a) => a.codigo === "A1")
    ? Promise.allSettled([prospectar(sb)]).then((r) => r[0])
    : Promise.resolve(null);

  const resultados = await Promise.allSettled(
    lista.map(async (a) => {
      const prompt = `Rodada de ${hoje}. ${SETORES[a.codigo].rodada}\nRegistre no máximo 1 proposta, e só se for algo que o Gabriel precisa fazer ou decidir hoje. Antes, consulte propostas pendentes: se já existe uma parecida, não crie outra. Termine com um resumo de até 5 linhas.`;
      const r = await executarAgente({ sb, codigo: a.codigo, prompt });
      await salvarRelatorio(sb, a.codigo, `Rodada ${hoje}`, prompt, r.texto);
      return { codigo: a.codigo, ...r };
    }),
  );

  const prospectou = await prospeccao;
  if (prospectou) {
    resultados.push(prospectou);
    lista.push({ codigo: "A1", nome: "Prospecção", ativo: true });
  }

  const resumos = resultados.map((r, i) =>
    r.status === "fulfilled"
      ? `## ${SETORES[lista[i].codigo].setor}\n${r.value.texto}`
      : `## ${SETORES[lista[i].codigo].setor}\n(falhou: ${String(r.reason).slice(0, 200)})`,
  );

  const promptA0 = `Página do dia ${hoje}. ${SETORES.A0.rodada}\n\nO que os setores disseram na rodada de hoje:\n\n${resumos.join("\n\n") || "(nenhum setor ativo rodou)"}\n\nLeia também as propostas pendentes. Não repita propostas que já existem.`;
  const a0 = await executarAgente({ sb, codigo: "A0", prompt: promptA0 });
  await salvarRelatorio(sb, "A0", `Página do dia ${hoje}`, promptA0, a0.texto);

  return {
    setores: resultados.map((r, i) => ({
      codigo: lista[i].codigo,
      ok: r.status === "fulfilled",
      propostas: r.status === "fulfilled" ? r.value.propostas : 0,
    })),
    pagina: a0.texto,
  };
}

/** Prospecção do Comercial (A1): pesquisa na web e deixa casas novas na fila para o Gabriel aprovar. */
export async function prospectar(sb: SupabaseClient) {
  const hoje = hojeManaus();
  const pedido = `${hoje}. ${PROSPECCAO}\nTermine com um resumo de até 4 linhas: quantas casas achou e quais.`;
  const p = await executarAgente({ sb, codigo: "A1", prompt: pedido });
  await salvarRelatorio(sb, "A1", `Prospecção ${hoje}`, pedido, p.texto);
  return { codigo: "A1", ...p };
}

async function salvarRelatorio(sb: SupabaseClient, agente: string, titulo: string, pedido: string, texto: string) {
  const id = crypto.randomUUID();
  const msg = (role: "user" | "assistant", t: string) => ({
    id: crypto.randomUUID(),
    role,
    parts: [{ type: "text", text: t }],
  });
  await sb.from("agente_conversas").insert({
    id,
    agente,
    titulo,
    mensagens: [msg("user", pedido), msg("assistant", texto)],
    autor_email: "rodada",
  });
}
