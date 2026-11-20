import { RegistrarExcecao, ResolverExcecao } from "@/components/formularios";
import { Cartao, Kpi, Pagina, Selo, Tabela } from "@/components/ui";
import { brl, data, num, pct } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";
import { diasAtras } from "@/lib/motor";
import { CasasForjaOS } from "@/components/casas-os";
import { SobraDescarte } from "@/components/sobra-descarte";
import { contratosDasCasas } from "@/lib/contratos";
import { casasDoForjaOS } from "@/lib/forja-os";

export const metadata = { title: "Casas" };

export default async function Casas() {
  const { sb } = await usuarioAtual();
  const osP = casasDoForjaOS();
  const despP = sb.from("desperdicio").select("id,data,casa_nome,item,tipo,peso_kg,peso_fonte,motivo").gte("data", diasAtras(7)).order("data", { ascending: false }).limit(300);
  const [{ data: casas }, { data: cmv }, { data: exc }, { data: parados }, { data: vh }, { data: entregas }] = await Promise.all([
    sb.from("casas").select("*").order("codigo"),
    sb.from("cmv").select("casa_id,semana_inicio,cmv_pct,alvo_pct,estado").order("semana_inicio", { ascending: false }).limit(200),
    sb.from("excecoes").select("id,casa_id,data,o_que,causa,acao,estado,repeticoes,prazo,responsavel").eq("resolvida", false).order("data", { ascending: false }),
    sb.from("v_campos_parados").select("*").order("dias", { ascending: false }),
    sb.from("v_valor_hora_casa").select("*"),
    sb.from("entregas").select("casa_id,titulo,tipo,status,data,retrabalho").neq("status", "entregue").order("data").limit(20),
  ]);

  const ultimoCmv = new Map<number, { cmv_pct: number; alvo_pct: number; estado: string; semana_inicio: string }>();
  (cmv ?? []).forEach((c) => { if (!ultimoCmv.has(c.casa_id)) ultimoCmv.set(c.casa_id, c); });
  const codigoCasa = new Map((casas ?? []).map((c) => [c.id, c.codigo]));
  const ativas = (casas ?? []).filter((c) => c.status === "ativa").length;
  const opcoesCasas = (casas ?? []).filter((c) => c.status === "ativa").map((c) => ({ id: c.id as number, rotulo: `${c.codigo} · ${c.nome ?? ""}` }));
  const foraAlvo = [...ultimoCmv.values()].filter((c) => Number(c.cmv_pct) > Number(c.alvo_pct)).length;

  const os = await osP;
  const cc = await contratosDasCasas(sb, os.casas);
  return (
    <Pagina titulo="Casas" sub="Sua casa sócia, a demonstração e as consultorias." acoes={<><SobraDescarte /><RegistrarExcecao casas={opcoesCasas} /></>}>
      <CasasForjaOS r={os} precos={cc.precos} ligadas={cc.ligadas} cadastradas={cc.cadastradas} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Casas ativas" valor={num(ativas)} />
        <Kpi rotulo="Fora do CMV alvo" valor={num(foraAlvo)} tom={foraAlvo ? "critico" : "ok"} />
        <Kpi rotulo="Exceções abertas" valor={num(exc?.length ?? 0)} tom={exc?.length ? "atencao" : undefined} />
        <Kpi rotulo="Dados parados" valor={num(parados?.length ?? 0)} sub="campos que o cliente não entregou" />
      </section>

      <Desperdicio linhas={((await despP).data ?? []) as LinhaDesp[]} />

      <Cartao titulo="Cadastro e contratos na Gestão">
        <Tabela
          linhas={casas ?? []}
          vazio="Nenhuma casa cadastrada ainda. Quando um Raio-X vira implantação, a casa entra aqui."
          colunas={[
            { k: "codigo", t: "Casa", r: (c) => (<div><div className="font-medium">{c.codigo}</div><div className="text-xs text-suave">{c.nome}</div></div>) },
            { k: "setor", t: "Setor" },
            { k: "status", t: "Status", r: (c) => <Selo tom={c.status === "ativa" ? "ok" : "neutro"}>{c.status}</Selo> },
            { k: "fundadora", t: "", r: (c) => (c.fundadora ? <Selo tom="brasa">fundadora</Selo> : null) },
            { k: "cmv", t: "CMV último", cls: "num", r: (c) => { const u = ultimoCmv.get(c.id); return u ? <span className={Number(u.cmv_pct) > Number(u.alvo_pct) ? "text-critico" : "text-ok"}>{pct(u.cmv_pct)} <span className="text-apagado">/ {pct(u.alvo_pct)}</span></span> : "—"; } },
            { k: "inicio", t: "Início", r: (c) => data(c.inicio) },
          ]}
        />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Exceções abertas">
          <Tabela
            linhas={exc ?? []}
            vazio="Nenhuma exceção aberta."
            colunas={[
              { k: "casa_id", t: "Casa", r: (e) => <Selo tom={e.estado === "brasa" ? "critico" : "atencao"}>{codigoCasa.get(e.casa_id) ?? "—"}</Selo> },
              { k: "o_que", t: "O que", r: (e) => (<div><div>{e.o_que}</div>{(e.causa || e.acao) && <div className="text-xs text-suave">{e.causa && `causa: ${e.causa}`}{e.causa && e.acao && " · "}{e.acao && `ação: ${e.acao}`}</div>}</div>) },
              { k: "prazo", t: "Prazo", r: (e) => data(e.prazo) },
              { k: "id", t: "", r: (e) => <ResolverExcecao id={e.id} /> },
            ]}
          />
        </Cartao>
        <Cartao titulo="Entregas em aberto">
          <Tabela
            linhas={entregas ?? []}
            vazio="Nenhuma entrega pendente."
            colunas={[
              { k: "casa_id", t: "Casa", r: (e) => codigoCasa.get(e.casa_id) ?? "—" },
              { k: "titulo", t: "Entrega" },
              { k: "status", t: "Status", r: (e) => <Selo tom={e.retrabalho ? "critico" : "neutro"}>{e.retrabalho ? "retrabalho" : e.status}</Selo> },
              { k: "data", t: "Data", r: (e) => data(e.data) },
            ]}
          />
        </Cartao>
      </div>

      <Cartao titulo="Valor por hora real">
        <Tabela
          linhas={vh ?? []}
          vazio="Sem horas lançadas ainda."
          colunas={[
            { k: "codigo", t: "Casa" },
            { k: "horas", t: "Horas", cls: "num", r: (v) => num(v.horas) },
            { k: "recebido_mes", t: "Recebido no mês", cls: "num", r: (v) => brl(v.recebido_mes) },
            { k: "valor_hora", t: "R$/hora", cls: "num", r: (v) => brl(v.valor_hora) },
          ]}
        />
      </Cartao>
    </Pagina>
  );
}

