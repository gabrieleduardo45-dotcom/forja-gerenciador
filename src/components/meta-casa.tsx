"use client";
import { useActionState, useEffect } from "react";
import { definirMetaCasa } from "@/app/acoes";
import { Modal } from "./formularios";
import { classeBotao } from "./ui";

const campo = "campo text-base md:text-sm";

/** Meta da casa definida pela Gestão: vale por cima das regras da casa no FORJA OS. */
export function MetaCasa({ casa, cmvAtual, limiteAtual }: { casa: { id: string; nome: string }; cmvAtual?: number | null; limiteAtual?: number | null }) {
  return (
    <Modal rotulo="Meta" titulo={`Meta · ${casa.nome}`} variante="fantasma" icone={false} classe="!px-2 !py-1 !text-xs underline">
      {(fechar) => <Form casa={casa} cmvAtual={cmvAtual} limiteAtual={limiteAtual} fechar={fechar} />}
    </Modal>
  );
}

function Form({ casa, cmvAtual, limiteAtual, fechar }: { casa: { id: string; nome: string }; cmvAtual?: number | null; limiteAtual?: number | null; fechar: () => void }) {
  const [estado, acao, pend] = useActionState(definirMetaCasa, null);
  useEffect(() => {
    if (!estado?.ok) return;
    const t = setTimeout(fechar, 1200);
    return () => clearTimeout(t);
  }, [estado, fechar]);
  return (
    <form action={acao} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="casa_id" value={casa.id} />
      <label className="space-y-1">
        <span className="text-xs text-suave">Meta de CMV (%)</span>
        <input name="meta_cmv" inputMode="decimal" defaultValue={cmvAtual != null ? String(+(cmvAtual * 100).toFixed(1)).replace(".", ",") : ""} placeholder="ex.: 32" className={campo} />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-suave">Limite de pagamentos por semana (R$)</span>
        <input name="limite" inputMode="decimal" defaultValue={limiteAtual ?? ""} placeholder="ex.: 8.000" className={campo} />
      </label>
      <label className="col-span-2 space-y-1">
        <span className="text-xs text-suave">Vale a partir de</span>
        <input name="vigente_desde" type="date" className={campo} />
      </label>
      <p className="col-span-2 text-xs text-suave">Vai direto para o FORJA OS da casa e passa a valer por cima do que a casa definiu. Fica no histórico.</p>
      <div className="col-span-2 flex items-center justify-between gap-3">
        <span className={`text-sm ${estado?.ok ? "text-ok" : "text-critico"}`}>{estado?.msg}</span>
        <button disabled={pend} className={classeBotao()}>{pend ? "Gravando…" : "Gravar meta"}</button>
      </div>
    </form>
  );
}
