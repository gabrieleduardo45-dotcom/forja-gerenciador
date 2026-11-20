"use client";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { enviarCatalogoOS } from "@/app/acoes";
import { classeBotao } from "./ui";

export function EnviarCatalogo() {
  const [pend, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-critico"}`}>{msg.t}</span>}
      <button type="button" disabled={pend} onClick={() => iniciar(async () => { const r = await enviarCatalogoOS(); setMsg({ ok: r.ok, t: r.msg }); })} className={classeBotao()}>
        <Send size={16} /> {pend ? "Enviando…" : "Enviar ao FORJA OS"}
      </button>
    </div>
  );
}
