import { QuadroClientes, type ItemCliente } from "@/components/clientes";
import { NovoRestaurante } from "@/components/formularios";
import { Pagina } from "@/components/ui";
import { casasDoForjaOS } from "@/lib/forja-os";
import { colunaDe, normalizar } from "@/lib/funil";
import { usuarioAtual } from "@/lib/supabase/server";

export const metadata = { title: "Clientes" };

export default async function Clientes() {
  const { sb } = await usuarioAtual();
  const osP = casasDoForjaOS();
  const { data } = await sb
    .from("prospects")
    .select("id,nome_casa,bairro,setor,estagio,whatsapp_decisor,instagram_casa,instagram_decisor,atualizado_em")
    .not("estagio", "in", "(perdido,descartado)")
    .order("atualizado_em", { ascending: false })
    .limit(500);
  const os = await osP;
  const estadoPorNome = new Map(os.casas.map((c) => [normalizar(c.nome), c.estado as ItemCliente["estadoOS"]]));

  const itens: ItemCliente[] = (data ?? []).flatMap((p) => {
    const coluna = colunaDe(p.estagio);
    if (!coluna) return [];
    return [{
      id: p.id,
      nome: p.nome_casa,
      sub: [p.bairro, p.setor && p.setor !== "outro" ? p.setor.replace(/_/g, " ") : null].filter(Boolean).join(" · "),
      coluna,
      whatsapp: p.whatsapp_decisor,
      instagram: p.instagram_casa ?? p.instagram_decisor,
      estadoOS: coluna === "cliente" ? estadoPorNome.get(normalizar(p.nome_casa)) ?? null : null,
    }];
  });

  return (
    <Pagina titulo="Clientes" sub="Do primeiro contato ao cliente. Toque em “Mover para” quando mudar de fase." acoes={<NovoRestaurante />}>
      <QuadroClientes itens={itens} />
    </Pagina>
  );
}
