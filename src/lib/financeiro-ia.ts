import { CATEGORIAS } from "./financeiro";

/** Classificação por IA (servidor): descrição do extrato → categoria. */
export async function classificarComIA(linhas: { i: number; descricao: string; valor: number }[]) {
  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");
  const modelo = process.env.FORJA_MODELO || "anthropic/claude-haiku-5.5";
  const lista = CATEGORIAS.filter((c) => c.k !== "a_classificar").map((c) => `- ${c.k}: ${c.t} (${c.g}${c.dica ? "; ex.: " + c.dica : ""})`).join("\n");
  const r = await generateText({
    model: modelo,
    instructions: `Você classifica linhas do extrato bancário da Forja, uma consultoria de cozinha para restaurantes em Manaus (empresa do Simples Nacional, dono Gabriel).
Valor positivo = entrou dinheiro; negativo = saiu. Escolha UMA categoria por linha:
${lista}
Regras: DAS/Simples = simples_das. Pix recebido de restaurante ou pessoa jurídica de alimentação = receita_cliente. Hotmart entrando = receita_digital; taxa da Hotmart saindo = taxa_plataforma. Transferência para o próprio Gabriel ou conta dele = pro_labore (saída) ou transferencia (se for entre contas da empresa). Se não dá para saber, use a_classificar com confiança baixa.`,
    output: Output.object({ schema: z.object({ itens: z.array(z.object({ i: z.number().int(), categoria: z.enum(CATEGORIAS.map((c) => c.k) as [string, ...string[]]), confianca: z.number().min(0).max(1) })) }) }),
    prompt: linhas.map((l) => `${l.i}\t${l.valor.toFixed(2)}\t${l.descricao}`).join("\n"),
  });
  return r.output.itens;
}
