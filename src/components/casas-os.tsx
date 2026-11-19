import { Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { data, pct } from "@/lib/formato";
import { emPct, type ResultadoOS } from "@/lib/forja-os";
import type { Ligada, PrecoPlano } from "@/lib/tipos-contrato";
import { ContratoCasa } from "./contrato-casa";
import { MetaCasa } from "./meta-casa";
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const TOM = { ok: "ok", at: "atencao", cr: "critico" } as const;
const PALAVRA = { ok: "no alvo", at: "atenção", cr: "crítico" } as const;

function estado(e: string) {
  const k = (e in TOM ? e : "ok") as keyof typeof TOM;
  return <Selo tom={TOM[k]}>{e in PALAVRA ? PALAVRA[k] : e}</Selo>;
}

/** Casas lidas ao vivo do FORJA OS (só leitura). */
export function CasasForjaOS({ r, compacto = false, precos = [], ligadas = new Map() }: { r: ResultadoOS; compacto?: boolean; precos?: PrecoPlano[]; ligadas?: Map<string, Ligada> }) {
  const situacao = (id: string, nome: string) => {
    const l = ligadas.get(id);
    return l?.contrato ? (
      <span className="text-xs text-suave">{l.contrato}{l.valor ? ` · ${BRL.format(l.valor)}${l.mensal ? "/mês" : ""}` : ""}</span>
    ) : (
      <ContratoCasa casa={{ nome, osId: id }} precos={precos} />
    );
  };
  const titulo = "Casas no FORJA OS";
  const acao = <span className="text-xs text-suave">{r.ok && r.gerado ? `ao vivo · ${data(r.gerado)}` : "ao vivo"}</span>;
  if (!r.ok) return <Cartao titulo={titulo} acao={acao}><Vazio>Não consegui ler o FORJA OS agora: {r.erro}</Vazio></Cartao>;

  if (compacto) {
    const n = { ok: 0, at: 0, cr: 0 } as Record<string, number>;
    r.casas.forEach((c) => (n[c.estado] = (n[c.estado] ?? 0) + 1));
    return (
      <Cartao titulo={titulo} acao={acao}>
        <div className="flex flex-wrap gap-2">
          <Selo tom="ok">{n.ok} no alvo</Selo>
          <Selo tom="atencao">{n.at} atenção</Selo>
          <Selo tom="critico">{n.cr} crítico</Selo>
        </div>
        <ul className="mt-3 divide-y divide-[rgba(20,16,14,0.06)] text-sm">
          {r.casas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.nome}</span>
                <span className="num text-xs text-suave">CMV {pct(emPct(c.atual?.cmv))} / alvo {pct(emPct(c.metas_vigentes?.meta_cmv ?? c.metaCmv))}{c.alertas_vigia?.length ? ` · ${c.alertas_vigia.length} alerta(s)` : ""}</span>
              </span>
              <span className="shrink-0">{situacao(c.id, c.nome)}</span>
            </li>
          ))}
        </ul>
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
          { k: "cmv", t: "CMV / alvo", cls: "num", r: (c) => { const a = emPct(c.atual?.cmv), m = emPct(c.metas_vigentes?.meta_cmv ?? c.metaCmv); return (<span className="inline-flex items-center gap-1">{a == null ? "—" : <span className={m != null && a > m ? "text-critico" : "text-ok"}>{pct(a)} <span className="text-apagado">/ {pct(m)}</span></span>}<MetaCasa casa={{ id: c.id, nome: c.nome }} cmvAtual={c.metas_vigentes?.meta_cmv ?? c.metaCmv} limiteAtual={c.metas_vigentes?.limite_semanal_pagamentos ?? c.limite_semanal} /></span>); } },
          { k: "chk", t: "Checklist", cls: "num", r: (c) => pct(emPct(c.atual?.chk)) },
          { k: "uso", t: "Uso equipe", cls: "num", r: (c) => pct(emPct(c.atual?.uso)) },
          { k: "vencido", t: "Contas", cls: "num", r: (c) => { const v = c.vencido ?? c.atual?.vencido; const p7 = c.pagar_7d ?? c.atual?.pagar_7d; return (<div className="text-xs">{v ? <div className="text-critico">vencido {BRL.format(Number(v))}</div> : null}{p7 ? <div className="text-suave">7 dias {BRL.format(Number(p7))}</div> : null}{!v && !p7 ? "—" : null}</div>); } },
          { k: "fat", t: "Venda semana", cls: "num", r: (c) => (c.faturamento_semana != null ? BRL.format(c.faturamento_semana) : "—") },
          { k: "ultimaVisita", t: "Última visita", r: (c) => data(c.ultimaVisita) },
          { k: "contrato", t: "Contrato", r: (c) => situacao(c.id, c.nome) },
        ]}
      />
    </Cartao>
  );
}
