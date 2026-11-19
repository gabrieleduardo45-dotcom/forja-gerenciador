"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Search } from "lucide-react";
import { classeBotao } from "./ui";

export function BotaoRodar({ apenas, rotulo = "Rodar agentes", modo, variante = "primario" }: { apenas?: string[]; rotulo?: string; modo?: "prospectar"; variante?: "primario" | "secundario" }) {
  const r = useRouter();
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rodar() {
    setRodando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/rodada", { method: "POST", body: JSON.stringify({ apenas, modo }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.erro ?? "Falhou");
      const n = j.setores.reduce((a: number, s: { propostas: number }) => a + s.propostas, 0);
      setMsg(modo === "prospectar" ? (n ? `${n} casas novas na fila de aprovação` : "Nenhuma casa nova boa hoje") : `${j.setores.length} setores rodaram · ${n} propostas novas`);
      r.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falhou");
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-suave">{msg}</span>}
      <button onClick={rodar} disabled={rodando} className={classeBotao(variante)}>
        {rodando ? <Loader2 size={16} className="animate-spin" /> : modo === "prospectar" ? <Search size={16} /> : <Play size={16} />}
        {rodando ? (modo === "prospectar" ? "Pesquisando…" : "Agentes trabalhando…") : rotulo}
      </button>
    </div>
  );
}
