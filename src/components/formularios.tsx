"use client";
import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { lancarRecebimento, novoProspect, registrarToque, type Resultado } from "@/app/acoes";
import { classeBotao } from "./ui";

const campo = "w-full rounded-md border border-linha bg-painel-2 px-3 py-2 text-base outline-none focus:border-brasa md:text-sm";

function Modal({ rotulo, titulo, children, variante = "primario", icone = true }: { rotulo: ReactNode; titulo: string; children: (fechar: () => void) => ReactNode; variante?: "primario" | "secundario" | "fantasma"; icone?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={classeBotao(variante)}>
        {icone && <Plus size={16} />} {rotulo}
      </button>
      <dialog ref={ref} onClose={() => setAberto(false)} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-linha bg-painel p-0 text-texto backdrop:bg-black/60">
        <div className="flex items-center justify-between border-b border-linha px-4 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button type="button" onClick={fechar} className="text-suave hover:text-texto" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="max-h-[75dvh] overflow-y-auto p-4">{aberto && children(fechar)}</div>
      </dialog>
    </>
  );
}

function Campo({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`block space-y-1 ${largo ? "col-span-2" : "col-span-2 sm:col-span-1"}`}>
      <span className="text-xs text-suave">{rotulo}</span>
      {children}
    </label>
  );
}

function Rodape({ estado, pend, texto, fechar }: { estado: Resultado | null; pend: boolean; texto: string; fechar: () => void }) {
  useEffect(() => {
    if (estado?.ok) {
      const t = setTimeout(fechar, 900);
      return () => clearTimeout(t);
    }
  }, [estado, fechar]);
  return (
    <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
      <span className={`text-sm ${estado?.ok ? "text-ok" : "text-critico"}`}>{estado?.msg}</span>
      <button disabled={pend} className={classeBotao()}>{pend ? "Salvando…" : texto}</button>
    </div>
  );
}

const opcoes = (l: [string, string][]) => l.map(([v, t]) => <option key={v} value={v}>{t}</option>);

export const CANAIS: [string, string][] = [["whatsapp", "WhatsApp"], ["instagram_dm", "Instagram DM"], ["instagram_interacao", "Instagram interação"], ["visita_quente", "Visita (quente)"], ["visita_fria", "Visita (fria)"], ["ligacao_quente", "Ligação (quente)"], ["ligacao_fria", "Ligação (fria)"], ["evento", "Evento"], ["parceiro", "Parceiro"], ["email", "E-mail"], ["outro", "Outro"]];
const TIPOS: [string, string][] = [["primeiro_toque", "Primeiro toque"], ["follow_up", "Follow-up"], ["aquecimento", "Aquecimento"], ["qualificacao", "Qualificação"], ["proposta_raiox", "Proposta de Raio-X"], ["confirmacao", "Confirmação"], ["convite_evento", "Convite p/ evento"], ["pedido_indicacao", "Pedido de indicação"], ["nutricao", "Nutrição"], ["encerramento", "Encerramento"], ["resposta", "Resposta"], ["outro", "Outro"]];
const RESULTADOS: [string, string][] = [["sem_resposta", "Sem resposta"], ["lido_sem_resposta", "Lido, sem resposta"], ["respondeu_positivo", "Respondeu positivo"], ["respondeu_neutro", "Respondeu neutro"], ["respondeu_negativo", "Respondeu negativo"], ["conversou_decisor", "Conversou com o decisor"], ["falou_gatekeeper", "Falou com funcionário"], ["raiox_agendado", "Raio-X agendado"], ["pediu_parar", "Pediu para parar"], ["numero_errado", "Número errado"], ["casa_fechada", "Casa fechada"]];
const SETORES: [string, string][] = [["a_la_carte", "À la carte"], ["self_service", "Self-service"], ["marmitaria", "Marmitaria"], ["lanchonete", "Lanchonete"], ["hamburgueria", "Hamburgueria"], ["pizzaria", "Pizzaria"], ["bar", "Bar"], ["cafe", "Café"], ["cozinha_producao", "Cozinha de produção"], ["food_service", "Food service"], ["outro", "Outro"]];
const ORIGENS: [string, string][] = [["pesquisa_a1", "Pesquisa do Comercial"], ["indicacao_cliente", "Indicação de cliente"], ["parceiro", "Parceiro"], ["inbound_whatsapp", "Chegou pelo WhatsApp"], ["inbound_instagram", "Chegou pelo Instagram"], ["inbound_calculadora", "Calculadora"], ["inbound_fichas", "Produto de fichas"], ["visita_fria", "Visita fria"], ["ligacao_fria", "Ligação fria"], ["evento", "Evento"], ["trafego_pago", "Tráfego pago"], ["outro", "Outro"]];

