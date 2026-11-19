import { prospectar, rodarAgentes } from "@/lib/rodada";
import { supabaseRobo } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Rodada automática (Vercel Cron, 5h de Manaus). Exige CRON_SECRET e o usuário robô (ou a chave de serviço). */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  // Na prévia (nunca em produção) aceita ?chave= para disparar um teste pelo navegador.
  const chaveTeste = process.env.VERCEL_ENV === "preview" ? new URL(req.url).searchParams.get("chave") : null;
  if (!segredo || (req.headers.get("authorization") !== `Bearer ${segredo}` && chaveTeste !== segredo)) {
    return new Response("Não autorizado", { status: 401 });
  }
  try {
    const sb = await supabaseRobo();
    if (!sb) return new Response("Configure FORJA_ROBO_EMAIL/FORJA_ROBO_SENHA ou SUPABASE_SERVICE_ROLE_KEY", { status: 503 });
    if (new URL(req.url).searchParams.get("modo") === "prospectar") return Response.json(await prospectar(sb));
    const r = await rodarAgentes(sb);
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
