"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Gráficos do financeiro. Cores validadas (par categórico padrão): entradas azul, saídas laranja.
   Texto sempre em tinta de texto, nunca na cor da série. Hover/toque mostra o valor. */
const AZUL = "#2a78d6";
const LARANJA = "#eb6834";
const GRADE = "rgba(20,16,14,0.08)";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compacto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));
const nomeMes = (m: string) => new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)).replace(".", "");

/** Largura real do contêiner, para o texto do gráfico ficar no tamanho certo no celular. */
function useLargura(padrao: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [l, setL] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setL(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, l] as const;
}

function escala(max: number) {
  if (max <= 0) return [0, 1000];
  const passo = 10 ** Math.floor(Math.log10(max));
  const topo = Math.ceil(max / passo) * passo;
  return [0, topo];
}

export type Mes = { mes: string; a: number; b: number };

/** Colunas lado a lado por mês (entradas x saídas). Toque numa coluna seleciona o mês. */
export function ColunasMes({ dados, rotuloA, rotuloB, selecionado }: { dados: Mes[]; rotuloA: string; rotuloB: string; selecionado?: string }) {
  const r = useRouter();
  const [foco, setFoco] = useState<number | null>(null);
  const [ref, L] = useLargura(640);
  const A = 220, esq = 44, base = A - 26, topo = 12;
  const [, max] = escala(Math.max(...dados.flatMap((d) => [d.a, d.b]), 0));
  const y = (v: number) => base - (v / max) * (base - topo);
  const banda = (L - esq) / dados.length;
  const larg = Math.min(18, banda / 3);
  const ticks = [0, max / 2, max];
  const f = foco != null ? dados[foco] : null;

  return (
    <div ref={ref} className="relative">
      <Legenda itens={[[AZUL, rotuloA], [LARANJA, rotuloB]]} />
      <svg viewBox={`0 0 ${L} ${A}`} className="mt-2 w-full" role="img" aria-label={`${rotuloA} e ${rotuloB} por mês`} onMouseLeave={() => setFoco(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={esq} x2={L} y1={y(t)} y2={y(t)} stroke={GRADE} strokeWidth={1} />
            <text x={esq - 6} y={y(t) + 4} textAnchor="end" className="fill-[#6f6a64] text-[11px]">{compacto(t)}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const cx = esq + banda * i + banda / 2;
          const sel = d.mes === selecionado;
          return (
            <g key={d.mes} onMouseEnter={() => setFoco(i)} onClick={() => r.push(`?m=${d.mes}`, { scroll: false })} className="cursor-pointer">
              <rect x={cx - banda / 2} y={topo} width={banda} height={base - topo + 22} fill={foco === i || sel ? "rgba(20,16,14,0.035)" : "transparent"} />
              <Coluna x={cx - larg - 1} y={y(d.a)} w={larg} h={base - y(d.a)} cor={AZUL} />
              <Coluna x={cx + 1} y={y(d.b)} w={larg} h={base - y(d.b)} cor={LARANJA} />
              <text x={cx} y={A - 8} textAnchor="middle" className={sel ? "fill-[#14100e] text-[12px] font-semibold" : "fill-[#6f6a64] text-[12px]"}>{nomeMes(d.mes)}</text>
            </g>
          );
        })}
        <line x1={esq} x2={L} y1={base} y2={base} stroke="rgba(20,16,14,0.2)" strokeWidth={1} />
      </svg>
      {f && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-[10px] border border-linha bg-white px-3 py-2 text-xs shadow-cartao">
          <div className="font-semibold capitalize">{nomeMes(f.mes)}</div>
          <div className="mt-0.5 flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: AZUL }} /> {rotuloA}: <b className="num">{BRL.format(f.a)}</b></div>
          <div className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: LARANJA }} /> {rotuloB}: <b className="num">{BRL.format(f.b)}</b></div>
          <div className="mt-0.5 text-suave">Diferença: <b className="num text-texto">{BRL.format(f.a - f.b)}</b></div>
        </div>
      )}
    </div>
  );
}

