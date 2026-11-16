"use client";
import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy, RotateCcw, X, CheckCheck, MessageCircle, Send } from "lucide-react";
import { clsx } from "clsx";
import { decidirProposta } from "@/app/acoes";
import { ICONES_TIPO, SETORES } from "@/lib/agentes";
import { descreverAcao, type Acao } from "@/lib/execucao";
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
  payload?: { acao?: Acao } | null;
};

export type Contato = { whatsapp?: string | null; instagram?: string | null };

/** wa.me exige DDI: número de Manaus sem 55 ganha o 55. */
function linkWhatsapp(numero: string | null | undefined, texto: string) {
  let n = (numero ?? "").replace(/\D/g, "");
  if (n && n.length <= 11) n = "55" + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

function usuarioInstagram(v?: string | null) {
  if (!v) return null;
  const m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(v);
  return (m ? m[1] : v.replace(/^@/, "").trim()) || null;
}

export function CartaoProposta({ p, aberta = false, contato }: { p: Proposta; aberta?: boolean; contato?: Contato }) {
  const [aberto, setAberto] = useState(aberta);
  const [pend, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const s = SETORES[p.agente];
  const decidir = (st: "aprovada" | "descartada" | "feita" | "pendente") => iniciar(() => decidirProposta(p.id, st));

  const textoMensagem = p.tipo === "mensagem" ? extrairMensagem(p.detalhe ?? "") : null;

  return (
    <article className={clsx("rounded-cartao border bg-painel shadow-cartao transition-opacity", p.prioridade === "alta" && p.status === "pendente" ? "border-brasa" : "border-linha", pend && "opacity-50")}>
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-linha bg-painel-2 text-brasa-escuro">
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
          {p.payload?.acao && p.status === "pendente" && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#fbf3ee] px-2 py-1 text-xs font-medium text-brasa-escuro">
              Ao aprovar: {descreverAcao(p.payload.acao)}
            </div>
          )}
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
              <Check size={16} /> {p.payload?.acao ? "Aprovar e executar" : "Aprovar"}
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
            <a href={linkWhatsapp(contato?.whatsapp, textoMensagem)} target="_blank" rel="noreferrer" className={classeBotao("fantasma")} title={contato?.whatsapp ? "Abre a conversa com o número do prospect e o texto pronto" : "Sem número: escolha o contato no WhatsApp"}>
              <MessageCircle size={14} /> WhatsApp
            </a>
            {usuarioInstagram(contato?.instagram) && (
              <a
                href={`https://ig.me/m/${usuarioInstagram(contato?.instagram)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => navigator.clipboard.writeText(textoMensagem).catch(() => {})}
                className={classeBotao("fantasma")}
                title="Copia o texto e abre o direct do Instagram; é só colar e enviar"
              >
                <Send size={14} /> Instagram
              </a>
            )}
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
