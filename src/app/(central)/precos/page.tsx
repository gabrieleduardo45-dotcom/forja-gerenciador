import { EnviarCatalogo } from "@/components/enviar-catalogo";
import { Cartao, Pagina, Tabela } from "@/components/ui";
import { brl } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Preços" };

const CATALOGO = "https://claude.ai/artifact/RNQtkHp5JuJc1GQyG71yyH";
const GRUPOS = [
  { k: "principal", t: "Planos (Medir, Padronizar, Controlar)" },
  { k: "avulso", t: "Extras para clientes" },
  { k: "digital", t: "Digital" },
];

type P = { id: number; produto: string; fundadora: number | null; cheia: number | null; unidade: string; grupo: string | null; semanas: number | null; visitas: number | null; visitas_mes: number | null; fichas_max: number | null; observacao: string | null };

export default async function Precos() {
  const { sb } = await usuarioAtual();
  const { data } = await sb.from("precos").select("id,produto,fundadora,cheia,unidade,grupo,semanas,visitas,visitas_mes,fichas_max,observacao").order("id");
  const linhas = (data ?? []) as P[];
  const mes = (p: P, v: number | null) => (v == null ? "a definir" : `${brl(v)}${p.unidade === "mes" ? "/mês" : ""}`);
  const prazo = (p: P) =>
    [p.semanas ? `${p.semanas} semanas` : null, p.visitas ? `${p.visitas} visitas` : null, p.visitas_mes != null ? `${p.visitas_mes} visitas/mês` : null, p.fichas_max ? `até ${p.fichas_max} fichas` : null].filter(Boolean).join(" · ") || "—";
  return (
    <Pagina titulo="Preços" sub={<>A tabela oficial da Forja. O FORJA OS copia daqui. <a href={CATALOGO} target="_blank" rel="noreferrer" className="font-semibold text-brasa-escuro underline">Ver o catálogo completo</a></>} acoes={<EnviarCatalogo />}>
      {GRUPOS.map((g) => (
        <Cartao key={g.k} titulo={g.t}>
          <Tabela
            linhas={linhas.filter((p) => (p.grupo ?? "avulso") === g.k)}
            colunas={[
              { k: "produto", t: "Produto", r: (p) => <span className="font-medium">{p.produto}</span> },
              { k: "fundadora", t: "Fundador", cls: "num", r: (p) => mes(p, p.fundadora) },
              { k: "cheia", t: "Cheio", cls: "num", r: (p) => (p.cheia == null || p.cheia === p.fundadora ? "—" : mes(p, p.cheia)) },
              { k: "prazo", t: "Prazo e visitas", r: (p) => <span className="text-sm text-suave">{prazo(p)}</span> },
            ]}
          />
        </Cartao>
      ))}
    </Pagina>
  );
}
