const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const brl = (v: unknown) => (v == null || v === "" ? "—" : BRL.format(Number(v)));
export const num = (v: unknown) => (v == null || v === "" ? "—" : NUM.format(Number(v)));
export const pct = (v: unknown) => (v == null || v === "" ? "—" : `${NUM.format(Number(v))}%`);

export function data(v: unknown) {
  if (!v) return "—";
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}${m[1] !== String(new Date().getFullYear()) ? "/" + m[1].slice(2) : ""}`;
}

export function dataHora(v: unknown) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(String(v)));
}

export function mesNome(v: unknown) {
  if (!v) return "—";
  const [a, m] = String(v).split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(a), Number(m) - 1, 1)))
    .replace(".", "");
}

/** Rótulo legível de um código snake_case: "conv_contato_raiox" → "Conv contato raiox". */
export function rotulo(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const INDICADORES: Record<string, string> = {
  faturamento_mes: "Faturamento do mês",
  receita_recorrente_mes: "Receita recorrente",
  contatos_mes: "Contatos no mês",
  contatos_dia: "Contatos por dia",
  raiox_realizados: "Raio-X realizados",
  implantacoes_vendidas: "Implantações vendidas",
  conv_contato_raiox: "Contato → Raio-X",
  conv_raiox_implantacao: "Raio-X → Implantação",
  conv_implantacao_care: "Implantação → Care",
  ticket_medio_implantacao: "Ticket médio implantação",
  care_ativas: "Care ativas",
  forja_os_ativas: "Forja OS ativas",
  forja_os_novas: "Forja OS novas",
  digital_vendas: "Vendas digitais",
  landing_vendidas: "Landing pages vendidas",
  horas_entrega: "Horas de entrega",
  pct_recorrente: "% recorrente",
  churn_os_max: "Churn Forja OS (máx.)",
  churn_care_max: "Churn Care (máx.)",
  concentracao_maior_cliente_max: "Maior cliente (máx.)",
  consultores_ativos: "Consultores ativos",
  faturamento_acumulado_2027: "Faturamento acumulado 2027",
};

export function valorUnidade(v: unknown, unidade?: string | null) {
  if (v == null) return "—";
  if (unidade === "R$") return brl(v);
  if (unidade === "%") return pct(v);
  return num(v);
}

/** Estágios do funil (mesma ordem do CHECK de public.prospects). */
export const ESTAGIOS: { k: string; t: string; ativo: boolean }[] = [
  { k: "identificado", t: "Identificado", ativo: true },
  { k: "na_lista", t: "Na lista", ativo: true },
  { k: "em_cadencia", t: "Em cadência", ativo: true },
  { k: "conversa", t: "Conversa", ativo: true },
  { k: "qualificado", t: "Qualificado", ativo: true },
  { k: "conversa_presencial", t: "Conversa presencial", ativo: true },
  { k: "raiox_proposto", t: "Raio-X proposto", ativo: true },
  { k: "raiox_agendado", t: "Raio-X agendado", ativo: true },
  { k: "raiox_pago", t: "Raio-X pago", ativo: true },
  { k: "raiox_entregue", t: "Raio-X entregue", ativo: true },
  { k: "proposta_enviada", t: "Proposta enviada", ativo: true },
  { k: "implantacao_fechada", t: "Implantação fechada", ativo: true },
  { k: "care_ativo", t: "Care ativo", ativo: true },
  { k: "nutricao", t: "Nutrição", ativo: false },
  { k: "perdido", t: "Perdido", ativo: false },
  { k: "descartado", t: "Descartado", ativo: false },
];
export const nomeEstagio = (k?: string | null) => ESTAGIOS.find((e) => e.k === k)?.t ?? k ?? "—";

export function tomPrio(p?: string | null): "critico" | "atencao" | "info" | "neutro" {
  return p === "brasa" ? "critico" : p === "faisca" ? "atencao" : p === "temperado" ? "info" : "neutro";
}
