import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, MessageCircle, Send } from "lucide-react";
import { CasasForjaOS } from "@/components/casas-os";
import { Falei } from "@/components/falei";
import { NovoRestaurante } from "@/components/formularios";
import { CartaoProposta, type Proposta } from "@/components/proposta";
import { SobraDescarte } from "@/components/sobra-descarte";
import { Cartao, Vazio } from "@/components/ui";
import { contatoDe, contatosDasPropostas } from "@/lib/contatos";
import { brl } from "@/lib/formato";
import { casasDoForjaOS } from "@/lib/forja-os";
import { COLUNAS, colunaDe, linkIg, linkWa } from "@/lib/funil";
import { hojeManaus } from "@/lib/motor";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Hoje" };

type Texto = { type: string; text?: string };
const ORDEM = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;

export default async function Hoje() {
  const { sb, user } = await usuarioAtual();
  const hoje = hojeManaus();
  const mes = hoje.slice(0, 7) + "-01";
  const osP = casasDoForjaOS();

  const [propostas, total, fila, todos, fat, pagina, membro] = await Promise.all([
    sb.from("propostas").select("*").eq("status", "pendente").order("criado_em", { ascending: false }).limit(40),
    sb.from("propostas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    sb.from("prospects").select("id,nome_casa,bairro,estagio,whatsapp_decisor,instagram_casa,instagram_decisor,proximo_toque_em")
      .lte("proximo_toque_em", hoje).eq("optout", false).not("estagio", "in", "(perdido,descartado,care_ativo,implantacao_fechada)")
      .order("proximo_toque_em").limit(6),
    sb.from("prospects").select("estagio").not("estagio", "in", "(perdido,descartado)"),
    sb.from("v_meta_real").select("real,alvo").eq("mes", mes).eq("indicador", "faturamento_mes").maybeSingle(),
    sb.from("agente_conversas").select("mensagens").eq("agente", "A0").like("titulo", "Página do dia%").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    sb.from("membros").select("nome").eq("email", user!.email!).maybeSingle(),
  ]);

  const sugestoes = ((propostas.data ?? []) as Proposta[]).sort((a, b) => ORDEM[a.prioridade] - ORDEM[b.prioridade]).slice(0, 3);
  const contatos = await contatosDasPropostas(sb, sugestoes);
  const conta = (k: string) => (todos.data ?? []).filter((p) => colunaDe(p.estagio) === k).length;
  const resumo = (pagina.data?.mensagens as { role: string; parts: Texto[] }[] | undefined)
    ?.filter((x) => x.role === "assistant").flatMap((x) => x.parts).filter((p) => p.type === "text").map((p) => p.text).join("\n");

  const diaBruto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Manaus" }).format(new Date());
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Manaus" }).format(new Date()));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="entra mx-auto w-full max-w-3xl space-y-5 px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-8">
      <header>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em]">{saudacao}, {membro.data?.nome ?? "Gabriel"}</h1>
        <p className="mt-1 text-[15px] text-suave">{diaBruto.charAt(0).toUpperCase() + diaBruto.slice(1)}</p>
      </header>

      <section className="grid grid-cols-3 gap-2.5">
        <Numero rotulo="Faturado no mês" valor={brl(fat.data?.real ?? 0)} sub={fat.data?.alvo ? `meta ${brl(fat.data.alvo)}` : undefined} />
        <Numero rotulo="Clientes" valor={String(conta("cliente"))} href="/clientes" />
        <Numero rotulo="Em negociação" valor={String(conta("conversa") + conta("proposta"))} href="/clientes" />
      </section>

      <div className="hidden gap-2 md:flex">
        <NovoRestaurante />
        <SobraDescarte variante="secundario" />
      </div>

      <Cartao titulo="Falar hoje" acao={<Link href="/clientes" className="flex items-center gap-1 text-xs text-suave">clientes <ArrowRight size={12} /></Link>}>
        {fila.data?.length ? (
          <ul className="divide-y divide-[rgba(20,16,14,0.06)]">
            {fila.data.map((f) => {
              const wa = linkWa(f.whatsapp_decisor);
              const ig = linkIg(f.instagram_casa ?? f.instagram_decisor);
              const col = COLUNAS.find((c) => c.k === colunaDe(f.estagio));
              return (
                <li key={f.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{f.nome_casa}</div>
                    <div className="truncate text-xs text-suave">{[col?.t, f.bairro, f.proximo_toque_em < hoje ? "atrasado" : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-linha text-ok"><MessageCircle size={18} /></a>}
                  {ig && <a href={ig} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-linha text-[#b1306e]"><Send size={17} /></a>}
                  <Falei id={f.id} canal={wa ? "whatsapp" : "instagram"} />
                </li>
              );
            })}
          </ul>
        ) : (
          <Vazio>Ninguém para falar hoje. Cadastre um restaurante novo ou veja a coluna Prospect em Clientes.</Vazio>
        )}
      </Cartao>

      <Cartao
        titulo="Os agentes sugerem"
        acao={(total.count ?? 0) > 3 && <Link href="/propostas" className="flex items-center gap-1 text-xs text-suave">ver todas ({total.count}) <ArrowRight size={12} /></Link>}
      >
        {sugestoes.length ? (
          <div className="space-y-3">{sugestoes.map((p) => <CartaoProposta key={p.id} p={p} contato={contatoDe(contatos, p.alvo)} />)}</div>
        ) : (
          <Vazio>Nada pendente. Os agentes trazem sugestões todo dia às 5h.</Vazio>
        )}
      </Cartao>

      <CasasForjaOS r={await osP} compacto />

      {resumo && (
        <details className="rounded-cartao border border-linha bg-painel p-4 shadow-cartao">
          <summary className="cursor-pointer text-sm font-semibold">Resumo do dia (Diretor de Gestão)</summary>
          <div className="md mt-3 text-sm leading-relaxed text-suave"><ReactMarkdown remarkPlugins={[remarkGfm]}>{resumo}</ReactMarkdown></div>
        </details>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, sub, href }: { rotulo: string; valor: string; sub?: string; href?: string }) {
  const corpo = (
    <div className="h-full rounded-cartao border border-linha bg-painel p-3 shadow-cartao">
      <div className="text-[12px] font-medium leading-tight text-suave">{rotulo}</div>
      <div className="num mt-1 text-[20px] font-bold leading-tight tracking-[-0.03em] md:text-[24px]">{valor}</div>
      {sub && <div className="mt-0.5 text-[11px] text-apagado">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{corpo}</Link> : corpo;
}
