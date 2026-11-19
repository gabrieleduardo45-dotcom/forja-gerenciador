"use client";
/* Prévias locais (blob:), next/image não se aplica. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { analisarFotos, casasParaLancar, salvarDesperdicio, type LeituraFoto, type RegistroDesperdicio } from "@/app/acoes";
import { Modal } from "./formularios";
import { classeBotao } from "./ui";

const LADO = 1280;

/** Reduz a foto no próprio celular (iPhone manda 3 a 5 MB; aqui vira ~200 KB). */
async function reduzir(arq: File): Promise<Blob> {
  const bmp = await createImageBitmap(arq);
  const k = Math.min(1, LADO / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.78));
}

type Linha = RegistroDesperdicio & { chave: string; previa: string };

export function SobraDescarte({ variante = "primario", classe }: { variante?: "primario" | "secundario"; classe?: string }) {
  return (
    <Modal rotulo="Sobra e descarte (fotos)" titulo="Sobra e descarte" variante={variante} classe={classe}>
      {(fechar) => <Fluxo fechar={fechar} />}
    </Modal>
  );
}

function Fluxo({ fechar }: { fechar: () => void }) {
  const [casas, setCasas] = useState<{ id: string; nome: string }[]>([]);
  const [casa, setCasa] = useState("");
  const [legenda, setLegenda] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pend, iniciar] = useTransition();

  useEffect(() => {
    casasParaLancar().then(setCasas).catch(() => setCasas([]));
  }, []);

  const previas = useMemo(() => arquivos.map((a) => URL.createObjectURL(a)), [arquivos]);
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas]);

  function ler() {
    if (!casa.trim()) return setMsg({ ok: false, t: "Escolha a casa." });
    if (!arquivos.length) return setMsg({ ok: false, t: "Escolha as fotos." });
    setMsg(null);
    iniciar(async () => {
      const f = new FormData();
      f.set("casa_nome", casa);
      if (legenda) f.set("legenda", legenda);
      for (const a of arquivos) f.append("fotos", await reduzir(a), "foto.jpg");
      const r = await analisarFotos(f).catch((e) => ({ ok: false, msg: String(e), leituras: [] as LeituraFoto[] }));
      if (!r.ok) return setMsg({ ok: false, t: r.msg });
      const id = casas.find((c) => c.nome === casa)?.id ?? null;
      setLinhas(
        r.leituras.flatMap((l, i) =>
          (l.itens.length ? l.itens : [{ item: "", tipo: "descarte" as const, peso_kg: null, peso_fonte: null, motivo: l.erro ?? "não consegui ler", confianca: 0 }]).map((it, j) => ({
            ...it,
            chave: `${i}-${j}`,
            previa: previas[i],
            foto: l.foto || null,
            casa_nome: casa,
            casa_os_id: id,
          })),
        ),
      );
      setMsg({ ok: true, t: r.msg });
    });
  }

  function mudar(chave: string, campos: Partial<Linha>) {
    setLinhas((ls) => ls!.map((l) => (l.chave === chave ? { ...l, ...campos } : l)));
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarDesperdicio(linhas!.map((l) => ({ casa_os_id: l.casa_os_id, casa_nome: l.casa_nome, item: l.item, tipo: l.tipo, peso_kg: l.peso_kg, peso_fonte: l.peso_fonte, motivo: l.motivo, foto: l.foto, confianca: l.confianca })));
      setMsg({ ok: r.ok, t: r.msg });
      if (r.ok) setTimeout(fechar, 1400);
    });
  }

  const campo = "campo text-base md:text-sm";
  if (!linhas)
    return (
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-suave">Casa</span>
          <input list="casas-os" className={campo} value={casa} onChange={(e) => setCasa(e.target.value)} placeholder="Nome da casa" />
          <datalist id="casas-os">{casas.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-suave">Legenda (opcional): ex. &quot;tudo sobra do almoço&quot;</span>
          <input className={campo} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
        </label>
        <label className={`${classeBotao("secundario")} w-full !py-4`}>
          <Camera size={18} /> {arquivos.length ? `${arquivos.length} fotos escolhidas` : "Escolher fotos"}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setArquivos([...(e.target.files ?? [])].slice(0, 10))} />
        </label>
        {previas.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5">
            {previas.map((u) => <img key={u} src={u} alt="" className="aspect-square w-full rounded-md object-cover" />)}
          </div>
        )}
        <p className="text-xs text-suave">Dica: peça para a cozinha fotografar com a balança aparecendo. A IA lê o peso no visor.</p>
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm ${msg?.ok ? "text-ok" : "text-critico"}`}>{msg?.t}</span>
          <button type="button" onClick={ler} disabled={pend} className={classeBotao()}>
            {pend ? <><Loader2 size={16} className="animate-spin" /> Lendo fotos…</> : "Ler com IA"}
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {linhas.map((l) => (
          <li key={l.chave} className="flex gap-3 rounded-[12px] border border-linha p-2.5">
            <img src={l.previa} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <input className={`${campo} !py-1.5`} value={l.item} placeholder="O que é" onChange={(e) => mudar(l.chave, { item: e.target.value })} />
              <div className="flex items-center gap-1.5">
                {(["sobra", "descarte"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => mudar(l.chave, { tipo: t })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${l.tipo === t ? (t === "sobra" ? "bg-[rgba(154,91,0,0.14)] text-atencao" : "bg-[rgba(180,35,24,0.10)] text-critico") : "bg-[rgba(20,16,14,0.05)] text-suave"}`}>
                    {t}
                  </button>
                ))}
                <input inputMode="decimal" className={`${campo} !w-20 !py-1 text-right`} value={l.peso_kg ?? ""} placeholder="kg"
                  onChange={(e) => { const v = e.target.value.replace(",", "."); mudar(l.chave, { peso_kg: v === "" ? null : Number(v), peso_fonte: "informado" }); }} />
                <span className="text-xs text-apagado">kg</span>
                <button type="button" aria-label="Tirar" onClick={() => setLinhas((ls) => ls!.filter((x) => x.chave !== l.chave))} className="ml-auto p-1 text-apagado"><Trash2 size={15} /></button>
              </div>
              <div className="text-xs text-suave">
                {l.peso_fonte === "balanca" ? "peso da balança" : l.peso_fonte === "estimado" ? "peso estimado" : ""}
                {l.motivo ? ` · ${l.motivo}` : ""}
                {(l.confianca ?? 1) < 0.6 && <span className="font-semibold text-atencao"> · confira</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm ${msg?.ok ? "text-ok" : "text-critico"}`}>{msg?.t}</span>
        <button type="button" onClick={salvar} disabled={pend || !linhas.length} className={classeBotao()}>{pend ? "Salvando…" : "Salvar"}</button>
      </div>
    </div>
  );
}
