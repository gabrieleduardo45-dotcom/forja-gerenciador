export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AcoesRapidas } from "@/components/acoes-rapidas";
import { MaisMobile, Nav } from "@/components/nav";
import { usuarioAtual } from "@/lib/supabase/server";

export default async function CentralLayout({ children }: LayoutProps<"/">) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect("/login");
  const { data: membro } = await sb.from("membros").select("nome,papel,ativo").eq("email", user.email!).maybeSingle();
  if (!membro?.ativo) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Acesso não liberado</p>
          <p className="mt-2 text-sm text-suave">{user.email} não está na lista de membros da Forja.</p>
          <form action="/auth/sair" method="post"><button className="mt-4 text-sm text-brasa">Sair</button></form>
        </div>
      </main>
    );
  }
  const [{ count }, { data: rapidos }, { data: precos }] = await Promise.all([
    sb.from("propostas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    sb.from("prospects").select("id,nome_casa,codigo").not("estagio", "in", "(perdido,descartado)").order("nome_casa"),
    sb.from("precos").select("produto").order("id"),
  ]);
  return (
    <div className="flex min-h-dvh">
      <Nav pendentes={count ?? 0} email={user.email!} nome={membro.nome ?? undefined} />
      <main className="min-w-0 flex-1">
        <MaisMobile />
        {children}
      </main>
      <AcoesRapidas prospects={(rapidos ?? []) as { id: number; nome_casa: string; codigo: string }[]} produtos={(precos ?? []).map((p) => p.produto as string)} />
    </div>
  );
}
