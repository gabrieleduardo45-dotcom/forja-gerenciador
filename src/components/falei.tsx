"use client";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { faleiHoje } from "@/app/acoes";
import { classeBotao } from "./ui";

export function Falei({ id, canal }: { id: number; canal: "whatsapp" | "instagram" }) {
  const [pend, iniciar] = useTransition();
  return (
    <button type="button" disabled={pend} onClick={() => iniciar(() => faleiHoje(id, canal))} className={classeBotao("secundario")}>
      <Check size={16} /> {pend ? "…" : "Falei"}
    </button>
  );
}