type LinhaDesp = { id: number; data: string; casa_nome: string; item: string; tipo: "sobra" | "descarte"; peso_kg: number | null; peso_fonte: string | null; motivo: string | null };

function Desperdicio({ linhas }: { linhas: LinhaDesp[] }) {
  const porCasa = new Map<string, { sobra: number; descarte: number; n: number }>();
  linhas.forEach((l) => {
    const c = porCasa.get(l.casa_nome) ?? { sobra: 0, descarte: 0, n: 0 };
    c[l.tipo] += Number(l.peso_kg ?? 0);
    c.n += 1;
    porCasa.set(l.casa_nome, c);
  });
  const resumo = [...porCasa.entries()].map(([casa, v]) => ({ casa, ...v })).sort((a, b) => b.descarte - a.descarte);
  return (
    <Cartao titulo="Sobra e descarte · 7 dias" acao={<span className="text-xs text-suave">lançado por foto</span>}>
      <Tabela
        linhas={resumo}
        vazio="Nada lançado ainda. Use o botão Sobra e descarte com as fotos que a cozinha manda."
        colunas={[
          { k: "casa", t: "Casa", r: (r) => <span className="font-medium">{r.casa}</span> },
          { k: "sobra", t: "Sobra", cls: "num", r: (r) => <span className="text-atencao">{num(r.sobra)} kg</span> },
          { k: "descarte", t: "Descarte", cls: "num", r: (r) => <span className="text-critico">{num(r.descarte)} kg</span> },
          { k: "n", t: "Fotos/itens", cls: "num" },
        ]}
      />
      {linhas.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-suave">Ver itens</summary>
          <ul className="mt-2 divide-y divide-[rgba(20,16,14,0.06)]">
            {linhas.slice(0, 60).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{data(l.data)} · {l.casa_nome} · {l.item}{l.motivo ? <span className="text-apagado"> · {l.motivo}</span> : null}</span>
                <span className="shrink-0"><Selo tom={l.tipo === "sobra" ? "atencao" : "critico"}>{l.tipo}</Selo> <span className="num">{l.peso_kg != null ? `${num(l.peso_kg)} kg` : "—"}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Cartao>
  );
}
