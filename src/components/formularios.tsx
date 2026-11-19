"use client";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  fecharImplantacao, lancarCmv, lancarRecebimento, novaOportunidade, novoProspect, perderOportunidade,
  registrarExcecao, registrarToque, resolverExcecao, type Resultado,
} from "@/app/acoes";
import { classeBotao } from "./ui";

const campo = "campo text-base md:text-sm";

export function Modal({ rotulo, titulo, children, variante = "primario", icone = true, classe }: { rotulo: ReactNode; titulo: string; children: (fechar: () => void) => ReactNode; variante?: "primario" | "secundario" | "fantasma"; icone?: boolean; classe?: string }) {
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
      <button type="button" onClick={() => setAberto(true)} className={classe ? `${classeBotao(variante)} ${classe}` : classeBotao(variante)}>
        {icone && <Plus size={16} />} {rotulo}
      </button>
      <dialog ref={ref} onClose={() => setAberto(false)} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-cartao border border-linha bg-painel p-0 text-texto shadow-[0_24px_64px_-16px_rgba(20,16,14,0.35)] backdrop:bg-[rgba(14,13,12,0.45)] backdrop:backdrop-blur-[2px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[17px] font-[650] tracking-[-0.01em]">{titulo}</h2>
          <button type="button" onClick={fechar} className="text-suave hover:text-texto" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="max-h-[75dvh] overflow-y-auto px-5 pb-5 pt-2">{aberto && children(fechar)}</div>
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

export function RegistrarToque({ prospects, prospectId, rotulo = "Registrar toque", variante = "primario", classe }: { prospects?: { id: number; nome_casa: string; codigo: string }[]; prospectId?: number; rotulo?: string; variante?: "primario" | "secundario" | "fantasma"; classe?: string }) {
  const [estado, acao, pend] = useActionState(registrarToque, null);
  return (
    <Modal rotulo={rotulo} titulo="Registrar toque" variante={variante} icone={variante !== "fantasma"} classe={classe}>
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

export function NovoProspect({ classe, variante = "secundario" }: { classe?: string; variante?: "primario" | "secundario" | "fantasma" } = {}) {
  const [estado, acao, pend] = useActionState(novoProspect, null);
  return (
    <Modal rotulo="Novo prospect" titulo="Novo prospect" variante={variante} classe={classe}>
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

export function LancarRecebimento({ produtos, classe, variante = "primario" }: { produtos: string[]; classe?: string; variante?: "primario" | "secundario" | "fantasma" }) {
  const [estado, acao, pend] = useActionState(lancarRecebimento, null);
  return (
    <Modal rotulo="Lançar recebimento" titulo="Lançar recebimento" variante={variante} classe={classe}>
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

type Opcao = { id: number; rotulo: string };
export type Preco = { id: number; produto: string; fundadora: number | null; cheia: number | null; unidade: string | null };

const FRENTES: [string, string][] = [["produto", "Produto"], ["custo", "Custo"], ["gente", "Gente"], ["conduta", "Conduta"], ["rotina", "Rotina"], ["financas", "Finanças"]];

export function FecharImplantacao({ prospects, precos, prospectId, produto, valor, variante = "primario" }: { prospects: Opcao[]; precos: Preco[]; prospectId?: number; produto?: string; valor?: number; variante?: "primario" | "secundario" | "fantasma" }) {
  const [estado, acao, pend] = useActionState(fecharImplantacao, null);
  return (
    <Modal rotulo={prospectId ? "Fechar" : "Fechar implantação"} titulo="Fechar implantação" variante={variante} icone={variante !== "fantasma"}>
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <p className="col-span-2 text-sm text-suave">Cria a casa (código C-…), o contrato e marca a venda como ganha. Tudo de uma vez.</p>
          <Campo rotulo="Casa" largo>
            <select name="prospect_id" required defaultValue={prospectId ?? ""} className={campo}>
              <option value="" disabled>Escolha…</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Produto" largo>
            <input name="produto" list="lista-precos" required defaultValue={produto} className={campo} />
            <datalist id="lista-precos">{precos.map((p) => <option key={p.id} value={p.produto} />)}</datalist>
          </Campo>
          <Campo rotulo="Valor fechado (R$)"><input name="valor" type="number" step="0.01" min="0" required defaultValue={valor} className={campo} /></Campo>
          <Campo rotulo="Condição"><select name="condicao" className={campo}><option value="fundadora">Fundadora</option><option value="cheia">Cheia</option></select></Campo>
          <Campo rotulo="Cobrança"><select name="unidade" className={campo}><option value="avulso">Valor único</option><option value="mes">Por mês</option><option value="parcela">Parcelado</option></select></Campo>
          <Campo rotulo="Meses (se recorrente/parcelado)"><input name="meses" type="number" min="1" className={campo} /></Campo>
          <Campo rotulo="Início"><input name="inicio" type="date" className={campo} /></Campo>
          <Campo rotulo="Forma de pagamento"><select name="forma_pagamento" className={campo}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select></Campo>
          <fieldset className="col-span-2">
            <legend className="mb-1 text-xs text-suave">Frentes da implantação</legend>
            <div className="flex flex-wrap gap-3">
              {FRENTES.map(([v, t]) => (
                <label key={v} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="frentes" value={v} className="accent-brasa" /> {t}</label>
              ))}
            </div>
          </fieldset>
          <Rodape estado={estado} pend={pend} texto="Fechar implantação" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}

export function NovaOportunidade({ prospects, precos }: { prospects: Opcao[]; precos: Preco[] }) {
  const [estado, acao, pend] = useActionState(novaOportunidade, null);
  return (
    <Modal rotulo="Proposta comercial" titulo="Registrar proposta comercial" variante="secundario">
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <Campo rotulo="Casa" largo>
            <select name="prospect_id" required defaultValue="" className={campo}>
              <option value="" disabled>Escolha…</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Produto" largo>
            <select name="preco_id" required defaultValue="" className={campo}>
              <option value="" disabled>Escolha…</option>
              {precos.map((p) => <option key={p.id} value={p.id}>{p.produto}{p.fundadora ? ` · R$ ${p.fundadora}` : ""}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Condição"><select name="condicao" className={campo}><option value="fundadora">Fundadora</option><option value="cheia">Cheia</option></select></Campo>
          <Campo rotulo="Valor (vazio = tabela)"><input name="valor" type="number" step="0.01" min="0" className={campo} /></Campo>
          <Campo rotulo="Data da proposta"><input name="data_proposta" type="date" className={campo} /></Campo>
          <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:pt-6"><input type="checkbox" name="desconto_avista" className="accent-brasa" /> Desconto à vista</label>
          <Rodape estado={estado} pend={pend} texto="Registrar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}

const MOTIVOS: [string, string][] = [["preco", "Preço"], ["momento", "Momento"], ["nao_ve_problema", "Não vê o problema"], ["sem_decisor", "Sem decisor"], ["ja_tem_consultor", "Já tem consultor"], ["sumiu", "Sumiu"], ["nao_cabe_icp", "Não é o perfil"], ["outro", "Outro"]];

export function PerderOportunidade({ id }: { id: number }) {
  const [pend, iniciar] = useTransition();
  return (
    <select
      aria-label="Marcar perdida"
      disabled={pend}
      defaultValue=""
      onChange={(e) => e.target.value && iniciar(() => perderOportunidade(id, e.target.value))}
      className="campo w-auto !py-1 !pl-2 text-xs disabled:opacity-50"
    >
      <option value="">Perdida…</option>
      {opcoes(MOTIVOS)}
    </select>
  );
}

export function RegistrarExcecao({ casas }: { casas: Opcao[] }) {
  const [estado, acao, pend] = useActionState(registrarExcecao, null);
  return (
    <Modal rotulo="Exceção" titulo="Registrar exceção na cozinha" variante="secundario">
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <Campo rotulo="Casa" largo>
            <select name="casa_id" required defaultValue="" className={campo}>
              <option value="" disabled>Escolha…</option>
              {casas.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="O que aconteceu" largo><input name="o_que" required placeholder="Picanha saiu com 260 g no almoço" className={campo} /></Campo>
          <Campo rotulo="Causa"><input name="causa" className={campo} /></Campo>
          <Campo rotulo="Gravidade"><select name="estado" className={campo}><option value="faisca">Faísca (atenção)</option><option value="brasa">Brasa (crítico)</option></select></Campo>
          <Campo rotulo="Ação" largo><input name="acao" placeholder="Refazer cartão de praça e pesar na frente do cozinheiro" className={campo} /></Campo>
          <Campo rotulo="Responsável (cargo)"><input name="responsavel" placeholder="Chef de praça" className={campo} /></Campo>
          <Campo rotulo="Prazo"><input name="prazo" type="date" className={campo} /></Campo>
          <Rodape estado={estado} pend={pend} texto="Registrar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}

export function ResolverExcecao({ id }: { id: number }) {
  const [pend, iniciar] = useTransition();
  return (
    <button disabled={pend} onClick={() => iniciar(() => resolverExcecao(id))} className={classeBotao("fantasma")} title="Marcar resolvida">
      <Check size={14} /> Resolvida
    </button>
  );
}

export function LancarCmv({ casas }: { casas: Opcao[] }) {
  const [estado, acao, pend] = useActionState(lancarCmv, null);
  return (
    <Modal rotulo="CMV da semana" titulo="Lançar CMV da semana">
      {(fechar) => (
        <form action={acao} className="grid grid-cols-2 gap-3">
          <Campo rotulo="Casa" largo>
            <select name="casa_id" required defaultValue="" className={campo}>
              <option value="" disabled>Escolha…</option>
              {casas.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Semana (segunda-feira)"><input name="semana_inicio" type="date" required className={campo} /></Campo>
          <Campo rotulo="CMV real (%)"><input name="cmv_pct" type="number" step="0.1" min="0" max="100" required className={campo} /></Campo>
          <Campo rotulo="Alvo (%)"><input name="alvo_pct" type="number" step="0.1" min="0" max="100" required defaultValue={32} className={campo} /></Campo>
          <Campo rotulo="Observação" largo><input name="obs" className={campo} /></Campo>
          <Rodape estado={estado} pend={pend} texto="Lançar" fechar={fechar} />
        </form>
      )}
    </Modal>
  );
}
