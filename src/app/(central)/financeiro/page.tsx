import { LancarRecebimento } from "@/components/formularios";
import { Botao, Cartao, Kpi, Pagina, Tabela, Vazio } from "@/components/ui";
import { INDICADORES, brl, data, mesNome, pct, valorUnidade } from "@/lib/formato";
import { hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Financeiro" };

export default async function Financeiro() {
  const { sb } = await usuarioAtual();
  const hoje = hojeManaus();
  const mes = hoje.slice(0, 7) + "-01";
  const [{ data: receita }, { data: mrr }, { data: rec }, { data: contratos }, { data: metas }, { data: precos }, { data: ano }] = await Promise.all([
    sb.from("v_receita_mes").select("*").order("mes", { ascending: false }).limit(60),
    sb.from("v_recorrente_ativo").select("*"),
    sb.from("recebimentos").select("*").order("data", { ascending: false }).limit(15),
    sb.from("contratos").select("*").eq("status", "ativo"),
    sb.from("v_meta_real").select("*").eq("mes", mes),
    sb.from("precos").select("*").order("id"),
    sb.from("v_meta_ano").select("*"),
  ]);

  const doMes = (receita ?? []).filter((r) => String(r.mes).startsWith(hoje.slice(0, 7))).reduce((a, r) => a + Number(r.recebido), 0);
  const metaMes = Number((metas ?? []).find((m) => m.indicador === "faturamento_mes")?.alvo ?? 0);
  const mrrTotal = (mrr ?? []).reduce((a, r) => a + Number(r.mrr ?? 0), 0);
  const porMes = new Map<string, number>();
  (receita ?? []).forEach((r) => porMes.set(r.mes, (porMes.get(r.mes) ?? 0) + Number(r.recebido)));
  const meses = [...porMes.entries()].sort().slice(-6);
  const maxMes = Math.max(1, ...meses.map(([, v]) => v));
  const a = ano?.[0];

  return (
    <Pagina titulo="Financeiro" sub="Caixa da Forja: o que entrou, o que é recorrente e a meta." acoes={<><Botao href="/agentes/A8" variante="secundario">Diretor Financeiro</Botao><LancarRecebimento produtos={(precos ?? []).map((p) => p.produto)} /></>}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Recebido no mês" valor={brl(doMes)} sub={`meta ${brl(metaMes)}`} tom={metaMes && doMes >= metaMes ? "ok" : "brasa"} />
        <Kpi rotulo="Falta para a meta" valor={brl(Math.max(0, metaMes - doMes))} />
        <Kpi rotulo="Recorrente (MRR)" valor={brl(mrrTotal)} sub={`${contratos?.length ?? 0} contratos ativos`} />
        <Kpi rotulo="Meta do ano" valor={brl(a?.meta)} sub={a ? `realizado ${brl(a.realizado_desde_nov26)}` : undefined} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Receita por mês">
          {meses.length ? (
            <div className="flex h-44 items-end gap-3">
              {meses.map(([m, v]) => (
                <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="num text-xs text-suave">{brl(v)}</span>
                  <div className="w-full rounded-t bg-brasa/80" style={{ height: `${(v / maxMes) * 120}px` }} />
                  <span className="text-xs text-apagado">{mesNome(m)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Vazio>Nenhum recebimento lançado ainda.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="Metas do mês">
          <Tabela
            linhas={(metas ?? []).filter((m) => Number(m.alvo) > 0)}
            vazio="Sem metas para este mês."
            colunas={[
              { k: "indicador", t: "Indicador", r: (m) => INDICADORES[m.indicador] ?? m.indicador },
              { k: "alvo", t: "Meta", cls: "num", r: (m) => valorUnidade(m.alvo, m.unidade) },
              { k: "real", t: "Real", cls: "num", r: (m) => valorUnidade(m.real ?? 0, m.unidade) },
              { k: "pct", t: "%", cls: "num", r: (m) => pct(m.pct ?? 0) },
            ]}
          />
        </Cartao>
      </div>

      <Cartao titulo="Últimos recebimentos">
        <Tabela
          linhas={rec ?? []}
          vazio="Nenhum recebimento lançado."
          colunas={[
            { k: "data", t: "Data", r: (r) => data(r.data) },
            { k: "produto", t: "Produto" },
            { k: "linha", t: "Linha" },
            { k: "forma", t: "Forma" },
            { k: "valor", t: "Valor", cls: "num text-right", r: (r) => brl(r.valor) },
          ]}
        />
      </Cartao>

      <Cartao titulo="Tabela de preços vigente">
        <Tabela
          linhas={precos ?? []}
          colunas={[
            { k: "produto", t: "Produto", r: (p) => (<div><div>{p.produto}</div>{p.observacao && <div className="text-xs text-suave">{p.observacao}</div>}</div>) },
            { k: "fundadora", t: "Fundadora", cls: "num", r: (p) => brl(p.fundadora) },
            { k: "cheia", t: "Cheia", cls: "num", r: (p) => brl(p.cheia) },
            { k: "unidade", t: "Unidade" },
          ]}
        />
      </Cartao>
    </Pagina>
  );
}
