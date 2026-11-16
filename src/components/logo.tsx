/** Símbolo F da Forja, o mesmo vetor do menu do Forja OS (shim.js). */
export function SimboloForja({ claro = true, className }: { claro?: boolean; className?: string }) {
  return (
    <svg viewBox="404 353 563 553" aria-hidden="true" className={className}>
      <polygon points="404,353 837,353 837,469 544,469 544,565 749,565 749,678 544,678 544,847 485,906 404,839" fill={claro ? "#F0EFEC" : "#14100E"} />
      <polygon points="967,514 853,514 794,593 794,639 873,639" fill="#F2541B" />
    </svg>
  );
}

export function LogoForja({ sub, claro = true }: { sub?: string; claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] border p-1.5 ${claro ? "border-white/10 bg-ferro-2" : "border-linha bg-white shadow-cartao"}`}>
        <SimboloForja claro={claro} className="h-full w-full" />
      </span>
      <span className="leading-tight">
        <span className={`block text-sm font-bold tracking-[0.02em] ${claro ? "text-[#f4f2ee]" : "text-texto"}`}>FORJA</span>
        {sub && <span className={`block text-[11.5px] font-medium ${claro ? "text-ferro-apagado" : "text-suave"}`}>{sub}</span>}
      </span>
    </span>
  );
}
