import Link from "next/link";
import { clsx } from "clsx";
import { MessageCircle } from "lucide-react";
import { FecharImplantacao, NovaOportunidade, NovoProspect, PerderOportunidade, RegistrarToque, type Preco } from "@/components/formularios";
import { MoverEstagio } from "@/components/mover";
import { Botao, Cartao, Kpi, Pagina, Selo, Tabela } from "@/components/ui";
import { ESTAGIOS, brl, data, nomeEstagio, num, pct, rotulo, tomPrio } from "@/lib/formato";
import { diasAtras, hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Comercial" };

type Prospect = Record<string, unknown> & { id: number; codigo: string; nome_casa: string; estagio: string; prioridade: string | null; score_total: number | null };

export default async function Comercial({ searchParams }: PageProps<"/comercial">) {
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q : "";
  const filtroEstagio = typeof sp.estagio === "string" ? sp.estagio : "";
  const { sb } = await usuarioAtual();
  const hoje = hojeManaus();
  const ha14 = diasAtras(14);

  let q = sb.from("prospects").select("id,codigo,nome_casa,setor,bairro,estagio,prioridade,score_total,proximo_toque_em,whatsapp_decisor,decisor_nome,origem").order("score_total", { ascending: false, nullsFirst: false }).limit(300);
  if (busca) q = q.or(`nome_casa.ilike.%${busca.replace(/[%,()]/g, "")}%,bairro.ilike.%${busca.replace(/[%,()]/g, "")}%,codigo.ilike.%${busca.replace(/[%,()]/g, "")}%`);
  if (filtroEstagio) q = q.eq("estagio", filtroEstagio);

  const [{ data: prospects }, { data: todos }, { data: todosNomes }, { data: canal }, { data: toques }, { data: opps }, { data: precos }] = await Promise.all([
    q,
    sb.from("prospects").select("estagio,prioridade"),
    sb.from("prospects").select("id,nome_casa,codigo").not("estagio", "in", "(perdido,descartado)").order("nome_casa"),
    sb.from("v_conversao_canal").select("*"),
    sb.from("v_toques_dia").select("*").gte("dia", ha14),
    sb.from("oportunidades").select("id,prospect_id,produto,valor_tabela,valor_fechado,status,data_proposta,condicao").eq("status", "aberta").order("data_proposta", { ascending: false }),
    sb.from("precos").select("id,produto,fundadora,cheia,unidade").order("id"),
  ]);
  const opcoesCasas = ((todosNomes ?? []) as { id: number; nome_casa: string; codigo: string }[]).map((p) => ({ id: p.id, rotulo: `${p.nome_casa} · ${p.codigo}` }));
  const nomeProspect = new Map(opcoesCasas.map((o) => [o.id, o.rotulo]));
  const listaPrecos = (precos ?? []) as Preco[];

  const contagem = new Map<string, number>();
  (todos ?? []).forEach((p) => contagem.set(p.estagio, (contagem.get(p.estagio) ?? 0) + 1));
  const brasas = (todos ?? []).filter((p) => p.prioridade === "brasa").length;
  const toquesHoje = (toques ?? []).filter((t) => t.dia === hoje).reduce((a, t) => a + Number(t.toques), 0);
  const toques14 = (toques ?? []).reduce((a, t) => a + Number(t.toques), 0);
  const respostas14 = (toques ?? []).reduce((a, t) => a + Number(t.respostas), 0);
  const pipelineValor = (opps ?? []).reduce((a, o) => a + Number(o.valor_tabela ?? 0), 0);
  const funil = ESTAGIOS.filter((e) => e.ativo);
  const maxFunil = Math.max(1, ...funil.map((e) => contagem.get(e.k) ?? 0));

  return (
    <Pagina titulo="Comercial" sub="Da prospecção ao fechamento." acoes={<><Botao href="/agentes/A1" variante="secundario">Diretor Comercial</Botao><NovoProspect /><NovaOportunidade prospects={opcoesCasas} precos={listaPrecos} /><FecharImplantacao prospects={opcoesCasas} precos={listaPrecos} variante="secundario" /><RegistrarToque prospects={((todosNomes ?? []) as { id: number; nome_casa: string; codigo: string }[])} /></>}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Toques hoje" valor={num(toquesHoje)} sub="meta: 5 por dia" tom={toquesHoje >= 5 ? "ok" : "critico"} />
        <Kpi rotulo="Toques 14 dias" valor={num(toques14)} sub={`${num(respostas14)} respostas`} />
        <Kpi rotulo="Brasa" valor={num(brasas)} sub="prospects de prioridade alta" tom="brasa" />
        <Kpi rotulo="Em negociação" valor={brl(pipelineValor)} sub={`${opps?.length ?? 0} oportunidades abertas`} />
      </section>

      <Cartao titulo="Funil">
        <div className="space-y-1.5">
          {funil.map((e) => {
            const n = contagem.get(e.k) ?? 0;
            return (
              <Link key={e.k} href={`/comercial?estagio=${e.k}`} className={clsx("grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 rounded px-1 py-0.5 text-sm hover:bg-painel-2", filtroEstagio === e.k && "bg-painel-2")}>
                <span className={n ? "text-texto" : "text-apagado"}>{e.t}</span>
                <div className="h-5 overflow-hidden rounded bg-painel-2">
                  <div className="h-full rounded bg-brasa/80" style={{ width: `${(n / maxFunil) * 100}%` }} />
                </div>
                <span className="num text-right text-suave">{n}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-apagado">
          {ESTAGIOS.filter((e) => !e.ativo).map((e) => <span key={e.k}>{e.t}: {contagem.get(e.k) ?? 0}</span>)}
        </div>
      </Cartao>

      <Cartao
        titulo={filtroEstagio ? `Prospects · ${nomeEstagio(filtroEstagio)}` : "Prospects"}
        acao={
          <form className="flex items-center gap-2">
            {filtroEstagio && <input type="hidden" name="estagio" value={filtroEstagio} />}
            <input name="q" defaultValue={busca} placeholder="Buscar casa, bairro, código" className="w-48 rounded border border-linha bg-painel-2 px-2 py-1 text-xs outline-none focus:border-brasa" />
            {(busca || filtroEstagio) && <Link href="/comercial" className="text-xs text-suave hover:text-texto">limpar</Link>}
          </form>
        }
      >
        <Tabela<Prospect>
          linhas={(prospects ?? []) as Prospect[]}
          vazio="Nenhum prospect com esse filtro."
          colunas={[
            { k: "nome_casa", t: "Casa", r: (p) => (<div><div className="font-medium">{p.nome_casa}</div><div className="text-xs text-suave">{p.codigo} · {rotulo(String(p.setor ?? ""))}{p.bairro ? ` · ${p.bairro}` : ""}</div></div>) },
            { k: "score_total", t: "Score", cls: "num", r: (p) => p.score_total ?? "—" },
            { k: "prioridade", t: "Prioridade", r: (p) => <Selo tom={tomPrio(p.prioridade)}>{p.prioridade ?? "—"}</Selo> },
            { k: "proximo_toque_em", t: "Próximo toque", r: (p) => <span className={String(p.proximo_toque_em ?? "9") < hoje ? "text-critico" : ""}>{data(p.proximo_toque_em)}</span> },
            { k: "estagio", t: "Estágio", r: (p) => <MoverEstagio id={p.id} estagio={p.estagio} /> },
            { k: "toque", t: "", r: (p) => <RegistrarToque prospectId={p.id} rotulo="Toque" variante="fantasma" /> },
            { k: "wa", t: "", r: (p) => p.whatsapp_decisor ? <a href={`https://wa.me/${String(p.whatsapp_decisor).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-suave hover:text-ok" aria-label="WhatsApp"><MessageCircle size={16} /></a> : null },
          ]}
        />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Conversão por canal">
          <Tabela
            linhas={canal ?? []}
            vazio="Sem toques registrados ainda."
            colunas={[
              { k: "canal", t: "Canal", r: (c) => rotulo(String(c.canal)) },
              { k: "casas_tocadas", t: "Tocadas", cls: "num" },
              { k: "casas_responderam", t: "Responderam", cls: "num" },
              { k: "raiox_agendados", t: "Raio-X", cls: "num" },
              { k: "pct_raiox", t: "% Raio-X", cls: "num", r: (c) => pct(c.pct_raiox) },
            ]}
          />
        </Cartao>
        <Cartao titulo="Oportunidades abertas">
          <Tabela
            linhas={opps ?? []}
            vazio="Nenhuma proposta comercial aberta."
            colunas={[
              { k: "prospect_id", t: "Casa", r: (o) => (<div><div>{nomeProspect.get(o.prospect_id) ?? "—"}</div><div className="text-xs text-suave">{o.produto}</div></div>) },
              { k: "valor_tabela", t: "Valor", cls: "num", r: (o) => brl(o.valor_tabela) },
              { k: "data_proposta", t: "Desde", r: (o) => data(o.data_proposta) },
              { k: "acoes", t: "", r: (o) => (
                <div className="flex items-center gap-1">
                  <FecharImplantacao prospects={opcoesCasas} precos={listaPrecos} prospectId={o.prospect_id ?? undefined} produto={o.produto} valor={Number(o.valor_tabela) || undefined} variante="fantasma" />
                  <PerderOportunidade id={o.id} />
                </div>
              ) },
            ]}
          />
        </Cartao>
      </div>
    </Pagina>
  );
}
