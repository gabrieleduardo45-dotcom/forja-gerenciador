import Link from "next/link";
import { clsx } from "clsx";

export function AbasNumeros({ ativa }: { ativa: "financeiro" | "vendas" }) {
  const aba = (k: string, href: string, t: string) => (
    <Link href={href} className={clsx("rounded-[9px] px-4 py-2 text-sm font-semibold", ativa === k ? "bg-white text-texto shadow-[0_1px_2px_rgba(20,16,14,0.12)]" : "text-suave")}>{t}</Link>
  );
  return (
    <div className="inline-flex gap-0.5 rounded-[12px] bg-[rgba(20,16,14,0.05)] p-1">
      {aba("financeiro", "/numeros", "Financeiro")}
      {aba("vendas", "/painel", "Vendas e funil")}
    </div>
  );
}
