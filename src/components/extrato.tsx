"use client";
import { useActionState, useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { importarExtrato, lancarManual, mudarCategoria, salvarExtrato, salvarParametros, type LinhaImportada } from "@/app/acoes";
import { CATEGORIAS } from "@/lib/financeiro";
import { Modal } from "./formularios";
import { classeBotao } from "./ui";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const campo = "campo text-base md:text-sm";
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function SelectCategoria({ valor, onChange, disabled }: { valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select value={valor} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${campo} !py-1.5 text-sm`}>
      {CATEGORIAS.map((c) => <option key={c.k} value={c.k}>{c.t}</option>)}
    </select>
  );
}

export function ImportarExtrato({ variante = "primario" }: { variante?: "primario" | "secundario" }) {
  return (
    <Modal rotulo="Importar extrato" titulo="Importar extrato do banco" variante={variante}>
      {(fechar) => <FluxoExtrato fechar={fechar} />}
    </Modal>
  );
}

function FluxoExtrato({ fechar }: { fechar: () => void }) {
  const [arq, setArq] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [saldo, setSaldo] = useState<{ v?: number; d?: string }>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pend, iniciar] = useTransition();

  function ler() {
    if (!arq) return setMsg({ ok: false, t: "Escolha o arquivo." });
    iniciar(async () => {
      const f = new FormData();
      f.set("arquivo", arq);
      const r = await importarExtrato(f).catch((e) => ({ ok: false, msg: String(e), linhas: [] as LinhaImportada[] }));
      setMsg({ ok: r.ok, t: r.msg });
      if (r.ok) {
        setLinhas(r.linhas);
        setSaldo({ v: "saldo" in r ? r.saldo : undefined, d: "saldoData" in r ? r.saldoData : undefined });
      }
    });
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarExtrato(linhas!, saldo.v, saldo.d);
      setMsg({ ok: r.ok, t: r.msg });
      if (r.ok) setTimeout(fechar, 1200);
    });
  }

  if (!linhas)
    return (
      <div className="space-y-3">
        <p className="text-sm text-suave">No app do banco, exporte o extrato do mês em <b>OFX</b> (melhor) ou <b>CSV</b>. A IA separa cada linha por categoria e você só confere.</p>
        <label className={`${classeBotao("secundario")} w-full !py-4`}>
          <FileUp size={18} /> {arq ? arq.name : "Escolher arquivo"}
          <input type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx" className="sr-only" onChange={(e) => setArq(e.target.files?.[0] ?? null)} />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm ${msg?.ok ? "text-ok" : "text-critico"}`}>{msg?.t}</span>
          <button type="button" onClick={ler} disabled={pend} className={classeBotao()}>
            {pend ? <><Loader2 size={16} className="animate-spin" /> Lendo…</> : "Ler extrato"}
          </button>
        </div>
      </div>
    );

  const entradas = linhas.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const saidas = -linhas.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0);
  const duvidas = linhas.filter((l) => l.confianca < 0.7 || l.categoria === "a_classificar").length;
  const ordenadas = [...linhas].sort((a, b) => a.confianca - b.confianca);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-[10px] bg-[rgba(20,16,14,0.04)] p-2">Entradas<div className="num text-sm font-bold">{BRL.format(entradas)}</div></div>
        <div className="rounded-[10px] bg-[rgba(20,16,14,0.04)] p-2">Saídas<div className="num text-sm font-bold">{BRL.format(saidas)}</div></div>
        <div className="rounded-[10px] bg-[#fbf3ee] p-2 text-brasa-escuro">Conferir<div className="num text-sm font-bold">{duvidas}</div></div>
      </div>
      <p className="text-xs text-suave">As dúvidas aparecem primeiro. Troque a categoria se estiver errada.</p>
      <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto">
        {ordenadas.map((l) => (
          <li key={l.ref} className={`rounded-[10px] border p-2 ${l.confianca < 0.7 || l.categoria === "a_classificar" ? "border-brasa" : "border-linha"}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate"><span className="text-apagado">{dm(l.data)}</span> {l.descricao}</span>
              <span className={`num shrink-0 font-semibold ${l.valor > 0 ? "text-ok" : ""}`}>{BRL.format(l.valor)}</span>
            </div>
            <div className="mt-1.5">
              <SelectCategoria valor={l.categoria} onChange={(v) => setLinhas((ls) => ls!.map((x) => (x.ref === l.ref ? { ...x, categoria: v, confianca: 1 } : x)))} />
            </div>
          </li>
        ))}
      </ul>
      {saldo.v != null && <p className="text-xs text-suave">Saldo do banco no arquivo: <b className="num">{BRL.format(saldo.v)}</b> em {saldo.d && dm(saldo.d)}.</p>}
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm ${msg?.ok ? "text-ok" : "text-critico"}`}>{msg?.t}</span>
        <button type="button" onClick={salvar} disabled={pend} className={classeBotao()}>{pend ? "Salvando…" : "Salvar"}</button>
      </div>
    </div>
  );
}

/** Lançamento à mão: despesa paga em dinheiro ou fora do extrato. */
export function LancarDespesa({ variante = "secundario" }: { variante?: "primario" | "secundario" }) {
  const [estado, acao, pend] = useActionState(lancarManual, null);
  return (
    <Modal rotulo="Lançar despesa" titulo="Lançar à mão" variante={variante}>
      {() => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <label className="col-span-2 space-y-1"><span className="text-xs text-suave">Descrição</span><input name="descricao" required className={campo} placeholder="ex.: Uber até o Caboclo" /></label>
          <label className="space-y-1"><span className="text-xs text-suave">Valor (R$)</span><input name="valor" required inputMode="decimal" className={campo} /></label>
          <label className="space-y-1"><span className="text-xs text-suave">Data</span><input name="data" type="date" className={campo} /></label>
          <label className="space-y-1"><span className="text-xs text-suave">Tipo</span><select name="tipo" className={campo}><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label>
          <label className="space-y-1"><span className="text-xs text-suave">Categoria</span><select name="categoria" className={campo}>{CATEGORIAS.map((c) => <option key={c.k} value={c.k}>{c.t}</option>)}</select></label>
          <div className="col-span-2 flex items-center justify-between gap-3">
            <span className={`text-sm ${estado?.ok ? "text-ok" : "text-critico"}`}>{estado?.msg}</span>
            <button disabled={pend} className={classeBotao()}>{pend ? "Salvando…" : "Lançar"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function TrocarCategoria({ id, categoria }: { id: number; categoria: string }) {
  const [pend, iniciar] = useTransition();
  return <SelectCategoria valor={categoria} disabled={pend} onChange={(v) => iniciar(() => mudarCategoria(id, v))} />;
}

export function Parametros({ aliquota, saldo, saldoData }: { aliquota: number; saldo: number | null; saldoData: string | null }) {
  const [estado, acao, pend] = useActionState(salvarParametros, null);
  return (
    <Modal rotulo="Ajustes" titulo="Ajustes do financeiro" variante="secundario" icone={false}>
      {() => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <label className="col-span-2 space-y-1">
            <span className="text-xs text-suave">Alíquota do Simples (%) — usada só quando o DAS do mês ainda não foi pago</span>
            <input name="aliquota_simples" defaultValue={String((aliquota * 100).toLocaleString("pt-BR"))} inputMode="decimal" className={campo} />
          </label>
          <label className="space-y-1"><span className="text-xs text-suave">Saldo no banco (R$)</span><input name="saldo_banco" defaultValue={saldo ?? ""} inputMode="decimal" className={campo} /></label>
          <label className="space-y-1"><span className="text-xs text-suave">Em que dia</span><input name="saldo_banco_data" type="date" defaultValue={saldoData ?? ""} className={campo} /></label>
          <p className="col-span-2 text-xs text-suave">O saldo vem sozinho quando o extrato é OFX. Pergunte ao contador sua alíquota efetiva (consultoria costuma ficar entre 6% e 15,5%, conforme o Fator R).</p>
          <div className="col-span-2 flex items-center justify-between gap-3">
            <span className={`text-sm ${estado?.ok ? "text-ok" : "text-critico"}`}>{estado?.msg}</span>
            <button disabled={pend} className={classeBotao()}>{pend ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
