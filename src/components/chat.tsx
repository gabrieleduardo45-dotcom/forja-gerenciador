"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Database, Inbox, Loader2, Square, Users } from "lucide-react";
import { clsx } from "clsx";
import { SETORES } from "@/lib/agentes";

type Props = { codigo: string; id: string; iniciais: UIMessage[]; sugestoes: string[] };

export function Chat({ codigo, id, iniciais, sugestoes }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error } = useChat({
    id,
    messages: iniciais,
    transport: new DefaultChatTransport({ api: `/api/agente/${codigo}` }),
    onFinish: () => {
      if (!iniciais.length) router.replace(`/agentes/${codigo}?c=${id}`, { scroll: false });
      router.refresh();
    },
  });
  const ocupado = status === "submitted" || status === "streaming";

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function enviar(t: string) {
    const texto = t.trim();
    if (!texto || ocupado) return;
    sendMessage({ text: texto });
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="rolagem-fina flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {!messages.length && (
            <div className="py-10 text-center">
              <p className="text-suave">Pergunte qualquer coisa do setor {SETORES[codigo]?.setor}. O agente lê os dados reais antes de responder.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {sugestoes.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="rounded-full border border-linha px-3 py-1.5 text-sm text-suave hover:border-brasa/60 hover:text-texto">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.role === "user" && "justify-end")}>
              <div className={clsx("max-w-[92%] space-y-2", m.role === "user" && "rounded-cartao rounded-br-md bg-ferro px-3.5 py-2.5 text-[#f4f2ee]")}>
                {m.parts.map((p, i) => {
                  if (p.type === "text")
                    return m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap">{p.text}</p>
                    ) : (
                      <div key={i} className="md leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown></div>
                    );
                  if (isToolUIPart(p)) return <Ferramenta key={i} nome={getToolName(p)} estado={p.state} entrada={p.input} saida={"output" in p ? p.output : undefined} />;
                  return null;
                })}
              </div>
            </div>
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-suave"><Loader2 size={14} className="animate-spin" /> pensando…</div>
          )}
          {error && <p className="text-sm text-critico">Não consegui responder: {error.message || "erro"}. Tente de novo.</p>}
          <div ref={fim} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="border-t border-linha bg-fundo px-4 py-3 md:px-6"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-cartao border border-linha bg-painel shadow-cartao px-3 py-2 focus-within:border-brasa/60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            rows={1}
            placeholder={`Fale com ${SETORES[codigo]?.setor ?? "o agente"}…`}
            className="max-h-40 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 text-base outline-none placeholder:text-apagado"
          />
          {ocupado ? (
            <button type="button" onClick={stop} className="grid h-8 w-8 place-items-center rounded-md bg-painel-2 text-texto" aria-label="Parar"><Square size={14} /></button>
          ) : (
            <button disabled={!input.trim()} className="grid h-8 w-8 place-items-center rounded-md bg-brasa text-sobre-brasa disabled:opacity-40" aria-label="Enviar"><ArrowUp size={16} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function Ferramenta({ nome, estado, entrada, saida }: { nome: string; estado: string; entrada: unknown; saida: unknown }) {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const s = (saida ?? {}) as Record<string, unknown>;
  const rodando = estado === "input-streaming" || estado === "input-available";
  let I = Database;
  let texto = "";
  if (nome === "consultar") texto = `Leu ${e.fonte ?? "…"}${s.total != null ? ` · ${s.total} linhas` : ""}`;
  else if (nome === "propor") {
    I = Inbox;
    texto = `Proposta na fila: ${e.titulo ?? "…"}`;
  } else if (nome === "perguntar_ao_setor") {
    I = Users;
    texto = `Perguntou a ${SETORES[String(e.setor)]?.setor ?? e.setor ?? "…"}`;
  } else texto = nome;
  return (
    <div className={clsx("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs", nome === "propor" ? "border-brasa/40 text-brasa" : "border-linha text-suave")}>
      {rodando ? <Loader2 size={12} className="animate-spin" /> : <I size={12} />}
      <span className="truncate">{texto}</span>
      {"erro" in s && <span className="text-critico">· {String(s.erro)}</span>}
    </div>
  );
}
