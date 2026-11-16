import { Botao, Cartao, Kpi, Pagina, Tabela } from "@/components/ui";
import { data, num, pct, rotulo } from "@/lib/formato";
import { diasAtras } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Marketing" };

export default async function Marketing() {
  const { sb } = await usuarioAtual();
  const ha30 = diasAtras(30);
  const [{ data: conv }, { data: origem }, { data: cliques }, { data: origemLead }] = await Promise.all([
    sb.from("v_lp_conversao").select("*").gte("dia", ha30).order("dia", { ascending: false }),
    sb.from("v_lp_origem").select("*").order("visitas", { ascending: false }).limit(15),
    sb.from("v_lp_cliques").select("*").order("cliques", { ascending: false }).limit(15),
    sb.from("v_conversao_origem").select("*"),
  ]);
  const visitas = (conv ?? []).reduce((a, c) => a + Number(c.visitas), 0);
  const wa = (conv ?? []).reduce((a, c) => a + Number(c.sessoes_whatsapp), 0);
  const calc = (conv ?? []).reduce((a, c) => a + Number(c.sessoes_calculadora), 0);

  return (
    <Pagina titulo="Marketing" sub="Página de vendas, origem dos leads e conteúdo." acoes={<><Botao href="/agentes/A12" variante="secundario">Conversão</Botao><Botao href="/agentes/A2">Marketing</Botao></>}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Visitas 30 dias" valor={num(visitas)} />
        <Kpi rotulo="Foram ao WhatsApp" valor={num(wa)} sub={visitas ? pct((wa / visitas) * 100) : undefined} tom="brasa" />
        <Kpi rotulo="Abriram calculadora" valor={num(calc)} />
        <Kpi rotulo="Dias com dado" valor={num(new Set((conv ?? []).map((c) => c.dia)).size)} />
      </section>
      <Cartao titulo="Conversão diária da página">
        <Tabela
          linhas={conv ?? []}
          vazio="Sem visitas registradas nos últimos 30 dias."
          colunas={[
            { k: "dia", t: "Dia", r: (c) => data(c.dia) },
            { k: "pagina", t: "Página" },
            { k: "variante", t: "Variante" },
            { k: "visitas", t: "Visitas", cls: "num" },
            { k: "sessoes_whatsapp", t: "WhatsApp", cls: "num" },
            { k: "pct_whatsapp", t: "%", cls: "num", r: (c) => pct(c.pct_whatsapp) },
          ]}
        />
      </Cartao>
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="De onde vêm as visitas">
          <Tabela linhas={origem ?? []} vazio="Sem dado." colunas={[{ k: "origem", t: "Origem" }, { k: "dispositivo", t: "Dispositivo" }, { k: "visitas", t: "Visitas", cls: "num" }, { k: "whatsapp", t: "WhatsApp", cls: "num" }]} />
        </Cartao>
        <Cartao titulo="O que clicam">
          <Tabela linhas={cliques ?? []} vazio="Sem cliques." colunas={[{ k: "alvo", t: "Alvo" }, { k: "cliques", t: "Cliques", cls: "num" }, { k: "sessoes", t: "Sessões", cls: "num" }]} />
        </Cartao>
      </div>
      <Cartao titulo="Leads por origem">
        <Tabela linhas={origemLead ?? []} vazio="Sem prospects." colunas={[{ k: "origem", t: "Origem", r: (o) => rotulo(String(o.origem ?? "—")) }, { k: "casas", t: "Casas", cls: "num" }, { k: "avancaram", t: "Avançaram", cls: "num" }, { k: "chegaram_raiox", t: "Raio-X", cls: "num" }]} />
      </Cartao>
    </Pagina>
  );
}
