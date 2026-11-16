import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { SETORES } from "@/lib/agentes";
import { MODELO, PASSOS_MAX, ferramentas, instrucoes, nomeAgente } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/agente/[codigo]">) {
  const { codigo } = await ctx.params;
  if (!SETORES[codigo]) return new Response("Agente não existe", { status: 404 });
  const { sb, user } = await usuarioAtual();
  if (!user) return new Response("Entre de novo", { status: 401 });

  const { id, messages }: { id: string; messages: UIMessage[] } = await req.json();

  // Garante a conversa antes de o agente propor algo ligado a ela.
  const primeira = messages.find((m) => m.role === "user");
  const titulo =
    primeira?.parts.find((p) => p.type === "text")?.text.slice(0, 80) ?? "Conversa";
  const { error } = await sb
    .from("agente_conversas")
    .upsert({ id, agente: codigo, titulo }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return new Response(error.message, { status: 403 });

  const nome = await nomeAgente(sb, codigo);
  const result = streamText({
    model: MODELO,
    instructions: instrucoes(codigo, nome),
    messages: await convertToModelMessages(messages),
    tools: ferramentas({ sb, codigo, conversaId: id }),
    stopWhen: isStepCount(PASSOS_MAX),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onEnd: async ({ messages: todas }) => {
        await sb
          .from("agente_conversas")
          .update({ mensagens: todas, atualizado_em: new Date().toISOString() })
          .eq("id", id);
      },
    }),
  });
}
