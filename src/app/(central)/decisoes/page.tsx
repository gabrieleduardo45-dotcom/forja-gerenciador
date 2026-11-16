import { registrarDecisao } from "@/app/acoes";
import { Cartao, Pagina, Selo, classeBotao } from "@/components/ui";
import { SETORES } from "@/lib/agentes";
import { data } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Decisões" };

export default async function Decisoes({ searchParams }: PageProps<"/decisoes">) {
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q.replace(/[%,()]/g, "") : "";
  const { sb } = await usuarioAtual();
  let q = sb.from("decisoes").select("*").order("data", { ascending: false }).order("id", { ascending: false }).limit(200);
  if (busca) q = q.or(`assunto.ilike.%${busca}%,decisao.ilike.%${busca}%`);
  const { data: lista } = await q;
  const campo = "campo text-base md:text-sm";

  return (
    <Pagina titulo="Decisões" sub="A memória da Forja. Todo agente lê isto antes de recomendar.">
      <Cartao titulo="Registrar decisão">
        <form action={registrarDecisao} className="grid gap-3 md:grid-cols-2">
          <input name="assunto" required placeholder="Assunto" className={campo} />
          <select name="agente" className={campo} defaultValue="">
            <option value="">Setor (opcional)</option>
            {Object.values(SETORES).map((s) => <option key={s.codigo} value={s.codigo}>{s.setor}</option>)}
          </select>
          <textarea name="decisao" required placeholder="O que foi decidido" rows={2} className={`${campo} md:col-span-2`} />
          <input name="motivo" placeholder="Por quê (opcional)" className={campo} />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-suave"><input type="checkbox" name="reversivel" defaultChecked className="accent-brasa" /> Reversível</label>
            <button className={classeBotao()}>Registrar</button>
          </div>
        </form>
      </Cartao>

      <form><input name="q" defaultValue={busca} placeholder="Buscar nas decisões…" className={campo} /></form>

      <ol className="space-y-3">
        {(lista ?? []).map((d) => (
          <li key={d.id} className="rounded-cartao border border-linha bg-painel shadow-cartao p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
              <span className="num">{data(d.data)}</span>
              {d.agente && <Selo>{SETORES[d.agente]?.setor ?? d.agente}</Selo>}
              {d.reversivel === false && <Selo tom="critico">irreversível</Selo>}
            </div>
            <h3 className="mt-1.5 font-medium">{d.assunto}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-suave">{d.decisao}</p>
            {d.motivo && <p className="mt-1.5 text-xs text-apagado">Motivo: {d.motivo}</p>}
          </li>
        ))}
      </ol>
    </Pagina>
  );
}
