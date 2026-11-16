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
      className="campo max-w-[11rem] !py-1 !pl-2 text-xs disabled:opacity-50"
    >
      {ESTAGIOS.map((s) => <option key={s.k} value={s.k}>{s.t}</option>)}
    </select>
  );
}
