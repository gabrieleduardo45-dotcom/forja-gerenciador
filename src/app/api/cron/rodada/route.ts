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
    const sp = new URL(req.url).searchParams;
    // Só na prévia: testa a leitura de foto de sobra/descarte com uma imagem pública.
    if (chaveTeste && sp.get("modo") === "foto" && sp.get("url")) {
      const { lerFoto } = await import("@/lib/desperdicio");
      const img = await fetch(sp.get("url")!, { headers: { "user-agent": "forja-teste" } });
      return Response.json(await lerFoto(new Uint8Array(await img.arrayBuffer()), img.headers.get("content-type") ?? "image/jpeg", sp.get("legenda") ?? undefined));
    }
    // Só na prévia: confere a leitura do FORJA OS (versão e campos), sem dados sensíveis.
    if (chaveTeste && sp.get("modo") === "os") {
      const { casasDoForjaOS, resumoParaAgente } = await import("@/lib/forja-os");
      const r = await casasDoForjaOS();
      return Response.json({ ok: r.ok, erro: "erro" in r ? r.erro : undefined, casas: r.casas.length, campos: r.casas[0] ? Object.keys(r.casas[0]) : [], exemplo: r.casas[0] ? resumoParaAgente(r.casas[0]) : null, metasChave: !!process.env.FORJA_OS_METAS_CHAVE });
    }
    if (sp.get("modo") === "prospectar") return Response.json(await prospectar(sb));
    const r = await rodarAgentes(sb);
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
