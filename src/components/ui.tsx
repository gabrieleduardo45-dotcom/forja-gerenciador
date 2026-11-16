import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Pagina({ titulo, sub, acoes, children }: { titulo: string; sub?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {sub && <p className="mt-1 text-sm text-suave">{sub}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Cartao({ titulo, acao, children, className }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-lg border border-linha bg-painel", className)}>
      {titulo && (
        <div className="flex items-center justify-between gap-2 border-b border-linha px-4 py-3">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {acao}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: "ok" | "atencao" | "critico" | "brasa" }) {
  return (
    <div className="rounded-lg border border-linha bg-painel p-4">
      <div className="text-xs uppercase tracking-wide text-suave">{rotulo}</div>
      <div
        className={clsx(
          "num mt-1 text-2xl font-semibold",
          tom === "ok" && "text-ok",
          tom === "atencao" && "text-atencao",
          tom === "critico" && "text-critico",
          tom === "brasa" && "text-brasa",
        )}
      >
        {valor}
      </div>
      {sub && <div className="mt-1 text-xs text-suave">{sub}</div>}
    </div>
  );
}

export function Selo({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "ok" | "atencao" | "critico" | "brasa" | "info" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium",
        tom === "neutro" && "bg-painel-2 text-suave",
        tom === "ok" && "bg-ok/15 text-ok",
        tom === "atencao" && "bg-atencao/15 text-atencao",
        tom === "critico" && "bg-critico/15 text-critico",
        tom === "brasa" && "bg-brasa/15 text-brasa",
        tom === "info" && "bg-info/15 text-info",
      )}
    >
      {children}
    </span>
  );
}

export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-linha px-4 py-6 text-center text-sm text-suave">
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
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa",
    variante === "primario" && "bg-brasa text-sobre-brasa hover:bg-[#ff6a33]",
    variante === "secundario" && "border border-linha bg-painel-2 text-texto hover:border-suave",
    variante === "fantasma" && "text-suave hover:bg-painel-2 hover:text-texto",
    variante === "perigo" && "text-critico hover:bg-critico/10",
  );
}

export type Coluna<T> = { k: string; t: string; r?: (l: T) => ReactNode; cls?: string };

export function Tabela<T extends Record<string, unknown>>({ linhas, colunas, vazio }: { linhas: T[]; colunas: Coluna<T>[]; vazio?: ReactNode }) {
  if (!linhas.length) return <Vazio>{vazio ?? "Nada por aqui ainda."}</Vazio>;
  return (
    <div className="rolagem-fina -mx-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-linha text-left text-xs uppercase tracking-wide text-suave">
            {colunas.map((c) => (
              <th key={c.k} className={clsx("px-4 py-2 font-medium", c.cls)}>{c.t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-linha/60 last:border-0 hover:bg-painel-2/60">
              {colunas.map((c) => (
                <td key={c.k} className={clsx("px-4 py-2 align-top", c.cls)}>
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-painel-2">
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
