import type { SupabaseClient } from "@supabase/supabase-js";
import { SETORES } from "./agentes";
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

  const resultados = await Promise.allSettled(
    lista.map(async (a) => {
      const prompt = `Rodada de ${hoje}. ${SETORES[a.codigo].rodada}\nRegistre no máximo 3 propostas, só as que valem o tempo do Gabriel. Termine com um resumo de até 5 linhas.`;
      const r = await executarAgente({ sb, codigo: a.codigo, prompt });
      await salvarRelatorio(sb, a.codigo, `Rodada ${hoje}`, prompt, r.texto);
      return { codigo: a.codigo, ...r };
    }),
  );

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
