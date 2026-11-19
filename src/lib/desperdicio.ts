import { generateText, Output } from "ai";
import { z } from "zod";

/** Modelo que enxerga foto. Haiku lê bem balança e alimento e custa pouco. */
export const MODELO_VISAO = process.env.FORJA_MODELO_VISAO || process.env.FORJA_MODELO || "anthropic/claude-haiku-5.5";

export const itemLido = z.object({
  item: z.string().describe("O que é, em português de cozinha: 'arroz branco', 'frango assado', 'aparas de carne'"),
  tipo: z.enum(["sobra", "descarte"]).describe("sobra = comida pronta ou insumo bom que pode voltar; descarte = vai para o lixo (estragado, resto de prato, aparas, queimado)"),
  peso_kg: z.number().nullable().describe("Peso em kg. Se a balança aparece, use o número do visor (desconte a tara se estiver escrita). Se não, estime pelo volume ou deixe null"),
  peso_fonte: z.enum(["balanca", "estimado"]).nullable(),
  motivo: z.string().nullable().describe("Causa provável em poucas palavras: 'produção acima do movimento', 'resto de prato', 'validade vencida', 'aparas do pré-preparo'"),
  confianca: z.number().min(0).max(1).describe("Quão certo está do tipo e do peso, de 0 a 1"),
});
export type ItemLido = z.infer<typeof itemLido>;

const INSTRUCAO = `Você olha fotos que a cozinha de um restaurante manda para o consultor: sobra de produção e descarte.
Para cada foto, liste os itens que aparecem (normalmente 1). Regras:
- Sobra: comida pronta ou insumo ainda bom, em cuba, pote ou gastronorm, que pode ser reaproveitado ou congelado.
- Descarte: lixo, resto de prato, comida estragada ou queimada, aparas e cascas, tudo que vai para a lixeira ou o saco.
- A legenda do Gabriel vale mais que a foto: se ele escreveu "sobra" ou "lixo/descarte", siga.
- Balança no visor: leia o número com cuidado. Em gramas, converta para kg.
- Não invente: se não dá para saber, confiança baixa.`;

/** Lê uma foto e devolve os itens. */
export async function lerFoto(imagem: Uint8Array, mediaType: string, legenda?: string) {
  const r = await generateText({
    model: MODELO_VISAO,
    instructions: INSTRUCAO,
    output: Output.object({ schema: z.object({ itens: z.array(itemLido).max(6) }) }),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imagem, mediaType },
          { type: "text", text: legenda ? `Legenda: ${legenda}` : "Sem legenda." },
        ],
      },
    ],
  });
  return r.output.itens;
}
