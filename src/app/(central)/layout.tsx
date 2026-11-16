export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
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
  const { count } = await sb.from("propostas").select("id", { count: "exact", head: true }).eq("status", "pendente");
  return (
    <div className="flex min-h-dvh">
      <Nav pendentes={count ?? 0} email={user.email!} nome={membro.nome ?? undefined} />
      <main className="min-w-0 flex-1">
        <MaisMobile />
        {children}
      </main>
    </div>
  );
}
