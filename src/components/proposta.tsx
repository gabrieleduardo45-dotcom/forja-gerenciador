"use client";
import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy, RotateCcw, X, CheckCheck, MessageCircle } from "lucide-react";
import { clsx } from "clsx";
import { decidirProposta } from "@/app/acoes";
import { ICONES_TIPO, SETORES } from "@/lib/agentes";
import { dataHora, data } from "@/lib/formato";
import { Icone } from "./icone";
import { Selo, classeBotao, tomPrioridade } from "./ui";

export type Proposta = {
  id: number;
  criado_em: string;
  agente: string;
  tipo: string;
  prioridade: string;
  titulo: string;
  detalhe: string | null;
  alvo: string | null;
  prazo: string | null;
  status: string;
  decidido_em: string | null;
  nota_decisao: string | null;
};

export function CartaoProposta({ p, aberta = false }: { p: Proposta; aberta?: boolean }) {
  const [aberto, setAberto] = useState(aberta);
  const [pend, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const s = SETORES[p.agente];
  const decidir = (st: "aprovada" | "descartada" | "feita" | "pendente") => iniciar(() => decidirProposta(p.id, st));

  const textoMensagem = p.tipo === "mensagem" ? extrairMensagem(p.detalhe ?? "") : null;

  return (
    <article className={clsx("rounded-lg border bg-painel transition-opacity", p.prioridade === "alta" && p.status === "pendente" ? "border-brasa/40" : "border-linha", pend && "opacity-50")}>
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-painel-2 text-brasa">
          <Icone nome={s?.icone} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-suave">
            <span>{s?.setor ?? p.agente}</span>
            <span>·</span>
            <span>{ICONES_TIPO[p.tipo] ?? p.tipo}</span>
            {p.prioridade !== "baixa" && <Selo tom={tomPrioridade(p.prioridade)}>{p.prioridade}</Selo>}
            {p.alvo && <Selo>{p.alvo}</Selo>}
            {p.prazo && <span>até {data(p.prazo)}</span>}
          </div>
          <h3 className="mt-1 font-medium leading-snug">{p.titulo}</h3>
        </div>
        <ChevronDown size={18} className={clsx("mt-1 shrink-0 text-suave transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="border-t border-linha px-4 py-3">
          {p.detalhe && (
            <div className="md text-sm leading-relaxed text-suave">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.detalhe}</ReactMarkdown>
            </div>
          )}
          <div className="mt-2 text-xs text-apagado">
            Criada {dataHora(p.criado_em)}
            {p.decidido_em && ` · decidida ${dataHora(p.decidido_em)}`}
            {p.nota_decisao && ` · ${p.nota_decisao}`}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-linha px-4 py-2.5">
        {p.status === "pendente" ? (
          <>
            <button disabled={pend} onClick={() => decidir("aprovada")} className={classeBotao()}>
              <Check size={16} /> Aprovar
            </button>
            <button disabled={pend} onClick={() => decidir("descartada")} className={classeBotao("fantasma")}>
              <X size={16} /> Descartar
            </button>
          </>
        ) : p.status === "aprovada" ? (
          <>
            <Selo tom="ok">Aprovada</Selo>
            <button disabled={pend} onClick={() => decidir("feita")} className={classeBotao("secundario")}>
              <CheckCheck size={16} /> Marcar feita
            </button>
            <button disabled={pend} onClick={() => decidir("pendente")} className={classeBotao("fantasma")}>
              <RotateCcw size={14} /> Desfazer
            </button>
          </>
        ) : (
          <>
            <Selo tom={p.status === "feita" ? "ok" : "neutro"}>{p.status === "feita" ? "Feita" : "Descartada"}</Selo>
            <button disabled={pend} onClick={() => decidir("pendente")} className={classeBotao("fantasma")}>
              <RotateCcw size={14} /> Reabrir
            </button>
          </>
        )}
        {textoMensagem && (
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => {
                navigator.clipboard.writeText(textoMensagem);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
              className={classeBotao("fantasma")}
            >
              <Copy size={14} /> {copiado ? "Copiado" : "Copiar texto"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoMensagem)}`} target="_blank" rel="noreferrer" className={classeBotao("fantasma")}>
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

/** Pega o texto da mensagem pronta: o que estiver entre aspas em bloco (>) ou num bloco de código; senão, tudo. */
function extrairMensagem(d: string) {
  const citado = d.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, ""));
  if (citado.length) return citado.join("\n").trim();
  const bloco = /```[a-z]*\n([\s\S]*?)```/.exec(d);
  if (bloco) return bloco[1].trim();
  return d.trim();
}
