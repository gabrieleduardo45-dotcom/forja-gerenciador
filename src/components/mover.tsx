"use client";
import { useTransition } from "react";
import { moverProspect } from "@/app/acoes";
import { ESTAGIOS } from "@/lib/formato";

export function MoverEstagio({ id, estagio }: { id: number; estagio: string }) {
  const [pend, iniciar] = useTransition();
  return (
    <select
      aria-label="Mover estágio"
      disabled={pend}
      defaultValue={estagio}
      onChange={(e) => iniciar(() => moverProspect(id, e.target.value))}
      className="max-w-[11rem] rounded border border-linha bg-painel-2 px-1.5 py-1 text-xs text-texto disabled:opacity-50"
    >
      {ESTAGIOS.map((s) => <option key={s.k} value={s.k}>{s.t}</option>)}
    </select>
  );
}
