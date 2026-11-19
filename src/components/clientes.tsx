"use client";
import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { MessageCircle, Search, Send } from "lucide-react";
import { moverColuna } from "@/app/acoes";
import { COLUNAS, linkIg, linkWa, type ColunaK } from "@/lib/funil";
import { Selo } from "./ui";

export type ItemCliente = {
  id: number;
  nome: string;
  sub: string;
  coluna: ColunaK;
  whatsapp: string | null;
  instagram: string | null;
  estadoOS?: "ok" | "at" | "cr" | null;
};

const ESTADO = { ok: ["ok", "no alvo"], at: ["atencao", "atenção"], cr: ["critico", "crítico"] } as const;

/** Quadro em 4 colunas. No celular, uma coluna por vez (abas); no computador, as 4 lado a lado. */
export function QuadroClientes({ itens }: { itens: ItemCliente[] }) {
  const [aba, setAba] = useState<ColunaK>("prospect");
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return b ? itens.filter((i) => i.nome.toLowerCase().includes(b) || i.sub.toLowerCase().includes(b)) : itens;
  }, [itens, busca]);
  const por = (k: ColunaK) => filtrados.filter((i) => i.coluna === k);

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar restaurante ou bairro" className="campo !pl-9 text-base md:text-sm" />
      </label>

      {/* Celular: abas */}
      <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-[rgba(20,16,14,0.05)] p-1 md:hidden">
        {COLUNAS.map((c) => (
          <button key={c.k} type="button" onClick={() => setAba(c.k)}
            className={clsx("rounded-[9px] px-1 py-2 text-[12.5px] font-semibold leading-tight", aba === c.k ? "bg-white text-texto shadow-[0_1px_2px_rgba(20,16,14,0.12)]" : "text-suave")}>
            {c.t}
            <span className="num block text-[15px]">{por(c.k).length}</span>
          </button>
        ))}
      </div>
      <div className="md:hidden">
        <Coluna k={aba} itens={por(aba)} />
      </div>

      {/* Computador: 4 colunas */}
      <div className="hidden gap-4 md:grid md:grid-cols-4">
        {COLUNAS.map((c) => (
          <div key={c.k} className="min-w-0 rounded-cartao bg-[rgba(20,16,14,0.035)] p-2.5">
            <div className="flex items-baseline justify-between px-1.5 pb-2">
              <h2 className="text-sm font-[650]">{c.t}</h2>
              <span className="num text-sm text-suave">{por(c.k).length}</span>
            </div>
            <Coluna k={c.k} itens={por(c.k)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Coluna({ k, itens }: { k: ColunaK; itens: ItemCliente[] }) {
  const c = COLUNAS.find((x) => x.k === k)!;
  if (!itens.length) return <p className="px-2 py-6 text-center text-sm text-apagado">Ninguém em {c.t.toLowerCase()}.</p>;
  return <ul className="space-y-2">{itens.map((i) => <Cartao key={i.id} i={i} />)}</ul>;
}

function Cartao({ i }: { i: ItemCliente }) {
  const [pend, iniciar] = useTransition();
  const wa = linkWa(i.whatsapp);
  const ig = linkIg(i.instagram);
  return (
    <li className={clsx("rounded-[12px] border border-linha bg-painel p-3 shadow-cartao", pend && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{i.nome}</div>
          {i.sub && <div className="truncate text-xs text-suave">{i.sub}</div>}
        </div>
        {i.estadoOS && i.estadoOS in ESTADO && <Selo tom={ESTADO[i.estadoOS][0]}>{ESTADO[i.estadoOS][1]}</Selo>}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-[10px] border border-linha text-ok" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
        {ig && <a href={ig} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-[10px] border border-linha text-[#b1306e]" aria-label="Instagram"><Send size={17} /></a>}
        <select aria-label="Mover para" disabled={pend} value={i.coluna} onChange={(e) => iniciar(() => moverColuna(i.id, e.target.value))}
          className="campo ml-auto !w-auto !py-2 text-sm">
          {COLUNAS.map((c) => <option key={c.k} value={c.k}>{c.t}</option>)}
          <option value="perdido">Perdido</option>
        </select>
      </div>
    </li>
  );
}
