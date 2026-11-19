import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";

/* Componentes no padrão FORJA OS v.02 (acabamento SaaS): superfície branca, borda fina, sombra curta,
   cantos 14 px, rótulos em frase (sem caixa alta), estado sempre com palavra. */

export function Pagina({ titulo, sub, acoes, children }: { titulo: string; sub?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="entra mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em]">{titulo}</h1>
          {sub && <p className="mt-1 text-[15px] text-suave">{sub}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Cartao({ titulo, acao, children, className }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("min-w-0 rounded-cartao border border-linha bg-painel shadow-cartao", className)}>
      {titulo && (
        <div className="flex items-center justify-between gap-2 px-5 pb-1 pt-4">
          <h2 className="text-base font-[650] tracking-[-0.01em]">{titulo}</h2>
          {acao}
        </div>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: "ok" | "atencao" | "critico" | "brasa" }) {
  const fora = tom === "critico" || tom === "atencao";
  return (
    <div className={clsx("rounded-cartao border bg-painel p-4 shadow-cartao", fora ? "border-brasa" : "border-linha")}>
      <div className="text-[13px] font-medium text-suave">{rotulo}</div>
      <div
        className={clsx(
          "num mt-1.5 text-[28px] font-bold leading-tight tracking-[-0.035em]",
          tom === "atencao" && "text-atencao",
          tom === "critico" && "text-critico",
          tom === "brasa" && "text-brasa-escuro",
        )}
      >
        {valor}
      </div>
      {sub && <div className="mt-1 text-[12.5px] text-apagado">{sub}</div>}
      {tom && tom !== "brasa" && <Estado tom={tom} />}
    </div>
  );
}

/** Pílula de estado: cor + palavra, nunca só cor. */
export function Estado({ tom }: { tom: "ok" | "atencao" | "critico" }) {
  const palavra = tom === "ok" ? "no alvo" : tom === "atencao" ? "atenção" : "crítico";
  return <Selo tom={tom}>{palavra}</Selo>;
}

export function Selo({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "ok" | "atencao" | "critico" | "brasa" | "info" }) {
  return (
    <span
      className={clsx(
        "mt-0 inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tom === "neutro" && "bg-[rgba(20,16,14,0.06)] text-texto-2",
        tom === "ok" && "bg-[rgba(30,122,46,0.09)] text-ok",
        tom === "atencao" && "bg-[rgba(154,91,0,0.10)] text-atencao",
        tom === "critico" && "bg-[rgba(180,35,24,0.08)] text-critico",
        tom === "brasa" && "bg-[rgba(242,84,27,0.13)] text-brasa-escuro",
        tom === "info" && "bg-[rgba(57,135,229,0.10)] text-[#245ea6]",
      )}
    >
      {children}
    </span>
  );
}

export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="rounded-cartao border border-dashed border-linha-forte bg-[#fcfbf9] px-4 py-7 text-center text-sm text-suave">
      {children}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

export function Botao({ href, children, variante = "primario", className }: { href: string; children: ReactNode; variante?: "primario" | "secundario"; className?: string }) {
  return (
    <Link href={href} className={clsx(classeBotao(variante), className)}>
      {children}
    </Link>
  );
}

export function classeBotao(variante: "primario" | "secundario" | "fantasma" | "perigo" = "primario") {
  return clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-campo px-3.5 py-2 text-[15px] font-semibold transition-[transform,background,border-color] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none md:text-sm",
    variante === "primario" &&
      "border border-[#e04810] bg-gradient-to-b from-[#f45f2a] to-[#ec4e14] text-sobre-brasa shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(180,60,10,0.25)] hover:from-[#ff6a33] hover:to-[#f2541b]",
    variante === "secundario" && "border border-[rgba(20,16,14,0.13)] bg-white text-texto shadow-[0_1px_2px_rgba(20,16,14,0.05)] hover:border-[rgba(20,16,14,0.26)]",
    variante === "fantasma" && "text-suave hover:bg-[rgba(20,16,14,0.05)] hover:text-texto",
    variante === "perigo" && "text-critico hover:bg-critico/10",
  );
}

export type Coluna<T> = { k: string; t: string; r?: (l: T) => ReactNode; cls?: string };

export function Tabela<T extends Record<string, unknown>>({ linhas, colunas, vazio }: { linhas: T[]; colunas: Coluna<T>[]; vazio?: ReactNode }) {
  if (!linhas.length) return <Vazio>{vazio ?? "Nada por aqui ainda."}</Vazio>;
  return (
    <div className="rolagem-fina -mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-linha text-left text-[12.5px] text-apagado">
            {colunas.map((c) => (
              <th key={c.k} className={clsx("px-5 py-2 font-[550]", c.cls)}>{c.t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-[rgba(20,16,14,0.05)] last:border-0 hover:bg-[rgba(20,16,14,0.022)]">
              {colunas.map((c) => (
                <td key={c.k} className={clsx("px-5 py-2.5 align-top", c.cls)}>
                  {c.r ? c.r(l) : String(l[c.k] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Barra({ valor, max, tom = "brasa" }: { valor: number; max: number; tom?: "brasa" | "ok" | "critico" | "atencao" }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (valor / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(20,16,14,0.06)]">
      <div
        className={clsx("h-full rounded-full", tom === "brasa" && "bg-brasa", tom === "ok" && "bg-ok", tom === "critico" && "bg-critico", tom === "atencao" && "bg-atencao")}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function tomPrioridade(p?: string | null): "critico" | "atencao" | "neutro" {
  return p === "alta" ? "critico" : p === "media" ? "atencao" : "neutro";
}
