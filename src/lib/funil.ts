/** As 4 colunas simples do funil. Por baixo continuam os estágios detalhados; aqui só o que o Gabriel precisa ver. */
export const COLUNAS = [
  { k: "prospect", t: "Prospect", dica: "ainda não falou", estagios: ["identificado", "na_lista", "em_cadencia", "nutricao"], destino: "na_lista" },
  { k: "conversa", t: "Conversando", dica: "já respondeu", estagios: ["conversa", "qualificado", "conversa_presencial", "raiox_proposto", "raiox_agendado", "raiox_pago", "raiox_entregue"], destino: "conversa" },
  { k: "proposta", t: "Proposta", dica: "proposta enviada", estagios: ["proposta_enviada"], destino: "proposta_enviada" },
  { k: "cliente", t: "Cliente", dica: "fechou", estagios: ["implantacao_fechada", "care_ativo"], destino: "implantacao_fechada" },
] as const;

export type ColunaK = (typeof COLUNAS)[number]["k"];

export function colunaDe(estagio: string): ColunaK | null {
  return COLUNAS.find((c) => (c.estagios as readonly string[]).includes(estagio))?.k ?? null;
}

/** "92 99999-0000" vira WhatsApp; "@casa" ou texto vira Instagram. */
export function lerContato(v: string | null): { whatsapp_decisor?: string; instagram_casa?: string } {
  const s = (v ?? "").trim();
  if (!s) return {};
  const digitos = s.replace(/\D/g, "");
  if (digitos.length >= 8 && !s.includes("@") && !/[a-z]{3,}/i.test(s)) return { whatsapp_decisor: digitos };
  const ig = /instagram\.com\/([A-Za-z0-9._]+)/.exec(s);
  return { instagram_casa: (ig ? ig[1] : s.replace(/^@/, "")).trim() };
}

export function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** wa.me exige DDI: número sem 55 ganha o 55. */
export function linkWa(numero?: string | null, texto?: string) {
  let n = (numero ?? "").replace(/\D/g, "");
  if (!n) return null;
  if (n.length <= 11) n = "55" + n;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function linkIg(v?: string | null) {
  if (!v) return null;
  const m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(v);
  const u = (m ? m[1] : v.replace(/^@/, "")).trim();
  return u ? `https://ig.me/m/${u}` : null;
}
