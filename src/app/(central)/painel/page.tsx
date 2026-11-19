import Link from "next/link";
import { clsx } from "clsx";
import { Botao, Cartao, Pagina, Selo, Tabela, Vazio } from "@/components/ui";
import { brl, num, pct, rotulo } from "@/lib/formato";
import { diasAtras, hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";
import { CasasForjaOS } from "@/components/casas-os";
import { casasDoForjaOS } from "@/lib/forja-os";

export const metadata = { title: "Visão geral" };

const PERIODOS = [
  { k: "7", t: "7 dias" },
  { k: "30", t: "30 dias" },
  { k: "365", t: "Ano" },
];

/** Estágios agrupados nas etapas do mapa do funil. Quem está numa etapa passou por todas as anteriores. */
const ETAPAS: { k: string; t: string; estagios: string[] }[] = [
  { k: "lead", t: "Leads", estagios: ["identificado", "na_lista", "em_cadencia"] },
  { k: "conversa", t: "Conversa", estagios: ["conversa", "qualificado", "conversa_presencial"] },
  { k: "raiox", t: "Raio-X", estagios: ["raiox_proposto", "raiox_agendado", "raiox_pago", "raiox_entregue"] },
  { k: "proposta", t: "Proposta", estagios: ["proposta_enviada"] },
  { k: "implantacao", t: "Implantação", estagios: ["implantacao_fechada"] },
  { k: "care", t: "Care", estagios: ["care_ativo"] },
];
const PERDIDOS = ["perdido", "descartado", "nutricao"];

const ORIGENS: Record<string, string> = {
  pesquisa_a1: "Prospecção do agente",
  indicacao_cliente: "Indicação de cliente",
  parceiro: "Parceiro",
  inbound_whatsapp: "Chegou pelo WhatsApp",
  inbound_instagram: "Chegou pelo Instagram",
  inbound_calculadora: "Calculadora grátis",
  inbound_fichas: "Produto de fichas",
  visita_fria: "Visita fria",
  ligacao_fria: "Ligação fria",
  evento: "Evento",
  trafego_pago: "Tráfego pago",
  outro: "Outro",
};

type Prospect = { id: number; origem: string | null; estagio: string; criado_em: string };
type Evento = { sessao: string | null; evento: string; alvo: string | null; utm_source: string | null; criado_em: string };
type Receb = { produto: string; linha: string; valor: number; data: string };

function indiceEtapa(estagio: string) {
  return ETAPAS.findIndex((e) => e.estagios.includes(estagio));
}

export default async function Painel({ searchParams }: PageProps<"/painel">) {
  const sp = await searchParams;
  const p = typeof sp.p === "string" && PERIODOS.some((x) => x.k === sp.p) ? sp.p : "30";
  const desde = diasAtras(Number(p));
  const { sb } = await usuarioAtual();
  const mes = hojeManaus().slice(0, 7) + "-01";

  const osP = casasDoForjaOS();
  const [{ data: ev }, { data: prosp }, { data: rec }, { data: opps }, { data: metas }] = await Promise.all([
    sb.from("lp_eventos").select("sessao,evento,alvo,utm_source,criado_em").gte("criado_em", desde).limit(20000),
    sb.from("prospects").select("id,origem,estagio,criado_em"),
    sb.from("recebimentos").select("produto,linha,valor,data").gte("data", desde),
    sb.from("oportunidades").select("prospect_id,status,valor_fechado,produto"),
    sb.from("metas").select("indicador,alvo").eq("mes", mes),
  ]);

  const eventos = (ev ?? []) as Evento[];
  const prospects = (prosp ?? []) as Prospect[];
  const recebimentos = (rec ?? []) as Receb[];
  const meta = new Map((metas ?? []).map((m) => [m.indicador, Number(m.alvo)]));

  // Régua do funil
  const visitas = eventos.filter((e) => e.evento === "visita").length;
  const sessoes = new Set(eventos.map((e) => e.sessao).filter(Boolean));
  const cliques = eventos.filter((e) => e.evento === "clique");
  const sessoesWa = new Set(cliques.filter((e) => /whats|wa\.me/i.test(e.alvo ?? "")).map((e) => e.sessao));
  const sessoesCalc = new Set(cliques.filter((e) => /calc/i.test(e.alvo ?? "")).map((e) => e.sessao));
  const leadsPeriodo = prospects.filter((x) => x.criado_em >= desde).length;
  const vendas = recebimentos.length;
  const receita = recebimentos.reduce((a, r) => a + Number(r.valor), 0);
  const ticket = vendas ? receita / vendas : 0;

  // Mapa do funil (posição atual de cada prospect; quem está à frente conta nas etapas de trás)
  const ativos = prospects.filter((x) => !PERDIDOS.includes(x.estagio));
  const alcancou = ETAPAS.map((_, i) => ativos.filter((x) => indiceEtapa(x.estagio) >= i).length);
  const perdidos = prospects.filter((x) => PERDIDOS.includes(x.estagio)).length;

  // Conversões contra a meta
  const conv = (a: number, b: number) => (b ? (a / b) * 100 : null);
  const convContatoRaiox = conv(alcancou[2], alcancou[0]);
  const convRaioxImpl = conv(alcancou[4], alcancou[2]);
  const status = (v: number | null, alvo?: number) =>
    v == null || !alvo ? "neutro" : v >= alvo ? "ok" : v >= alvo * 0.6 ? "atencao" : "critico";

  // Origem dos leads
  const porOrigem = new Map<string, { leads: number; raiox: number; ganhos: number; receita: number }>();
  const ganhosPorProspect = new Map<number, number>();
  (opps ?? []).filter((o) => o.status === "ganha").forEach((o) => ganhosPorProspect.set(o.prospect_id, (ganhosPorProspect.get(o.prospect_id) ?? 0) + Number(o.valor_fechado ?? 0)));
  prospects.forEach((x) => {
    const k = x.origem ?? "outro";
    const o = porOrigem.get(k) ?? { leads: 0, raiox: 0, ganhos: 0, receita: 0 };
    o.leads++;
    if (indiceEtapa(x.estagio) >= 2) o.raiox++;
    if (ganhosPorProspect.has(x.id)) {
      o.ganhos++;
      o.receita += ganhosPorProspect.get(x.id)!;
    }
    porOrigem.set(k, o);
  });
  const totalLeads = prospects.length || 1;
  const origens = [...porOrigem.entries()].sort((a, b) => b[1].leads - a[1].leads);

  // Visitas por origem da página (UTM)
  const utm = new Map<string, number>();
  eventos.filter((e) => e.evento === "visita").forEach((e) => utm.set(e.utm_source ?? "sem marcação", (utm.get(e.utm_source ?? "sem marcação") ?? 0) + 1));

  // Produtos
  const porProduto = new Map<string, { n: number; v: number; linha: string }>();
  recebimentos.forEach((r) => {
    const o = porProduto.get(r.produto) ?? { n: 0, v: 0, linha: r.linha };
    o.n++;
    o.v += Number(r.valor);
    porProduto.set(r.produto, o);
  });

  const regua = [
    { t: "Visitas no funil", v: num(visitas), s: "página de vendas" },
    { t: "Visitantes únicos", v: num(sessoes.size), s: sessoesWa.size ? `${num(sessoesWa.size)} foram ao WhatsApp` : "nenhum clique no WhatsApp ainda" },
    { t: "Leads cadastrados", v: num(leadsPeriodo), s: `${num(prospects.length)} no total` },
    { t: "Vendas", v: num(vendas), s: brl(receita) },
    { t: "Ticket médio", v: vendas ? brl(ticket) : "—", s: "por venda" },
  ];

  const etapasMapa = [
    { t: "Visitantes", n: sessoes.size, sub: `${num(visitas)} visitas` },
    { t: "Foram ao WhatsApp", n: sessoesWa.size, sub: `${num(sessoesCalc.size)} abriram a calculadora` },
    ...ETAPAS.map((e, i) => ({ t: e.t, n: alcancou[i], sub: i === 0 ? `${num(perdidos)} perdidos ou em nutrição` : "" })),
  ];

  return (
    <Pagina
      titulo="Visão geral da Forja"
      sub="Do primeiro clique ao cliente recorrente."
      acoes={
        <div role="group" aria-label="Período" className="inline-flex gap-0.5 rounded-[11px] bg-[rgba(20,16,14,0.05)] p-1">
          {PERIODOS.map((x) => (
            <Link
              key={x.k}
              href={`/painel?p=${x.k}`}
              aria-current={p === x.k ? "true" : undefined}
              className={clsx("rounded-lg px-3 py-1.5 text-sm font-[550]", p === x.k ? "bg-white text-texto shadow-[0_1px_2px_rgba(20,16,14,0.12)]" : "text-suave")}
            >
              {x.t}
            </Link>
          ))}
        </div>
      }
    >
      <section aria-label="Régua do funil" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {regua.map((r) => (
          <div key={r.t} className="rounded-cartao border border-linha bg-painel p-4 shadow-cartao">
            <div className="text-[13px] font-medium text-suave">{r.t}</div>
            <div className="num mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.035em]">{r.v}</div>
            <div className="mt-1 text-[12.5px] text-suave">{r.s}</div>
          </div>
        ))}
      </section>

      <Cartao titulo="Mapa do funil" acao={<span className="text-xs text-suave">quantos chegaram a cada etapa</span>}>
        <div className="rolagem-fina -mx-5 overflow-x-auto px-5 pb-2">
          <ol className="flex min-w-max items-stretch gap-0">
            {etapasMapa.map((e, i) => {
              const ant = i > 0 ? etapasMapa[i - 1].n : null;
              const taxa = ant && e.n <= ant ? (e.n / ant) * 100 : null;
              return (
                <li key={e.t} className="flex items-center">
                  {i > 0 && (
                    <div className="flex w-16 flex-col items-center gap-1">
                      <div className={clsx("h-0.5 w-full", e.n ? "bg-ok" : "bg-linha-forte")} />
                      <span className="num rounded-full border border-linha px-1.5 text-[11px] font-semibold text-suave">{taxa == null ? "—" : pct(taxa)}</span>
                    </div>
                  )}
                  <div className={clsx("w-36 rounded-xl border bg-white px-3 py-2.5", e.n ? "border-linha-forte" : "border-dashed border-linha-forte")}>
                    <div className="text-[13px] font-semibold">{e.t}</div>
                    <div className="num text-xl font-bold tracking-[-0.03em]">{num(e.n)}</div>
                    {e.sub && <div className="text-[11.5px] text-suave">{e.sub}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(20,16,14,0.06)] pt-3">
          <span className="self-center font-mono text-[11px] tracking-[0.06em] text-suave">CONVERSÕES</span>
          <span className="flex items-center gap-1.5 rounded-full border border-linha px-3 py-1 text-[13px]">
            Lead → Raio-X <b className="num">{convContatoRaiox == null ? "—" : pct(convContatoRaiox)}</b>
            <Selo tom={status(convContatoRaiox, meta.get("conv_contato_raiox")) as "ok"}>meta {pct(meta.get("conv_contato_raiox") ?? 0)}</Selo>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-linha px-3 py-1 text-[13px]">
            Raio-X → Implantação <b className="num">{convRaioxImpl == null ? "—" : pct(convRaioxImpl)}</b>
            <Selo tom={status(convRaioxImpl, meta.get("conv_raiox_implantacao")) as "ok"}>meta {pct(meta.get("conv_raiox_implantacao") ?? 0)}</Selo>
          </span>
        </div>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="De onde vêm os leads">
          {origens.length ? (
            <Tabela
              linhas={origens.map(([k, o]) => ({ k, ...o }))}
              colunas={[
                { k: "k", t: "Origem", r: (o) => ORIGENS[o.k] ?? rotulo(o.k) },
                { k: "leads", t: "Leads", cls: "num" },
                { k: "raiox", t: "Raio-X", cls: "num" },
                { k: "ganhos", t: "Fechados", cls: "num" },
                { k: "receita", t: "Receita", cls: "num", r: (o) => brl(o.receita) },
                {
                  k: "part",
                  t: "Parte",
                  r: (o) => (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-[rgba(20,16,14,0.06)]"><div className="h-1.5 rounded-full bg-brasa" style={{ width: `${(o.leads / totalLeads) * 100}%` }} /></div>
                      <span className="num text-xs text-suave">{pct((o.leads / totalLeads) * 100)}</span>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <Vazio>Nenhum lead ainda.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="Visitas da página por origem">
          {utm.size ? (
            <Tabela
              linhas={[...utm.entries()].sort((a, b) => b[1] - a[1]).map(([o, n]) => ({ o, n }))}
              colunas={[
                { k: "o", t: "Origem (link marcado)" },
                { k: "n", t: "Visitas", cls: "num" },
              ]}
            />
          ) : (
            <Vazio>Sem visitas no período.</Vazio>
          )}
          {utm.has("sem marcação") && (
            <p className="mt-3 rounded-[10px] bg-[#fbf3ee] px-3 py-2 text-[13px] text-brasa-escuro">
              Visitas sem marcação não dizem de onde vieram. Use os links marcados (Instagram, anúncio, indicação) da tela Marketing.
            </p>
          )}
        </Cartao>
      </div>

      <CasasForjaOS r={await osP} compacto />

      <Cartao titulo="Produtos no período" acao={<Botao href="/financeiro" variante="secundario">Financeiro</Botao>}>
        {porProduto.size ? (
          <Tabela
            linhas={[...porProduto.entries()].sort((a, b) => b[1].v - a[1].v).map(([produto, o]) => ({ produto, ...o }))}
            colunas={[
              { k: "produto", t: "Produto" },
              { k: "linha", t: "Linha", r: (o) => rotulo(o.linha) },
              { k: "n", t: "Vendas", cls: "num" },
              { k: "v", t: "Receita", cls: "num", r: (o) => brl(o.v) },
            ]}
          />
        ) : (
          <Vazio>Nenhuma venda lançada no período. Vendas da Hotmart entram sozinhas quando a integração estiver ligada; as outras, pelo botão + .</Vazio>
        )}
      </Cartao>
    </Pagina>
  );
}
