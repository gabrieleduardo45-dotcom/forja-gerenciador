"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { LancarRecebimento, NovoProspect, RegistrarToque } from "./formularios";
import { SobraDescarte } from "./sobra-descarte";

/** Botão + do celular: cadastrar cliente, registrar toque ou lançar venda em poucos toques, na rua. */
export function AcoesRapidas({ prospects, produtos }: { prospects: { id: number; nome_casa: string; codigo: string }[]; produtos: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  const grande = "w-full justify-start !py-4 !text-base";
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Lançar algo novo"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full border border-[#e04810] bg-gradient-to-b from-[#f45f2a] to-[#ec4e14] text-sobre-brasa shadow-[0_8px_24px_-8px_rgba(180,60,10,0.6)] active:scale-95"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>
      <dialog
        ref={ref}
        onClose={() => setAberto(false)}
        className="mb-0 mt-auto w-full max-w-none rounded-t-[20px] border-0 bg-painel p-0 text-texto backdrop:bg-[rgba(14,13,12,0.45)]"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-[17px] font-[650]">Lançar agora</h2>
          <button type="button" onClick={() => setAberto(false)} className="grid h-11 w-11 place-items-center text-suave" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
          <NovoProspect variante="secundario" classe={grande} />
          <RegistrarToque prospects={prospects} variante="secundario" classe={grande} />
          <SobraDescarte variante="secundario" classe={grande} />
          <LancarRecebimento produtos={produtos} variante="secundario" classe={grande} />
        </div>
      </dialog>
    </div>
  );
}
