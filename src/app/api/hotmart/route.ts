import { supabaseRobo } from "@/lib/supabase/server";

export const maxDuration = 30;

type Corpo = {
  event?: string;
  data?: {
    product?: { name?: string };
    purchase?: { transaction?: string; approved_date?: number; order_date?: number; price?: { value?: number }; full_price?: { value?: number } };
    buyer?: { email?: string; name?: string };
  };
};

const APROVADA = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];

/**
 * Webhook da Hotmart (versão 2.0). Cada compra aprovada vira um recebimento da linha "digital".
 * Segurança: a Hotmart manda o hottok no cabeçalho X-HOTMART-HOTTOK; ele precisa bater com HOTMART_HOTTOK.
 * Idempotente: a transação vai em recebimentos.origem_ref (único).
 */
export async function POST(req: Request) {
  const esperado = process.env.HOTMART_HOTTOK;
  if (!esperado || req.headers.get("x-hotmart-hottok") !== esperado) {
    return new Response("Não autorizado", { status: 401 });
  }
  const corpo = (await req.json().catch(() => ({}))) as Corpo;
  const evento = corpo.event ?? "";
  if (!APROVADA.includes(evento)) return Response.json({ ok: true, ignorado: evento });

  const compra = corpo.data?.purchase ?? {};
  const transacao = compra.transaction;
  const valor = Number(compra.price?.value ?? compra.full_price?.value ?? 0);
  if (!transacao || !(valor >= 0)) return Response.json({ erro: "compra sem transação ou valor" }, { status: 400 });
  const quando = compra.approved_date ?? compra.order_date ?? Date.now();
  const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date(quando));

  const sb = await supabaseRobo();
  if (!sb) return new Response("Robô não configurado", { status: 503 });
  const { error } = await sb.from("recebimentos").insert({
    produto: corpo.data?.product?.name ?? "Produto Hotmart",
    linha: "digital",
    valor,
    data,
    forma: "hotmart",
    origem_ref: `hotmart:${transacao}`,
    obs: corpo.data?.buyer?.email ? `Comprador: ${corpo.data.buyer.email}` : null,
  });
  if (error && error.code !== "23505") return Response.json({ erro: error.message }, { status: 500 });
  return Response.json({ ok: true, duplicado: error?.code === "23505" });
}
