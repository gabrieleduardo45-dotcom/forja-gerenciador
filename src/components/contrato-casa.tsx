"use client";
import { useActionState, useEffect, useState } from "react";
import { fecharContratoCasa } from "@/app/acoes";
import { Modal } from "./formularios";
import { classeBotao } from "./ui";

import type { PrecoPlano } from "@/lib/tipos-contrato";
export type { PrecoPlano };
const campo = "campo text-base md:text-sm";
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Fechar contrato de uma casa: plano da tabela ou personalizado, único ou mensal, e se já recebeu. */
export function ContratoCasa({ casa, precos, rotulo = "Fechar contrato", classe }: { casa: { nome: string; osId?: string | null; id?: number | null }; precos: PrecoPlano[]; rotulo?: string; classe?: string }) {
  return (
    <Modal rotulo={rotulo} titulo={casa.nome} variante="secundario" classe={classe ?? "!px-2.5 !py-1.5 !text-xs"}>
      {(fechar) => <Form casa={casa} precos={precos} fechar={fechar} />}
    </Modal>
  );
}

function Form({ casa, precos, fechar }: { casa: { nome: string; osId?: string | null; id?: number | null }; precos: PrecoPlano[]; fechar: () => void }) {
  const [estado, acao, pend] = useActionState(fecharContratoCasa, null);
  const [plano, setPlano] = useState("personalizado");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"unico" | "mensal">("mensal");
  const [recebido, setRecebido] = useState(true);
  useEffect(() => {
    if (!estado?.ok) return;
    const t = setTimeout(fechar, 1200);
    return () => clearTimeout(t);
  }, [estado, fechar]);

  function escolher(p: string) {
    setPlano(p);
    const x = precos.find((y) => y.produto === p);
    if (x) {
      const v = x.fundadora ?? x.cheia;
      if (v != null) setValor(String(v).replace(".", ","));
      setTipo(x.unidade === "mes" ? "mensal" : "unico");
    }
  }

  return (
    <form action={acao} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="casa_nome" value={casa.nome} />
      {casa.osId && <input type="hidden" name="casa_os_id" value={casa.osId} />}
      {casa.id && <input type="hidden" name="casa_id" value={casa.id} />}
      <label className="col-span-2 space-y-1">
        <span className="text-xs text-suave">Plano</span>
        <select name="plano" value={plano} onChange={(e) => escolher(e.target.value)} className={campo}>
          <option value="personalizado">Personalizado (eu defino)</option>
          {precos.filter((p) => (p.fundadora ?? p.cheia ?? 0) > 0 || p.fundadora == null).map((p) => (
            <option key={p.produto} value={p.produto}>{p.produto}{p.fundadora != null ? ` · ${BRL.format(p.fundadora)}${p.unidade === "mes" ? "/mês" : ""}` : ""}</option>
          ))}
        </select>
      </label>
      {plano === "personalizado" && (
        <label className="col-span-2 space-y-1">
          <span className="text-xs text-suave">Nome do plano</span>
          <input name="plano_nome" required placeholder="ex.: Consultoria Caboclo 2 visitas" className={campo} />
        </label>
      )}
      <label className="space-y-1">
        <span className="text-xs text-suave">Valor (R$)</span>
        <input name="valor" required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={campo} placeholder="0,00" />
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs text-suave">Cobrança</legend>
        <div className="grid grid-cols-2 gap-1">
          {(["mensal", "unico"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)} className={`rounded-[10px] border px-2 py-2 text-sm font-semibold ${tipo === t ? "border-brasa bg-[#fbf3ee] text-brasa-escuro" : "border-linha text-suave"}`}>
              {t === "mensal" ? "Mensal" : "Única"}
            </button>
          ))}
        </div>
        <input type="hidden" name="tipo" value={tipo} />
      </fieldset>
      {tipo === "mensal" && (
        <label className="space-y-1"><span className="text-xs text-suave">Por quantos meses</span><input name="meses" type="number" min={1} placeholder="sem prazo" className={campo} /></label>
      )}
      <label className="space-y-1"><span className="text-xs text-suave">Início</span><input name="inicio" type="date" className={campo} /></label>
      <label className="space-y-1">
        <span className="text-xs text-suave">Forma</span>
        <select name="forma" className={campo}><option value="pix">Pix</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select>
      </label>
      <label className="col-span-2 flex items-center gap-2 rounded-[10px] border border-linha px-3 py-2.5 text-sm">
        <input type="checkbox" name="recebido" checked={recebido} onChange={(e) => setRecebido(e.target.checked)} className="h-4 w-4 accent-[#ec4e14]" />
        Já recebi {tipo === "mensal" ? "a primeira mensalidade" : "o pagamento"}
        {recebido && <input name="data_recebido" type="date" className="campo ml-auto !w-auto !py-1 text-sm" />}
      </label>
      <div className="col-span-2 flex items-center justify-between gap-3">
        <span className={`text-sm ${estado?.ok ? "text-ok" : "text-critico"}`}>{estado?.msg}</span>
        <button disabled={pend} className={classeBotao()}>{pend ? "Salvando…" : "Salvar contrato"}</button>
      </div>
    </form>
  );
}
