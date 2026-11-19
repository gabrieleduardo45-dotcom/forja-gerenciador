import { prospectar, rodarAgentes } from "@/lib/rodada";
import { usuarioAtual } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Botão "Rodar agentes": roda com a sessão de quem clicou. */
export async function POST(req: Request) {
  const { sb, user } = await usuarioAtual();
  if (!user) return Response.json({ erro: "Entre de novo" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.modo === "prospectar") {
      const p = await prospectar(sb);
      return Response.json({ setores: [{ codigo: "A1", ok: true, propostas: p.propostas }], resumo: p.texto });
    }
    const r = await rodarAgentes(sb, body.apenas);
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
