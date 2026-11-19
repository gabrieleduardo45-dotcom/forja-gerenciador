"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { classeBotao } from "./ui";

/** Cada lugar onde o link aparece ganha a sua marca (utm). Assim o Painel mostra de onde veio cada visita. */
const LUGARES = [
  { t: "Bio do Instagram", s: "instagram", m: "bio" },
  { t: "Stories", s: "instagram", m: "stories" },
  { t: "Direct do Instagram", s: "instagram", m: "direct" },
  { t: "Status do WhatsApp", s: "whatsapp", m: "status" },
  { t: "Conversa no WhatsApp", s: "whatsapp", m: "conversa" },
  { t: "Indicação de cliente", s: "indicacao", m: "cliente" },
  { t: "Anúncio Meta (Insta/Face)", s: "meta", m: "anuncio" },
  { t: "Google (perfil da empresa)", s: "google", m: "perfil" },
  { t: "QR code impresso", s: "qrcode", m: "impresso" },
];

export function LinksMarcados({ base: baseInicial = "https://forjaconsultoria.com" }: { base?: string }) {
  const [base, setBase] = useState(baseInicial);
  const [campanha, setCampanha] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  function link(s: string, m: string) {
    try {
      const u = new URL(base);
      u.searchParams.set("utm_source", s);
      u.searchParams.set("utm_medium", m);
      if (campanha.trim()) u.searchParams.set("utm_campaign", campanha.trim().toLowerCase().replace(/\s+/g, "-"));
      return u.toString();
    } catch {
      return "";
    }
  }

  async function copiar(chave: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(null), 1500);
  }

  const campo = "w-full rounded-campo border border-linha-forte bg-white px-3 py-2 text-[15px] md:text-sm";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-medium text-suave">
          Endereço da página de vendas
          <input className={campo + " mt-1"} value={base} onChange={(e) => setBase(e.target.value)} inputMode="url" />
        </label>
        <label className="block text-[13px] font-medium text-suave">
          Campanha (opcional, ex.: novembro)
          <input className={campo + " mt-1"} value={campanha} onChange={(e) => setCampanha(e.target.value)} />
        </label>
      </div>
      <ul className="divide-y divide-[rgba(20,16,14,0.06)]">
        {LUGARES.map((l) => {
          const k = `${l.s}-${l.m}`;
          const url = link(l.s, l.m);
          return (
            <li key={k} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{l.t}</div>
                <div className="truncate text-xs text-apagado">{url || "endereço inválido"}</div>
              </div>
              <button type="button" disabled={!url} onClick={() => copiar(k, url)} className={classeBotao("secundario")}>
                {copiado === k ? <Check size={15} /> : <Copy size={15} />}
                {copiado === k ? "Copiado" : "Copiar"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-suave">Use sempre o link do lugar certo. Em uns dias o Painel mostra, em &quot;Visitas da página por origem&quot;, qual lugar traz mais gente e qual leva ao WhatsApp.</p>
    </div>
  );
}
