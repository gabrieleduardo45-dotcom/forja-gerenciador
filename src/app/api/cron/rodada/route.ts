import { rodarAgentes } from "@/lib/rodada";
import { supabaseRobo } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Rodada automática (Vercel Cron, 5h de Manaus). Exige CRON_SECRET e o usuário robô (ou a chave de serviço). */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  try {
    const sb = await supabaseRobo();
    if (!sb) return new Response("Configure FORJA_ROBO_EMAIL/FORJA_ROBO_SENHA ou SUPABASE_SERVICE_ROLE_KEY", { status: 503 });
    const r = await rodarAgentes(sb);
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
