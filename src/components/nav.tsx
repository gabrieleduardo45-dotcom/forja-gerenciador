"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LogoForja } from "./logo";
import { BarChart3, Bot, Building2, Gavel, Inbox, LayoutDashboard, LogOut, Megaphone, MoreHorizontal, Tag, Target, Users, Wallet } from "lucide-react";

/** Modo simples: 4 lugares. O resto fica em "Mais". */
const PRINCIPAIS = [
  { href: "/", t: "Hoje", I: LayoutDashboard },
  { href: "/clientes", t: "Clientes", I: Users },
  { href: "/casas", t: "Casas", I: Building2 },
  { href: "/numeros", t: "Números", I: BarChart3 },
  { href: "/mais", t: "Mais", I: MoreHorizontal },
];
const EXTRAS = [
  { href: "/propostas", t: "Sugestões dos agentes", I: Inbox, contador: true },
  { href: "/precos", t: "Preços", I: Tag },
  { href: "/financeiro", t: "Financeiro", I: Wallet },
  { href: "/comercial", t: "Comercial", I: Target },
  { href: "/marketing", t: "Marketing", I: Megaphone },
  { href: "/agentes", t: "Agentes", I: Bot },
  { href: "/decisoes", t: "Decisões", I: Gavel },
];
type Item = { href: string; t: string; I: typeof Inbox; contador?: boolean };

function ativo(p: string, href: string) {
  if (href === "/") return p === "/";
  if (href === "/numeros") return p.startsWith("/numeros") || p.startsWith("/painel");
  if (href === "/mais") return p.startsWith("/mais") || EXTRAS.some((e) => p.startsWith(e.href));
  return p.startsWith(href);
}

function iniciais(email: string) {
  const n = email.split("@")[0].replace(/[^a-zA-Z]/g, "");
  return (n.slice(0, 2) || "F").toUpperCase();
}

export function Nav({ pendentes, email, nome }: { pendentes: number; email: string; nome?: string }) {
  const p = usePathname();
  const grupos: [string, Item[]][] = [
    ["", PRINCIPAIS.filter((i) => i.href !== "/mais")],
    ["Mais", EXTRAS],
  ];
  return (
    <>
      {/* Menu lateral em ferro, igual ao do Forja OS */}
      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r border-white/5 bg-ferro text-[#edebe7] md:flex">
        <div className="px-4 pb-3 pt-4">
          <LogoForja sub="Gestão" />
        </div>
        <nav className="flex-1 overflow-y-auto pb-3">
          {grupos.map(([g, itens]) => (
            <div key={g}>
              <div className="px-[18px] pb-1.5 pt-[18px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6f6a64]">{g || "\u00a0"}</div>
              {itens.map(({ href, t, I, contador }) => {
                const on = href === "/" ? p === "/" : href === "/numeros" ? ativo(p, href) : p.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "mx-2.5 my-px flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      on ? "bg-white/8 text-white" : "text-ferro-texto hover:bg-white/5 hover:text-[#f4f2ee]",
                    )}
                  >
                    <I size={18} strokeWidth={1.8} className={on ? "text-brasa" : "opacity-85"} />
                    <span className="flex-1">{t}</span>
                    {contador && pendentes > 0 && (
                      <span className="num rounded-full bg-brasa px-2 text-xs font-bold text-sobre-brasa">{pendentes}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/5 p-2.5">
          <div className="flex items-center gap-2.5 rounded-[9px] p-2">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-br from-brasa to-[#9c3410] text-[12.5px] font-bold text-white">{iniciais(email)}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[13.5px] font-semibold text-[#f4f2ee]">{nome ?? "Gabriel"}</b>
              <small className="block truncate text-xs text-ferro-apagado">{email}</small>
            </span>
          </div>
          <form action="/auth/sair" method="post" className="px-2 pb-1">
            <button className="flex items-center gap-1.5 rounded-md border border-white/8 px-2 py-1 text-xs text-ferro-apagado hover:border-white/20 hover:text-[#f4f2ee]">
              <LogOut size={13} /> Sair
            </button>
          </form>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-linha bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(20,16,14,0.2)] backdrop-blur md:hidden">
        {PRINCIPAIS.map(({ href, t, I }) => (
          <Link key={href} href={href} className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-medium", ativo(p, href) ? "text-brasa-escuro" : "text-suave")}>
            <I size={21} strokeWidth={1.8} className={ativo(p, href) ? "text-brasa" : undefined} />
            {t}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Celular: barra de ferro no topo só com o logo. */
export function MaisMobile() {
  return (
    <div className="flex items-center justify-between bg-ferro px-4 py-2.5 md:hidden">
      <LogoForja />
    </div>
  );
}
