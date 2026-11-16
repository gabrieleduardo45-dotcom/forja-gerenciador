"use client";
import { useOptimistic, useTransition } from "react";
import { clsx } from "clsx";
import { alternarAgente } from "@/app/acoes";

export function AlternarAgente({ codigo, ativo }: { codigo: string; ativo: boolean }) {
  const [, iniciar] = useTransition();
  const [valor, setValor] = useOptimistic(ativo);
  return (
    <button
      role="switch"
      aria-checked={valor}
      title={valor ? "Participa da rodada do dia" : "Fora da rodada (conversa continua disponível)"}
      onClick={(e) => {
        e.preventDefault();
        iniciar(async () => {
          setValor(!valor);
          await alternarAgente(codigo, !valor);
        });
      }}
      className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", valor ? "bg-brasa" : "bg-linha")}
    >
      <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-texto transition-all", valor ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}
