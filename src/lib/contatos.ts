import type { SupabaseClient } from "@supabase/supabase-js";

export type Contato = { whatsapp?: string | null; instagram?: string | null };

/**
 * Contato do prospect citado em cada proposta (campo alvo = código P-0001).
 * Serve para o botão de WhatsApp abrir a conversa certa e o de Instagram abrir o direct da casa.
 */
export async function contatosDasPropostas(sb: SupabaseClient, propostas: { alvo: string | null }[]) {
  const codigos = [...new Set(propostas.map((p) => p.alvo?.match(/P-\d+/)?.[0]).filter(Boolean))] as string[];
  const mapa = new Map<string, Contato>();
  if (!codigos.length) return mapa;
  const { data } = await sb.from("prospects").select("codigo,whatsapp_decisor,telefone_casa,instagram_decisor,instagram_casa").in("codigo", codigos);
  for (const p of data ?? []) {
    mapa.set(p.codigo, { whatsapp: p.whatsapp_decisor ?? p.telefone_casa, instagram: p.instagram_decisor ?? p.instagram_casa });
  }
  return mapa;
}

export function contatoDe(mapa: Map<string, Contato>, alvo: string | null) {
  const c = alvo?.match(/P-\d+/)?.[0];
  return c ? mapa.get(c) : undefined;
}