export function RegistrarToque({ prospects, prospectId, rotulo = "Registrar toque", variante = "primario" }: { prospects?: { id: number; nome_casa: string; codigo: string }[]; prospectId?: number; rotulo?: string; variante?: "primario" | "secundario" | "fantasma" }) {
  const [estado, acao, pend] = useActionState(registrarToque, null);
  return (
    <Modal rotulo={rotulo} titulo="Registrar toque" variante={variante} icone={variante !== "fantasma"}>
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          {prospectId ? (
            <input type="hidden" name="prospect_id" value={prospectId} />
          ) : (
            <Campo rotulo="Casa" largo>
              <select name="prospect_id" required className={campo} defaultValue="">
                <option value="" disabled>Escolha…</option>
                {prospects?.map((p) => <option key={p.id} value={p.id}>{p.nome_casa} · {p.codigo}</option>)}
              </select>
            </Campo>
          )}
          <Campo rotulo="Canal"><select name="canal" className={campo}>{opcoes(CANAIS)}</select></Campo>
          <Campo rotulo="Direção"><select name="direcao" className={campo}><option value="saida">Eu chamei</option><option value="entrada">Ele chamou</option></select></Campo>
          <Campo rotulo="Tipo"><select name="tipo" className={campo}>{opcoes(TIPOS)}</select></Campo>
          <Campo rotulo="Resultado"><select name="resultado" className={campo}>{opcoes(RESULTADOS)}</select></Campo>
          <Campo rotulo="Roteiro usado (opcional)"><input name="roteiro" placeholder="T1-sobra" className={campo} /></Campo>
          <Campo rotulo="Próximo toque em"><input type="date" name="proxima_acao_em" className={campo} /></Campo>
          <Campo rotulo="Próxima ação" largo><input name="proxima_acao" placeholder="Mandar T2 com a conta" className={campo} /></Campo>
          <Campo rotulo="Observação" largo><textarea name="obs" rows={2} className={campo} /></Campo>
          <Rodape estado={estado} pend={pend} texto="Registrar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}

export function NovoProspect() {
  const [estado, acao, pend] = useActionState(novoProspect, null);
  return (
    <Modal rotulo="Novo prospect" titulo="Novo prospect" variante="secundario">
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <Campo rotulo="Nome da casa" largo><input name="nome_casa" required className={campo} /></Campo>
          <Campo rotulo="Setor"><select name="setor" className={campo}>{opcoes(SETORES)}</select></Campo>
          <Campo rotulo="Bairro"><input name="bairro" className={campo} /></Campo>
          <Campo rotulo="Decisor"><input name="decisor_nome" className={campo} /></Campo>
          <Campo rotulo="WhatsApp do decisor"><input name="whatsapp_decisor" inputMode="tel" placeholder="92 9…" className={campo} /></Campo>
          <Campo rotulo="Instagram da casa"><input name="instagram_casa" placeholder="@" className={campo} /></Campo>
          <Campo rotulo="Origem"><select name="origem" className={campo}>{opcoes(ORIGENS)}</select></Campo>
          <Campo rotulo="Prioridade"><select name="prioridade_manual" className={campo} defaultValue=""><option value="">Pelo score</option><option value="brasa">Brasa</option><option value="faisca">Faísca</option><option value="temperado">Temperado</option><option value="descarte">Descarte</option></select></Campo>
          <Campo rotulo="Primeiro toque em"><input type="date" name="proximo_toque_em" className={campo} /></Campo>
          <Campo rotulo="Observação" largo><textarea name="obs" rows={2} className={campo} /></Campo>
          <Rodape estado={estado} pend={pend} texto="Cadastrar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}

export function LancarRecebimento({ produtos }: { produtos: string[] }) {
  const [estado, acao, pend] = useActionState(lancarRecebimento, null);
  return (
    <Modal rotulo="Lançar recebimento" titulo="Lançar recebimento">
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <Campo rotulo="Produto" largo>
            <input name="produto" list="lista-produtos" required className={campo} />
            <datalist id="lista-produtos">{produtos.map((p) => <option key={p} value={p} />)}</datalist>
          </Campo>
          <Campo rotulo="Valor (R$)"><input name="valor" type="number" step="0.01" min="0" inputMode="decimal" required className={campo} /></Campo>
          <Campo rotulo="Data"><input name="data" type="date" className={campo} /></Campo>
          <Campo rotulo="Linha"><select name="linha" className={campo}><option value="consultoria">Consultoria</option><option value="recorrente">Recorrente</option><option value="digital">Digital</option><option value="landing">Landing page</option><option value="outro">Outro</option></select></Campo>
          <Campo rotulo="Forma"><select name="forma" className={campo}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="hotmart">Hotmart</option><option value="dinheiro">Dinheiro</option></select></Campo>
          <Campo rotulo="Observação" largo><input name="obs" className={campo} /></Campo>
          <Rodape estado={estado} pend={pend} texto="Lançar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}
