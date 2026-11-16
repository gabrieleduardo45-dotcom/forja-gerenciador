import {
  BookOpen, ChefHat, ClipboardCheck, Compass, Megaphone, MessageCircle, MousePointerClick,
  Rocket, Scale, ShieldCheck, Target, Users, Wallet, Bot, type LucideProps,
} from "lucide-react";

const MAPA = { BookOpen, ChefHat, ClipboardCheck, Compass, Megaphone, MessageCircle, MousePointerClick, Rocket, Scale, ShieldCheck, Target, Users, Wallet };

export function Icone({ nome, ...p }: { nome?: string } & LucideProps) {
  const C = (nome && MAPA[nome as keyof typeof MAPA]) || Bot;
  return <C {...p} />;
}
