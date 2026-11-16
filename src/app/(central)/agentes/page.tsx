import Link from "next/link";
import { AlternarAgente } from "@/components/alternar";
import { Icone } from "@/components/icone";
import { BotaoRodar } from "@/components/rodar";
import { Pagina, Selo } from "@/components/ui";
import { SETORES } from "@/lib/agentes";
import { dataHora } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Agentes" };

export default async function Agentes() {
  const { sb } = await usuarioAtual();
  const [{ data: agentes }, { data: resumo }] = await Promise.all([
    sb.from("agentes").select("*"),
    sb.from("v_propostas_resumo").select("*"),
  ]);
  const r = new Map((resumo ?? []).map((x) => [x.codigo, x]));
  const lista = (agentes ?? []).filter((a) => SETORES[a.codigo]).sort((a, b) => Number(a.codigo.slice(1)) - Number(b.codigo.slice(1)));
  const ativos = lista.filter((a) => a.ativo).length;

  return (
    <Pagina
      titulo="Agentes"
      sub={`Um agente por setor. ${ativos} de ${lista.length} participam da rodada do dia; todos estão disponíveis para conversa.`}
      acoes={<BotaoRodar />}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((a) => {
          const s = SETORES[a.codigo];
          const x = r.get(a.codigo);
          return (
            <Link key={a.codigo} href={`/agentes/${a.codigo}`} className="group flex flex-col rounded-cartao border border-linha bg-painel shadow-cartao p-4 transition-colors hover:border-brasa/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-painel-2 text-brasa">
                    <Icone nome={s.icone} size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-suave">{s.setor} · {a.codigo}</div>
                    <div className="font-medium leading-tight">{a.nome}</div>
                  </div>
                </div>
                <AlternarAgente codigo={a.codigo} ativo={a.ativo} />
              </div>
              <p className="mt-3 flex-1 text-sm text-suave">{a.descricao}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {x?.pendentes > 0 && <Selo tom="brasa">{x.pendentes} pendentes</Selo>}
                {x?.aprovadas > 0 && <Selo tom="ok">{x.aprovadas} a fazer</Selo>}
                {x?.feitas > 0 && <Selo>{x.feitas} feitas</Selo>}
                <span className="ml-auto text-apagado">{x?.ultima ? `última ${dataHora(x.ultima)}` : "sem propostas"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Pagina>
  );
}
