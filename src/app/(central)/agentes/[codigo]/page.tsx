import Link from "next/link";
import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { ArrowLeft, Plus } from "lucide-react";
import { clsx } from "clsx";
import { Chat } from "@/components/chat";
import { Icone } from "@/components/icone";
import { CartaoProposta, type Proposta } from "@/components/proposta";
import { BotaoRodar } from "@/components/rodar";
import { Cartao, Vazio } from "@/components/ui";
import { FONTES, SETORES } from "@/lib/agentes";
import { dataHora } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/agentes/[codigo]">) {
  const { codigo } = await params;
  return { title: SETORES[codigo]?.setor ?? "Agente" };
}

export default async function Agente({ params, searchParams }: PageProps<"/agentes/[codigo]">) {
  const { codigo } = await params;
  const s = SETORES[codigo];
  if (!s) notFound();
  const sp = await searchParams;
  const conversaId = typeof sp.c === "string" ? sp.c : null;
  const { sb } = await usuarioAtual();

  const [{ data: agente }, { data: conversas }, { data: propostas }, atual] = await Promise.all([
    sb.from("agentes").select("*").eq("codigo", codigo).single(),
    sb.from("agente_conversas").select("id,titulo,atualizado_em,autor_email").eq("agente", codigo).order("atualizado_em", { ascending: false }).limit(30),
    sb.from("propostas").select("*").eq("agente", codigo).in("status", ["pendente", "aprovada"]).order("criado_em", { ascending: false }).limit(10),
    conversaId ? sb.from("agente_conversas").select("id,mensagens").eq("id", conversaId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const id = atual.data?.id ?? conversaId ?? crypto.randomUUID();
  const iniciais = (atual.data?.mensagens ?? []) as UIMessage[];

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] flex-col md:h-dvh lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-linha px-4 py-3 md:px-6">
          <Link href="/agentes" className="text-suave hover:text-texto" aria-label="Voltar"><ArrowLeft size={18} /></Link>
          <div className="grid h-9 w-9 place-items-center rounded-md bg-painel-2 text-brasa"><Icone nome={s.icone} size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium leading-tight">{agente?.nome ?? s.setor}</div>
            <div className="truncate text-xs text-suave">{s.setor} · lê {s.fontes.length} fontes · propõe, não executa</div>
          </div>
          <Link href={`/agentes/${codigo}`} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-suave hover:bg-painel-2 hover:text-texto"><Plus size={14} /> Nova</Link>
        </header>
        <Chat key={id} codigo={codigo} id={id} iniciais={iniciais} sugestoes={sugestoes(codigo)} />
      </div>

      <aside className="rolagem-fina hidden w-96 shrink-0 space-y-4 overflow-y-auto border-l border-linha p-4 lg:block">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Rodada do setor</span>
          <BotaoRodar apenas={[codigo]} rotulo="Rodar só este" />
        </div>
        <Cartao titulo="Propostas abertas">
          {propostas?.length ? (
            <div className="space-y-2">{(propostas as Proposta[]).map((p) => <CartaoProposta key={p.id} p={p} />)}</div>
          ) : (
            <Vazio>Nenhuma proposta aberta deste setor.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="Conversas">
          {conversas?.length ? (
            <ul className="space-y-0.5">
              {conversas.map((c) => (
                <li key={c.id}>
                  <Link href={`/agentes/${codigo}?c=${c.id}`} className={clsx("block rounded-md px-2 py-1.5 text-sm", c.id === id ? "bg-painel-2" : "hover:bg-painel-2/60")}>
                    <div className="truncate">{c.titulo}</div>
                    <div className="text-xs text-apagado">{dataHora(c.atualizado_em)}{c.autor_email === "rodada" && " · rodada automática"}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nenhuma conversa ainda.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="O que este agente lê">
          <ul className="space-y-1.5 text-xs">
            {s.fontes.map((f) => (
              <li key={f}><code className="text-texto">{f}</code> <span className="text-suave">· {FONTES[f].descricao}</span></li>
            ))}
          </ul>
        </Cartao>
      </aside>
    </div>
  );
}

function sugestoes(codigo: string): string[] {
  const m: Record<string, string[]> = {
    A0: ["Monte a página do dia", "Pergunte a cada setor o que está travado e me diga as 3 prioridades", "Como estamos contra a meta do mês?"],
    A1: ["Quem eu toco hoje e com qual mensagem?", "Qual oportunidade está parada e por quê?", "A meta de contatos do mês está em risco?"],
    A2: ["Sugira 3 posts para esta semana", "Que número de cliente vira um bom post?"],
    A4: ["Qual casa saiu do CMV alvo?", "Quais insumos mais pesam no CMV?"],
    A7: ["Monte a pauta da próxima visita", "Quais exceções se repetem?"],
    A8: ["Como está a receita do mês contra a meta?", "Qual o valor por hora real de cada casa?"],
    A12: ["Como está a conversão da página de vendas?", "Que mudança você testaria esta semana?"],
  };
  return m[codigo] ?? ["O que você vê no seu setor hoje?", "O que eu deveria fazer esta semana?"];
}