function Coluna({ x, y, w, h, cor }: { x: number; y: number; w: number; h: number; cor: string }) {
  if (h <= 0.5) return null;
  const r = Math.min(4, h);
  return <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`} fill={cor} />;
}

/** Linha do saldo de caixa, com cruz e valor ao passar o dedo. */
export function LinhaSaldo({ dados }: { dados: { mes: string; v: number }[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [ref, L] = useLargura(400);
  const A = 180, esq = 44, base = A - 26, topo = 14;
  const min = Math.min(0, ...dados.map((d) => d.v));
  const [, maxR] = escala(Math.max(...dados.map((d) => d.v), 0));
  const max = maxR || 1;
  const y = (v: number) => base - ((v - min) / (max - min)) * (base - topo);
  const x = (i: number) => esq + ((L - esq - 16) * i) / Math.max(1, dados.length - 1) + 8;
  const pts = dados.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  const f = foco != null ? dados[foco] : null;
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label="Saldo de caixa no fim de cada mês" onMouseLeave={() => setFoco(null)}>
        {[min, (min + max) / 2, max].map((t) => (
          <g key={t}>
            <line x1={esq} x2={L} y1={y(t)} y2={y(t)} stroke={GRADE} />
            <text x={esq - 6} y={y(t) + 4} textAnchor="end" className="fill-[#6f6a64] text-[11px]">{compacto(t)}</text>
          </g>
        ))}
        {min < 0 && <line x1={esq} x2={L} y1={y(0)} y2={y(0)} stroke="rgba(20,16,14,0.3)" />}
        <polygon points={`${x(0)},${y(Math.max(min, 0))} ${pts} ${x(dados.length - 1)},${y(Math.max(min, 0))}`} fill={AZUL} opacity={0.1} />
        <polyline points={pts} fill="none" stroke={AZUL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {foco != null && <line x1={x(foco)} x2={x(foco)} y1={topo} y2={base} stroke="rgba(20,16,14,0.25)" />}
        {dados.map((d, i) => (
          <g key={d.mes} onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)}>
            <rect x={x(i) - 24} y={topo} width={48} height={base - topo + 20} fill="transparent" />
            {(i === dados.length - 1 || foco === i) && <circle cx={x(i)} cy={y(d.v)} r={4.5} fill={AZUL} stroke="#fff" strokeWidth={2} />}
            <text x={x(i)} y={A - 8} textAnchor="middle" className="fill-[#6f6a64] text-[12px]">{nomeMes(d.mes)}</text>
          </g>
        ))}
        {dados.length > 0 && foco == null && (
          <text x={x(dados.length - 1) - 8} y={y(dados[dados.length - 1].v) - 10} textAnchor="end" className="fill-[#14100e] text-[12px] font-semibold">{BRL.format(dados[dados.length - 1].v)}</text>
        )}
      </svg>
      {f && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-[10px] border border-linha bg-white px-3 py-2 text-xs shadow-cartao">
          <span className="capitalize">{nomeMes(f.mes)}</span>: <b className="num">{BRL.format(f.v)}</b>
        </div>
      )}
    </div>
  );
}

/** Barras horizontais de uma série só (despesas por categoria). */
export function BarrasCategoria({ itens }: { itens: { t: string; v: number }[] }) {
  const max = Math.max(...itens.map((i) => i.v), 1);
  if (!itens.length) return <p className="py-4 text-center text-sm text-apagado">Sem saídas neste mês.</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.t} title={`${i.t}: ${BRL.format(i.v)}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{i.t}</span>
            <span className="num shrink-0 font-semibold">{BRL.format(i.v)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[rgba(20,16,14,0.05)]">
            <div className="h-2 rounded-full" style={{ width: `${(i.v / max) * 100}%`, background: LARANJA }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Legenda({ itens }: { itens: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-suave">
      {itens.map(([c, t]) => (
        <span key={t} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} /> {t}</span>
      ))}
    </div>
  );
}
