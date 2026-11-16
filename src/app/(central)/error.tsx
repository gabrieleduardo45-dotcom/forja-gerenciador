"use client";
import { classeBotao } from "@/components/ui";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-lg font-semibold">Algo deu errado nesta tela</p>
      <p className="mt-2 text-sm text-suave">{error.message || "Erro inesperado."}</p>
      <button onClick={reset} className={`${classeBotao()} mt-6`}>Tentar de novo</button>
    </div>
  );
}
