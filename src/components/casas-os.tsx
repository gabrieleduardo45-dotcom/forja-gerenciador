import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Cartao, Selo, Vazio } from "@/components/ui";
import { data, pct } from "@/lib/formato";
import { ehDemo, emPct, type CasaOS, type ResultadoOS } from "@/lib/forja-os";
import type { Ligada, PrecoPlano } from "@/lib/tipos-contrato";
import { ContratoCasa } from "./contrato-casa";
import { MetaCasa } from "./meta-casa";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TOM = { ok: "ok", at: "atencao", cr: "critico" } as const;
const PALAVRA = { ok: "no alvo", at: "atenção", cr: "crítico" } as const;

/** Casa onde o Gabriel é sócio: aparece primeiro, com tarja laranja. */
export const ehSocio = (c: Pick<CasaOS, "nome">) => /\bcaboclo\b/i.test(c.nome.normalize("NFD").replace(/[̀-ͯ]/g, ""));

type Props = { r: ResultadoOS; compacto?: boolean; precos?: PrecoPlano[]; ligadas?: Map<string, Ligada>; cadastradas?: Set<string> };

/**
 * Casas do FORJA OS na ordem do dia a dia: 1) a casa sócia (Caboclo), 2) a demonstração,
 * 3) as consultorias (casas cadastradas na Gestão). As que existem no FORJA OS mas não têm
 * cadastro aqui ficam recolhidas no fim, com o botão para cadastrar.
 */
export function CasasForjaOS({ r, compacto = false, precos = [], ligadas = new Map(), cadastradas = new Set() }: Props) {
  const titulo = "Casas";
  const acao = <span className="text-xs text-suave">{r.ok && r.gerado ? `FORJA OS ao vivo · ${data(r.gerado)}` : "FORJA OS ao vivo"}</span>;
  if (!r.ok) return <Cartao titulo={titulo} acao={acao}><Vazio>Não consegui ler o FORJA OS agora: {r.erro}</Vazio></Cartao>;

  const socias = r.casas.filter(ehSocio);
  const demos = r.casas.filter((c) => ehDemo(c) && !ehSocio(c));
  const resto = r.casas.filter((c) => !ehSocio(c) && !ehDemo(c));
  const consultorias = resto.filter((c) => cadastradas.has(c.id) || ligadas.has(c.id));
  const outras = resto.filter((c) => !cadastradas.has(c.id) && !ligadas.has(c.id));

  const linha = (c: CasaOS, marca?: ReactNode, destaque?: boolean) => (
    <Linha key={c.id} c={c} marca={marca} destaque={destaque} compacto={compacto} contrato={situacao(c, ligadas, precos)} />
  );

  return (
    <Cartao titulo={titulo} acao={acao}>
      <div className="space-y-2.5">
        {socias.map((c) => linha(c, <Selo tom="brasa">sócio</Selo>, true))}
        {demos.map((c) => linha(c, <Selo tom="info">demonstração</Selo>))}
      </div>
      {consultorias.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-semibold text-suave">Consultorias · {consultorias.length}</h3>
          <div className="space-y-2.5">{consultorias.map((c) => linha(c))}</div>
        </>
      )}
      {!socias.length && !demos.length && !consultorias.length && <Vazio>Nenhuma casa cadastrada ainda.</Vazio>}
      {outras.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-suave">No FORJA OS, mas sem cadastro aqui ({outras.length})</summary>
          <ul className="mt-2 divide-y divide-[rgba(20,16,14,0.06)]">
            {outras.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">{c.nome}</span>
                <ContratoCasa casa={{ nome: c.nome, osId: c.id }} precos={precos} rotulo="Cadastrar como cliente" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Cartao>
  );
}

function situacao(c: CasaOS, ligadas: Map<string, Ligada>, precos: PrecoPlano[]) {
  if (ehDemo(c)) return null;
  const l = ligadas.get(c.id);
  return l?.contrato ? (
    <span className="text-xs text-suave">{l.contrato}{l.valor ? ` · ${BRL.format(l.valor)}${l.mensal ? "/mês" : ""}` : ""}</span>
  ) : (
    <ContratoCasa casa={{ nome: c.nome, osId: c.id }} precos={precos} />
  );
}

function Linha({ c, marca, destaque, compacto, contrato }: { c: CasaOS; marca?: ReactNode; destaque?: boolean; compacto: boolean; contrato: ReactNode }) {
  const k = (c.estado in TOM ? c.estado : "ok") as keyof typeof TOM;
  const cmv = emPct(c.atual?.cmv);
  const alvo = emPct(c.metas_vigentes?.meta_cmv ?? c.metaCmv);
  const margem = emPct(c.atual?.margem);
  const vencido = c.vencido ?? c.atual?.vencido;
  const p7 = c.pagar_7d ?? c.atual?.pagar_7d;
  return (
    <article className={clsx("rounded-[12px] border p-3", destaque ? "border-brasa border-l-[6px] bg-[#fffaf7]" : "border-linha bg-painel")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold">{c.nome}</span>
          {marca}
          <Selo tom={TOM[k]}>{PALAVRA[k]}</Selo>
        </div>
        {contrato}
      </div>
      <div className={clsx("mt-2 grid gap-x-4 gap-y-1.5 text-sm", compacto ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")}>
        <Dado t="CMV / alvo">
          <span className={clsx(cmv != null && alvo != null && cmv > alvo ? "text-critico" : "text-ok")}>{pct(cmv?.toFixed(1))}</span>
          <span className="text-apagado"> / {pct(alvo?.toFixed(0))}</span>
        </Dado>
        <Dado t="Checklist">{pct(emPct(c.atual?.chk)?.toFixed(0))}</Dado>
        <Dado t="Margem">{margem != null ? pct(margem.toFixed(1)) : "—"}</Dado>
        {!compacto && (
          <>
            <Dado t="Uso da equipe">{pct(emPct(c.atual?.uso)?.toFixed(0))}</Dado>
            <Dado t="Venda semana">{c.faturamento_semana != null ? BRL.format(c.faturamento_semana) : "—"}</Dado>
            <Dado t="Contas">{vencido ? <span className="text-critico">vencido {BRL.format(Number(vencido))}</span> : p7 ? `7 dias ${BRL.format(Number(p7))}` : "—"}</Dado>
          </>
        )}
      </div>
      {!compacto && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
          <span>{c.alertas_vigia?.length ? <span className="text-atencao">{c.alertas_vigia.length} alerta(s) do vigia · </span> : null}última visita {data(c.ultimaVisita)}</span>
          {!ehDemo(c) && <MetaCasa casa={{ id: c.id, nome: c.nome }} cmvAtual={c.metas_vigentes?.meta_cmv ?? c.metaCmv} limiteAtual={c.metas_vigentes?.limite_semanal_pagamentos ?? c.limite_semanal} />}
        </div>
      )}
    </article>
  );
}

function Dado({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-apagado">{t}</div>
      <div className="num">{children}</div>
    </div>
  );
}
