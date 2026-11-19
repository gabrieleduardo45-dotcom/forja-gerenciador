import Link from "next/link";
import { BarChart3, Bot, Building2, Gavel, Inbox, Megaphone, Target, Wallet } from "lucide-react";
import { Pagina } from "@/components/ui";

export const metadata = { title: "Mais" };

const LINKS = [
  { href: "/propostas", t: "Tudo que os agentes sugeriram", d: "a fila completa de aprovação", I: Inbox },
  { href: "/casas", t: "Casas (detalhe)", d: "CMV, exceções, sobra e descarte", I: Building2 },
  { href: "/financeiro", t: "Financeiro", d: "recebimentos, contratos e metas", I: Wallet },
  { href: "/comercial", t: "Comercial (detalhe)", d: "estágios, oportunidades e toques", I: Target },
  { href: "/marketing", t: "Marketing", d: "página de vendas e links marcados", I: Megaphone },
  { href: "/agentes", t: "Agentes", d: "conversar com cada setor", I: Bot },
  { href: "/decisoes", t: "Decisões", d: "o que já foi decidido", I: Gavel },
  { href: "/numeros", t: "Números", d: "DRE, caixa, margem e funil", I: BarChart3 },
];

export default function Mais() {
  return (
    <Pagina titulo="Mais" sub="O resto do sistema, para quando precisar.">
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {LINKS.map(({ href, t, d, I }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-cartao border border-linha bg-painel p-4 shadow-cartao active:scale-[0.99]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#fbf3ee] text-brasa-escuro"><I size={19} /></span>
              <span className="min-w-0">
                <span className="block font-semibold">{t}</span>
                <span className="block text-sm text-suave">{d}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/sair" method="post"><button className="text-sm text-suave underline">Sair da conta</button></form>
    </Pagina>
  );
}
