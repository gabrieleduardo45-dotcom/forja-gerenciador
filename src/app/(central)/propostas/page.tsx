import Link from "next/link";
import { clsx } from "clsx";
import { CartaoProposta, type Proposta } from "@/components/proposta";
import { BotaoRodar } from "@/components/rodar";
import { Pagina, Vazio } from "@/components/ui";
import { SETORES } from "@/lib/agentes";
import { contatoDe, contatosDasPropostas } from "@/lib/contatos";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Aprovar" };

const ABAS = [
  { k: "pendente", t: "Pendentes" },
  { k: "aprovada", t: "Aprovadas · a fazer" },
  { k: "feita", t: "Feitas" },
  { k: "descartada", t: "Descartadas" },
];

export default async function Propostas({ searchParams }: PageProps<"/propostas">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pendente";
  const agente = typeof sp.agente === "string" ? sp.agente : undefined;
  const { sb } = await usuarioAtual();

  let q = sb.from("propostas").select("*").eq("status", status).order("criado_em", { ascending: false }).limit(100);
  if (agente) q = q.eq("agente", agente);
  const [{ data }, { data: contagem }] = await Promise.all([q, sb.from("propostas").select("status,agente")]);

  const porStatus = (s: string) => (contagem ?? []).filter((c) => c.status === s && (!agente || c.agente === agente)).length;
  const ordem = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
  const lista = ((data ?? []) as Proposta[]).sort((a, b) => (status === "pendente" ? ordem[a.prioridade] - ordem[b.prioridade] : 0));
  const contatos = await contatosDasPropostas(sb, lista);
  const agentesComProposta = [...new Set((contagem ?? []).map((c) => c.agente))].sort();
  const link = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const st = o.status ?? status;
    const ag = "agente" in o ? o.agente : agente;
    if (st !== "pendente") u.set("status", st);
    if (ag) u.set("agente", ag);
    return `/propostas${u.size ? "?" + u : ""}`;
  };

  return (
    <Pagina titulo="Aprovar" sub="Os agentes propõem. Nada sai daqui sem o seu ok." acoes={<BotaoRodar />}>
      <div className="flex gap-1 overflow-x-auto border-b border-linha">
        {ABAS.map((a) => (
          <Link key={a.k} href={link({ status: a.k })} className={clsx("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm", status === a.k ? "border-brasa text-texto" : "border-transparent text-suave hover:text-texto")}>
            {a.t} <span className="num text-apagado">{porStatus(a.k)}</span>
          </Link>
        ))}
      </div>
      {agentesComProposta.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Link href={link({ agente: undefined })} className={clsx("rounded-md px-2.5 py-1 text-xs", !agente ? "bg-painel-2 text-texto" : "text-suave")}>Todos os setores</Link>
          {agentesComProposta.map((a) => (
            <Link key={a} href={link({ agente: a })} className={clsx("rounded-md px-2.5 py-1 text-xs", agente === a ? "bg-painel-2 text-texto" : "text-suave hover:text-texto")}>
              {SETORES[a]?.setor ?? a}
            </Link>
          ))}
        </div>
      )}
      {lista.length ? (
        <div className="space-y-3">
          {lista.map((p) => <CartaoProposta key={p.id} p={p} contato={contatoDe(contatos, p.alvo)} aberta={status === "pendente" && p.prioridade === "alta"} />)}
        </div>
      ) : (
        <Vazio>{status === "pendente" ? "Fila limpa. Converse com um agente ou rode a rodada do dia." : "Nada nesta aba."}</Vazio>
      )}
    </Pagina>
  );
}
