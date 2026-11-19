import { Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { data, pct } from "@/lib/formato";
import { emPct, type ResultadoOS } from "@/lib/forja-os";

const TOM = { ok: "ok", at: "atencao", cr: "critico" } as const;
const PALAVRA = { ok: "no alvo", at: "atenção", cr: "crítico" } as const;

function estado(e: string) {
  const k = (e in TOM ? e : "ok") as keyof typeof TOM;
  return <Selo tom={TOM[k]}>{e in PALAVRA ? PALAVRA[k] : e}</Selo>;
}

/** Casas lidas ao vivo do FORJA OS (só leitura). */
export function CasasForjaOS({ r, compacto = false }: { r: ResultadoOS; compacto?: boolean }) {
  const titulo = "Casas no FORJA OS";
  const acao = <span className="text-xs text-suave">{r.ok && r.gerado ? `ao vivo · ${data(r.gerado)}` : "ao vivo"}</span>;
  if (!r.ok) return <Cartao titulo={titulo} acao={acao}><Vazio>Não consegui ler o FORJA OS agora: {r.erro}</Vazio></Cartao>;

  if (compacto) {
    const n = { ok: 0, at: 0, cr: 0 } as Record<string, number>;
    r.casas.forEach((c) => (n[c.estado] = (n[c.estado] ?? 0) + 1));
    const piores = r.casas.filter((c) => c.estado === "cr" || c.estado === "at").slice(0, 4);
    return (
      <Cartao titulo={titulo} acao={acao}>
        <div className="flex flex-wrap gap-2">
          <Selo tom="ok">{n.ok} no alvo</Selo>
          <Selo tom="atencao">{n.at} atenção</Selo>
          <Selo tom="critico">{n.cr} crítico</Selo>
        </div>
        {piores.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {piores.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{c.nome}</span>
                <span className="num text-suave">CMV {pct(emPct(c.atual?.cmv))} / {pct(emPct(c.metaCmv))}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    );
  }

  return (
    <Cartao titulo={titulo} acao={acao}>
      <Tabela
        linhas={r.casas}
        vazio="Nenhuma casa no FORJA OS ainda."
        colunas={[
          { k: "nome", t: "Casa", r: (c) => (<div><div className="font-medium">{c.nome}</div>{(c.sub || c.cidade) && <div className="text-xs text-suave">{[c.sub, c.cidade].filter(Boolean).join(" · ")}</div>}</div>) },
          { k: "estado", t: "Estado", r: (c) => estado(c.estado) },
          { k: "cmv", t: "CMV / alvo", cls: "num", r: (c) => { const a = emPct(c.atual?.cmv), m = emPct(c.metaCmv); return a == null ? "—" : <span className={m != null && a > m ? "text-critico" : "text-ok"}>{pct(a)} <span className="text-apagado">/ {pct(m)}</span></span>; } },
          { k: "chk", t: "Checklist", cls: "num", r: (c) => pct(emPct(c.atual?.chk)) },
          { k: "uso", t: "Uso equipe", cls: "num", r: (c) => pct(emPct(c.atual?.uso)) },
          { k: "vencido", t: "Vencido", cls: "num", r: (c) => (c.atual?.vencido ? <span className="text-critico">{c.atual.vencido}</span> : "—") },
          { k: "ultimaVisita", t: "Última visita", r: (c) => data(c.ultimaVisita) },
        ]}
      />
    </Cartao>
  );
}
