import Link from "next/link";
import { clsx } from "clsx";
import { AbasNumeros } from "@/components/abas-numeros";
import { ImportarExtrato, LancarDespesa, Parametros, TrocarCategoria } from "@/components/extrato";
import { BarrasCategoria, ColunasMes, LinhaSaldo } from "@/components/graficos";
import { Cartao, Selo, Vazio } from "@/components/ui";
import { brl, data, pct } from "@/lib/formato";
import { CAT, caixaMensal, dre, grupoDe, mesDe, ultimosMeses, type Lanc, type Receb } from "@/lib/financeiro";
import { hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Números" };

const nomeMes = (m: string) => {
  const t = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const curto = (m: string) => new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)).replace(".", "");
const zero = (v: number) => (Math.abs(v) < 0.005 ? 0 : v);

export default async function Numeros({ searchParams }: PageProps<"/numeros">) {
  const sp = await searchParams;
  const { sb } = await usuarioAtual();
  const hoje = hojeManaus();
  const mesAtual = hoje.slice(0, 7);
  const mes = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : mesAtual;
  const meses = ultimosMeses(mes > mesAtual ? mesAtual : mes, 6);
  const desde = ultimosMeses(meses[0], 4)[0] + "-01";

  const [{ data: rec }, { data: lan }, { data: par }, { data: con }, { data: casasNovas }] = await Promise.all([
    sb.from("recebimentos").select("data,valor,linha").gte("data", desde).limit(5000),
    sb.from("lancamentos").select("id,data,descricao,valor,categoria").order("data", { ascending: false }).limit(10000),
    sb.from("parametros").select("chave,valor"),
    sb.from("contratos").select("valor,unidade,status").eq("status", "ativo"),
    sb.from("casas").select("id,criado_em").gte("criado_em", `${mes}-01`),
  ]);
  const p = new Map((par ?? []).map((x) => [x.chave, x.valor]));
  const aliquota = Number(p.get("aliquota_simples") ?? 0.06);
  const saldoBanco = p.has("saldo_banco") ? Number(p.get("saldo_banco")) : null;
  const saldoData = p.get("saldo_banco_data") ?? null;
  const receb = (rec ?? []) as Receb[];
  const lanc = (lan ?? []).map((l) => ({ ...l, valor: Number(l.valor) })) as (Lanc & { id: number; descricao: string })[];

  const d = dre(mes, receb, lanc, aliquota);
  const anterior = ultimosMeses(mes, 2)[0];
  const dAnt = dre(anterior, receb, lanc, aliquota);
  const serie = meses.map((m) => ({ m, d: dre(m, receb, lanc, aliquota) }));
  const caixa = caixaMensal(meses, lanc, saldoBanco ?? 0, saldoBanco != null ? saldoData : null);
  const saldoAgora = caixa[caixa.length - 1]?.saldo ?? 0;

  // KPIs
  const tres = ultimosMeses(mes, 3).map((m) => dre(m, receb, lanc, aliquota));
  const fixasMedia = tres.reduce((s, x) => s + x.despesas + x.proLabore + x.financeiro, 0) / 3;
  const saidasMedia = caixa.slice(-3).reduce((s, x) => s + x.saidas, 0) / Math.min(3, caixa.length || 1);
  const margemContrib = d.receita > 0 ? (d.receita - d.imposto - d.custos) / d.receita : null;
  const equilibrio = margemContrib && margemContrib > 0 ? fixasMedia / margemContrib : null;
  const mesesCaixa = saidasMedia > 0 && saldoBanco != null ? saldoAgora / saidasMedia : null;
  const recDoMes = receb.filter((r) => mesDe(r.data) === mes && r.linha !== "digital");
  const ticket = recDoMes.length ? d.receitaClientes / recDoMes.length : null;
  const recorrente = (con ?? []).filter((c) => ["mes", "mensal"].includes(c.unidade ?? "")).reduce((s, c) => s + Number(c.valor), 0);
  const marketing = Math.abs(d.porCategoria.get("marketing") ?? 0);
  const novos = casasNovas?.filter((c) => mesDe(c.criado_em) === mes).length ?? 0;
  const cac = novos ? marketing / novos : null;
  const variacao = dAnt.receita > 0 ? ((d.receita - dAnt.receita) / dAnt.receita) * 100 : null;

  const despesasCat = [...d.porCategoria.entries()]
    .filter(([k, v]) => v < 0 && !["transferencia", "investimento", "a_classificar"].includes(grupoDe(k)))
    .map(([k, v]) => ({ t: CAT.get(k)?.t ?? k, v: -v }))
    .sort((a, b) => b.v - a.v);
  const aClassificar = lanc.filter((l) => l.categoria === "a_classificar").slice(0, 30);
  const doMes = lanc.filter((l) => mesDe(l.data) === mes);
  const vazio = !lanc.length;

  return (
    <div className="entra mx-auto w-full max-w-6xl space-y-6 px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em]">Números</h1>
          <p className="mt-1 text-[15px] text-suave">{nomeMes(mes)} · Simples Nacional</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportarExtrato />
          <LancarDespesa />
          <Parametros aliquota={aliquota} saldo={saldoBanco} saldoData={saldoData} />
        </div>
      </header>
      <AbasNumeros ativa="financeiro" />

      <nav aria-label="Mês" className="flex gap-1.5 overflow-x-auto pb-1">
        {ultimosMeses(mesAtual, 12).reverse().map((m) => (
          <Link key={m} href={`?m=${m}`} scroll={false} className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-sm", m === mes ? "border-brasa bg-[#fbf3ee] font-semibold text-brasa-escuro" : "border-linha bg-painel text-suave")}>
            {curto(m)}/{m.slice(2, 4)}
          </Link>
        ))}
      </nav>

      {vazio && (
        <Vazio acao={<ImportarExtrato />}>
          Ainda não tem nenhuma saída registrada, então a DRE mostra só a receita. Importe o extrato do banco (OFX ou CSV) e a IA separa as despesas por categoria.
        </Vazio>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile rotulo="Receita do mês" valor={brl(d.receita)} sub={variacao != null ? `${variacao >= 0 ? "+" : ""}${variacao.toFixed(0)}% vs mês anterior` : "sem mês anterior"} />
        <Tile rotulo="Lucro líquido" valor={brl(d.lucroLiquido)} tom={d.lucroLiquido < 0 ? "critico" : undefined} />
        <Tile rotulo="Margem líquida" valor={pct(d.margemLiquida?.toFixed(1))} tom={d.margemLiquida != null && d.margemLiquida < 10 ? "atencao" : undefined} />
        <Tile rotulo="Saldo em caixa" valor={saldoBanco != null ? brl(saldoAgora) : "—"} sub={saldoBanco == null ? "informe em Ajustes ou importe OFX" : mesesCaixa != null ? `dá ${mesesCaixa.toFixed(1)} meses de saídas` : undefined} />
        <Tile rotulo="Ponto de equilíbrio" valor={equilibrio != null ? brl(equilibrio) : "—"} sub="receita mínima por mês" />
        <Tile rotulo="Margem bruta" valor={pct(d.margemBruta?.toFixed(1))} sub="depois de imposto e custos" />
        <Tile rotulo="Ticket médio" valor={ticket != null ? brl(ticket) : "—"} sub="por recebimento de cliente" />
        <Tile rotulo="Recorrente ativo" valor={brl(recorrente)} sub={cac != null && marketing > 0 ? `custo por cliente novo ${brl(cac)}` : "contratos mensais"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Cartao className="lg:col-span-3" titulo="Receita x saídas" acao={<span className="text-xs text-suave">toque num mês para abrir</span>}>
          <ColunasMes dados={serie.map(({ m, d }) => ({ mes: m, a: d.receita, b: d.imposto + d.custos + d.despesas + d.proLabore + d.financeiro }))} rotuloA="Receita" rotuloB="Imposto, custos e despesas" selecionado={mes} />
        </Cartao>
        <Cartao className="lg:col-span-2" titulo="Para onde foi o dinheiro">
          <BarrasCategoria itens={despesasCat.slice(0, 8)} />
        </Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Cartao className="lg:col-span-3" titulo={<span>DRE · {nomeMes(mes)}</span>}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-linha text-left text-xs text-apagado"><th className="py-2 font-medium"></th><th className="py-2 text-right font-medium">Mês</th><th className="py-2 pl-3 text-right font-medium">% receita</th><th className="hidden py-2 text-right font-medium sm:table-cell">Mês anterior</th></tr></thead>
            <tbody>
              <Linha t="Receita bruta" v={d.receita} a={dAnt.receita} r={d.receita} forte />
              <Linha t="  Clientes (consultoria, Care)" v={d.receitaClientes} a={dAnt.receitaClientes} r={d.receita} sub />
              <Linha t="  Digital (Hotmart)" v={d.receitaDigital} a={dAnt.receitaDigital} r={d.receita} sub />
              {d.receitaOutras > 0 && <Linha t="  Outras entradas" v={d.receitaOutras} a={dAnt.receitaOutras} r={d.receita} sub />}
              <Linha t={`(−) Simples Nacional${d.impostoEstimado ? " · estimado" : ""}`} v={-d.imposto} a={-dAnt.imposto} r={d.receita} />
              <Linha t="= Receita líquida" v={d.receitaLiquida} a={dAnt.receitaLiquida} r={d.receita} forte />
              <Linha t="(−) Custos dos serviços" v={-d.custos} a={-dAnt.custos} r={d.receita} />
              <Linha t="= Lucro bruto" v={d.lucroBruto} a={dAnt.lucroBruto} r={d.receita} forte />
              <Linha t="(−) Despesas operacionais" v={-d.despesas} a={-dAnt.despesas} r={d.receita} />
              <Linha t="(−) Pró-labore e retiradas" v={-d.proLabore} a={-dAnt.proLabore} r={d.receita} />
              <Linha t="= Resultado operacional" v={d.resultadoOperacional} a={dAnt.resultadoOperacional} r={d.receita} forte />
              <Linha t="(−) Tarifas e juros" v={-d.financeiro} a={-dAnt.financeiro} r={d.receita} />
              <Linha t="= Lucro líquido" v={d.lucroLiquido} a={dAnt.lucroLiquido} r={d.receita} forte final />
            </tbody>
          </table>
          {d.impostoEstimado && <p className="mt-3 text-xs text-suave">O DAS do mês ainda não apareceu no extrato. Estimei com {(aliquota * 100).toLocaleString("pt-BR")}% sobre a receita (ajuste em Ajustes).</p>}
          {d.aClassificar > 0 && <p className="mt-2 text-xs text-brasa-escuro">{d.aClassificar} lançamentos do mês estão sem categoria e não entraram na DRE. Classifique abaixo.</p>}
        </Cartao>
        <Cartao className="lg:col-span-2" titulo="Caixa (DFC)">
          {saldoBanco != null ? <LinhaSaldo dados={caixa.map((c) => ({ mes: c.mes, v: c.saldo }))} /> : <p className="mb-3 text-sm text-suave">Informe o saldo do banco (em Ajustes) ou importe um OFX para o gráfico do saldo aparecer.</p>}
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-linha text-left text-xs text-apagado"><th className="py-1.5 font-medium">Mês</th><th className="py-1.5 text-right font-medium">Entrou</th><th className="py-1.5 text-right font-medium">Saiu</th><th className="py-1.5 text-right font-medium">Sobra</th></tr></thead>
            <tbody>
              {caixa.map((c) => (
                <tr key={c.mes} className={clsx("border-b border-[rgba(20,16,14,0.05)]", c.mes === mes && "font-semibold")}>
                  <td className="py-1.5">{curto(c.mes)}</td>
                  <td className="num py-1.5 text-right">{brl(zero(c.entradas))}</td>
                  <td className="num py-1.5 text-right">{brl(zero(c.saidas))}</td>
                  <td className={clsx("num py-1.5 text-right", c.entradas - c.saidas < 0 && "text-critico")}>{brl(zero(c.entradas - c.saidas))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-suave">Próximos 30 dias (previsão): entra <b className="num text-texto">{brl(recorrente)}</b> dos contratos mensais; sai em média <b className="num text-texto">{brl(saidasMedia)}</b>.</p>
        </Cartao>
      </div>

      {aClassificar.length > 0 && (
        <Cartao titulo={<span className="flex items-center gap-2">Sem categoria <Selo tom="brasa">{aClassificar.length}</Selo></span>}>
          <ul className="divide-y divide-[rgba(20,16,14,0.06)]">
            {aClassificar.map((l) => (
              <li key={l.id} className="grid gap-2 py-2.5 sm:grid-cols-[1fr_auto_14rem] sm:items-center">
                <span className="min-w-0 truncate text-sm"><span className="text-apagado">{data(l.data)}</span> {l.descricao}</span>
                <span className={clsx("num text-sm font-semibold", l.valor > 0 && "text-ok")}>{brl(l.valor)}</span>
                <TrocarCategoria id={l.id} categoria={l.categoria} />
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {doMes.length > 0 && (
        <details className="rounded-cartao border border-linha bg-painel p-4 shadow-cartao">
          <summary className="cursor-pointer text-sm font-semibold">Todos os lançamentos do mês ({doMes.length})</summary>
          <ul className="mt-3 divide-y divide-[rgba(20,16,14,0.06)]">
            {doMes.map((l) => (
              <li key={l.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_auto_14rem] sm:items-center">
                <span className="min-w-0 truncate text-sm"><span className="text-apagado">{data(l.data)}</span> {l.descricao}</span>
                <span className={clsx("num text-sm", l.valor > 0 && "text-ok")}>{brl(l.valor)}</span>
                <TrocarCategoria id={l.id} categoria={l.categoria} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Tile({ rotulo, valor, sub, tom }: { rotulo: string; valor: string; sub?: string; tom?: "critico" | "atencao" }) {
  return (
    <div className={clsx("rounded-cartao border bg-painel p-4 shadow-cartao", tom ? "border-brasa" : "border-linha")}>
      <div className="text-[13px] font-medium text-suave">{rotulo}</div>
      <div className={clsx("num mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] md:text-[26px]", tom === "critico" && "text-critico", tom === "atencao" && "text-atencao")}>{valor}</div>
      {sub && <div className="mt-1 text-[12px] text-apagado">{sub}</div>}
    </div>
  );
}

function Linha({ t, v, a, r, forte, sub, final }: { t: string; v: number; a: number; r: number; forte?: boolean; sub?: boolean; final?: boolean }) {
  return (
    <tr className={clsx("border-b border-[rgba(20,16,14,0.05)]", final && "border-0 bg-[rgba(20,16,14,0.03)]")}>
      <td className={clsx("py-2", forte && "font-semibold", sub && "pl-3 text-suave")}>{t.trim()}</td>
      <td className={clsx("num whitespace-nowrap py-2 pl-2 text-right", forte && "font-semibold", v < 0 && final && "text-critico")}>{brl(zero(v))}</td>
      <td className="num whitespace-nowrap py-2 pl-3 text-right text-xs text-suave">{r > 0 ? `${zero((v / r) * 100).toFixed(1)}%` : "—"}</td>
      <td className="num hidden whitespace-nowrap py-2 pl-3 text-right text-apagado sm:table-cell">{brl(zero(a))}</td>
    </tr>
  );
}
