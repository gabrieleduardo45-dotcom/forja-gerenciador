import { rodarAgentes } from "@/lib/rodada";
import { supabaseServico } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Rodada automática (Vercel Cron, 5h de Manaus). Só roda com CRON_SECRET e chave de serviço configuradas. */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const sb = supabaseServico();
  if (!sb) return new Response("SUPABASE_SERVICE_ROLE_KEY ausente", { status: 503 });
  const r = await rodarAgentes(sb);
  return Response.json(r);
}
