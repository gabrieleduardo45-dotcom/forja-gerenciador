import { Botao, Cartao, Kpi, Pagina, Selo, Tabela } from "@/components/ui";
import { brl, data, num, pct } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Casas" };

export default async function Casas() {
  const { sb } = await usuarioAtual();
  const [{ data: casas }, { data: cmv }, { data: exc }, { data: parados }, { data: vh }, { data: entregas }] = await Promise.all([
    sb.from("casas").select("*").order("codigo"),
    sb.from("cmv").select("casa_id,semana_inicio,cmv_pct,alvo_pct,estado").order("semana_inicio", { ascending: false }).limit(200),
    sb.from("v_excecoes_abertas").select("*"),
    sb.from("v_campos_parados").select("*").order("dias", { ascending: false }),
    sb.from("v_valor_hora_casa").select("*"),
    sb.from("entregas").select("casa_id,titulo,tipo,status,data,retrabalho").neq("status", "entregue").order("data").limit(20),
  ]);

  const ultimoCmv = new Map<number, { cmv_pct: number; alvo_pct: number; estado: string; semana_inicio: string }>();
  (cmv ?? []).forEach((c) => { if (!ultimoCmv.has(c.casa_id)) ultimoCmv.set(c.casa_id, c); });
  const codigoCasa = new Map((casas ?? []).map((c) => [c.id, c.codigo]));
  const ativas = (casas ?? []).filter((c) => c.status !== "encerrada" && c.status !== "pausada").length;
  const foraAlvo = [...ultimoCmv.values()].filter((c) => Number(c.cmv_pct) > Number(c.alvo_pct)).length;

  return (
    <Pagina titulo="Casas" sub="Restaurantes clientes: CMV, rotina e entregas." acoes={<><Botao href="/agentes/A7" variante="secundario">Operações</Botao><Botao href="/agentes/A4">Custos</Botao></>}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Casas ativas" valor={num(ativas)} />
        <Kpi rotulo="Fora do CMV alvo" valor={num(foraAlvo)} tom={foraAlvo ? "critico" : "ok"} />
        <Kpi rotulo="Exceções abertas" valor={num(exc?.length ?? 0)} tom={exc?.length ? "atencao" : undefined} />
        <Kpi rotulo="Dados parados" valor={num(parados?.length ?? 0)} sub="campos que o cliente não entregou" />
      </section>

      <Cartao titulo="Carteira">
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
              { k: "codigo", t: "Casa" },
              { k: "o_que", t: "O que", r: (e) => (<div><div>{e.o_que}</div>{e.causa && <div className="text-xs text-suave">causa: {e.causa}</div>}</div>) },
              { k: "repeticoes", t: "Rep.", cls: "num" },
              { k: "prazo", t: "Prazo", r: (e) => data(e.prazo) },
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
