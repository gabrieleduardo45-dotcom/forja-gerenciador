import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight } from "lucide-react";
import { BotaoRodar } from "@/components/rodar";
import { CartaoProposta, type Proposta } from "@/components/proposta";
import { Barra, Cartao, Kpi, Pagina, Selo, Vazio } from "@/components/ui";
import { INDICADORES, brl, data, dataHora, nomeEstagio, tomPrio, valorUnidade } from "@/lib/formato";
import { hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Hoje" };

const PRINCIPAIS = ["faturamento_mes", "contatos_mes", "raiox_realizados", "implantacoes_vendidas", "receita_recorrente_mes", "digital_vendas"];

type MetaReal = { indicador: string; alvo: number; unidade: string; real: number | null; pct: number | null };
type Texto = { type: string; text?: string };

export default async function Hoje() {
  const { sb, user } = await usuarioAtual();
  const hoje = hojeManaus();
  const mes = hoje.slice(0, 7) + "-01";

  const [metas, propostas, fila, excecoes, parados, pagina, membro] = await Promise.all([
    sb.from("v_meta_real").select("*").eq("mes", mes),
    sb.from("propostas").select("*").eq("status", "pendente").order("criado_em", { ascending: false }).limit(30),
    sb.from("v_fila_hoje").select("*").order("dias_atraso", { ascending: false }).limit(8),
    sb.from("v_excecoes_abertas").select("*").limit(5),
    sb.from("v_campos_parados").select("*").order("dias", { ascending: false }).limit(5),
    sb.from("agente_conversas").select("titulo,mensagens,criado_em").eq("agente", "A0").like("titulo", "Página do dia%").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    sb.from("membros").select("nome").eq("email", user!.email!).maybeSingle(),
  ]);

  const m = new Map((metas.data as MetaReal[] | null)?.map((x) => [x.indicador, x]) ?? []);
  const ordemPrio = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
  const pend = ((propostas.data ?? []) as Proposta[]).sort((a, b) => ordemPrio[a.prioridade] - ordemPrio[b.prioridade]);
  const textoPagina = (pagina.data?.mensagens as { role: string; parts: Texto[] }[] | undefined)
    ?.filter((x) => x.role === "assistant")
    .flatMap((x) => x.parts)
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Manaus" }).format(new Date());
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Manaus" }).format(new Date()));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <Pagina titulo={`${saudacao}, ${membro.data?.nome ?? "Gabriel"}`} sub={<span className="capitalize">{dia}</span>} acoes={<BotaoRodar />}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {PRINCIPAIS.map((k) => {
          const x = m.get(k);
          const alvo = Number(x?.alvo ?? 0);
          const real = Number(x?.real ?? 0);
          const tom = !x || alvo === 0 ? undefined : real >= alvo ? "ok" : real >= alvo * 0.5 ? "atencao" : "critico";
          return (
            <div key={k} className="rounded-lg border border-linha bg-painel p-3.5">
              <div className="text-xs text-suave">{INDICADORES[k] ?? k}</div>
              <div className={`num mt-1 text-xl font-semibold ${tom === "ok" ? "text-ok" : tom === "critico" ? "text-critico" : tom === "atencao" ? "text-atencao" : ""}`}>
                {valorUnidade(x?.real ?? 0, x?.unidade)}
              </div>
              <div className="mb-2 text-xs text-apagado">meta {valorUnidade(x?.alvo, x?.unidade)}</div>
              <Barra valor={real} max={alvo} tom={tom === "ok" ? "ok" : tom === "critico" ? "critico" : "brasa"} />
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Cartao
            titulo={<span className="flex items-center gap-2">Esperando você <Selo tom="brasa">{pend.length}</Selo></span>}
            acao={<Link href="/propostas" className="flex items-center gap-1 text-xs text-suave hover:text-texto">ver tudo <ArrowRight size={12} /></Link>}
          >
            {pend.length ? (
              <div className="space-y-3">
                {pend.slice(0, 5).map((p) => <CartaoProposta key={p.id} p={p} />)}
              </div>
            ) : (
              <Vazio>Nenhuma proposta pendente. Rode os agentes para eles lerem os setores e trazerem o que fazer hoje.</Vazio>
            )}
          </Cartao>

          <Cartao titulo="Página do dia · Diretor de Gestão" acao={pagina.data && <span className="text-xs text-apagado">{dataHora(pagina.data.criado_em)}</span>}>
            {textoPagina ? (
              <div className="md text-sm leading-relaxed text-suave">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{textoPagina}</ReactMarkdown>
              </div>
            ) : (
              <Vazio>A página do dia aparece aqui depois da primeira rodada dos agentes.</Vazio>
            )}
          </Cartao>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Cartao titulo="Tocar hoje" acao={<Link href="/comercial" className="text-xs text-suave hover:text-texto">comercial →</Link>}>
            {fila.data?.length ? (
              <ul className="divide-y divide-linha/60">
                {fila.data.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.nome_casa}</div>
                      <div className="text-xs text-suave">{nomeEstagio(f.estagio)} · {f.bairro ?? f.setor}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {f.dias_atraso > 0 && <Selo tom="critico">{f.dias_atraso}d atraso</Selo>}
                      <Selo tom={tomPrio(f.prioridade)}>{f.prioridade}</Selo>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Ninguém na fila de hoje. Os prospects entram aqui quando têm próximo toque marcado.</Vazio>
            )}
          </Cartao>

          <Cartao titulo="Nas casas">
            {excecoes.data?.length || parados.data?.length ? (
              <ul className="space-y-2 text-sm">
                {excecoes.data?.map((e, i) => (
                  <li key={"e" + i} className="flex items-start justify-between gap-2">
                    <span><Selo tom="critico">{e.codigo}</Selo> <span className="text-suave">{e.o_que}</span></span>
                    <span className="shrink-0 text-xs text-apagado">{data(e.prazo)}</span>
                  </li>
                ))}
                {parados.data?.map((c, i) => (
                  <li key={"c" + i} className="flex items-start justify-between gap-2">
                    <span><Selo tom="atencao">{c.casa}</Selo> <span className="text-suave">falta {c.campo}</span></span>
                    <span className="shrink-0 text-xs text-apagado">{c.dias}d</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Sem exceções abertas nem dados parados.</Vazio>
            )}
          </Cartao>

          <Kpi rotulo="Recorrente ativo" valor={brl(m.get("receita_recorrente_mes")?.real ?? 0)} sub="Care + Forja OS" />
        </div>
      </div>
    </Pagina>
  );
}
