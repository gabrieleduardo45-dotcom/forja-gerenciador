"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Bot, Building2, Gavel, Inbox, LayoutDashboard, LogOut, Megaphone, Target, Wallet } from "lucide-react";

const ITENS = [
  { href: "/", t: "Hoje", I: LayoutDashboard },
  { href: "/propostas", t: "Aprovar", I: Inbox, contador: true },
  { href: "/agentes", t: "Agentes", I: Bot },
  { href: "/comercial", t: "Comercial", I: Target },
  { href: "/casas", t: "Casas", I: Building2 },
  { href: "/financeiro", t: "Financeiro", I: Wallet },
  { href: "/marketing", t: "Marketing", I: Megaphone },
  { href: "/decisoes", t: "Decisões", I: Gavel },
];
const MOBILE = ["/", "/propostas", "/agentes", "/comercial", "/financeiro"];

function ativo(p: string, href: string) {
  return href === "/" ? p === "/" : p.startsWith(href);
}

export function Nav({ pendentes, email }: { pendentes: number; email: string }) {
  const p = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-linha bg-painel md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-brasa text-sm font-bold text-sobre-brasa">F</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Forja</div>
            <div className="text-xs text-suave">Central de comando</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {ITENS.map(({ href, t, I, contador }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                ativo(p, href) ? "bg-painel-2 text-texto" : "text-suave hover:bg-painel-2/60 hover:text-texto",
              )}
            >
              <I size={17} className={ativo(p, href) ? "text-brasa" : undefined} />
              <span className="flex-1">{t}</span>
              {contador && pendentes > 0 && (
                <span className="num rounded bg-brasa px-1.5 text-xs font-semibold text-sobre-brasa">{pendentes}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-linha px-5 py-4">
          <div className="truncate text-xs text-suave">{email}</div>
          <form action="/auth/sair" method="post">
            <button className="mt-2 flex items-center gap-2 text-xs text-suave hover:text-texto">
              <LogOut size={14} /> Sair
            </button>
          </form>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-linha bg-painel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {ITENS.filter((i) => MOBILE.includes(i.href)).map(({ href, t, I, contador }) => (
          <Link key={href} href={href} className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-[11px]", ativo(p, href) ? "text-brasa" : "text-suave")}>
            <I size={20} />
            {t}
            {contador && pendentes > 0 && (
              <span className="num absolute right-[22%] top-1.5 rounded bg-brasa px-1 text-[10px] font-semibold text-sobre-brasa">{pendentes}</span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function MaisMobile() {
  const p = usePathname();
  const extras = ITENS.filter((i) => !MOBILE.includes(i.href));
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-linha bg-painel px-3 py-2 md:hidden">
      {extras.map(({ href, t, I }) => (
        <Link key={href} href={href} className={clsx("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", ativo(p, href) ? "bg-painel-2 text-texto" : "text-suave")}>
          <I size={14} /> {t}
        </Link>
      ))}
    </div>
  );
}
