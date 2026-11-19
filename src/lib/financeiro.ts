/**
 * Financeiro da Forja (Simples Nacional).
 * Regra do sistema: a RECEITA da DRE vem de recebimentos (o que foi vendido e recebido, inclusive Hotmart);
 * custos e despesas vêm das SAÍDAS do extrato. O caixa (DFC) usa o extrato inteiro.
 */

export type Grupo = "receita" | "imposto" | "custo" | "despesa" | "pro_labore" | "financeiro" | "investimento" | "transferencia" | "a_classificar";

export const CATEGORIAS: { k: string; t: string; g: Grupo; dica: string }[] = [
  { k: "receita_cliente", t: "Recebido de cliente", g: "receita", dica: "pix/TED de restaurante, consultoria, implantação, Care" },
  { k: "receita_digital", t: "Venda digital (Hotmart)", g: "receita", dica: "repasse da Hotmart, fichas, cursos" },
  { k: "outras_entradas", t: "Outras entradas", g: "receita", dica: "reembolso, rendimento, venda de algo" },
  { k: "simples_das", t: "Simples Nacional (DAS)", g: "imposto", dica: "guia DAS, Receita Federal" },
  { k: "custo_deslocamento", t: "Deslocamento até clientes", g: "custo", dica: "combustível, Uber, 99, estacionamento" },
  { k: "custo_terceiros", t: "Terceiros e freelas", g: "custo", dica: "pagamento a pessoa que ajudou num projeto" },
  { k: "custo_material", t: "Material para clientes", g: "custo", dica: "impressão, etiquetas, insumos de teste" },
  { k: "taxa_plataforma", t: "Taxas de venda", g: "custo", dica: "taxa Hotmart, maquininha, gateway" },
  { k: "ferramentas", t: "Ferramentas e sistemas", g: "despesa", dica: "Vercel, Supabase, Claude, Canva, Google, domínio" },
  { k: "marketing", t: "Marketing e anúncios", g: "despesa", dica: "Meta Ads, Google Ads, impulsionamento, brindes" },
  { k: "contador", t: "Contador", g: "despesa", dica: "honorários contábeis" },
  { k: "telefone_internet", t: "Telefone e internet", g: "despesa", dica: "operadora, plano de celular" },
  { k: "alimentacao", t: "Alimentação", g: "despesa", dica: "refeição em horário de trabalho" },
  { k: "administrativo", t: "Outras despesas", g: "despesa", dica: "cartório, correio, material de escritório" },
  { k: "pro_labore", t: "Pró-labore e retiradas", g: "pro_labore", dica: "o que o Gabriel tira para si" },
  { k: "tarifa_bancaria", t: "Tarifas do banco", g: "financeiro", dica: "tarifa, pacote, TED" },
  { k: "juros_multas", t: "Juros e multas", g: "financeiro", dica: "juros de atraso, IOF, multa" },
  { k: "investimento", t: "Investimento (equipamento)", g: "investimento", dica: "notebook, celular, balança, curso para a Forja" },
  { k: "transferencia", t: "Transferência própria", g: "transferencia", dica: "entre contas suas, aporte, aplicação e resgate" },
  { k: "a_classificar", t: "A classificar", g: "a_classificar", dica: "" },
];

export const CAT = new Map(CATEGORIAS.map((c) => [c.k, c]));
export const grupoDe = (k: string): Grupo => CAT.get(k)?.g ?? "a_classificar";

export type LinhaExtrato = { ref: string; data: string; descricao: string; valor: number };
export type Extrato = { linhas: LinhaExtrato[]; saldo?: number; saldoData?: string; erro?: string };

/** Hash curto e estável para linhas sem FITID (CSV). */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const dataOfx = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

export function lerOFX(texto: string): Extrato {
  const tag = (bloco: string, t: string) => new RegExp(`<${t}>([^<\\r\\n]+)`, "i").exec(bloco)?.[1]?.trim();
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const linhas = blocos.map((b) => {
    const data = dataOfx(tag(b, "DTPOSTED") ?? "");
    const valor = Number((tag(b, "TRNAMT") ?? "0").replace(",", "."));
    const descricao = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" · ") || "sem descrição";
    const ref = "ofx:" + (tag(b, "FITID") ?? hash(data + valor + descricao));
    return { ref, data, descricao, valor };
  }).filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.data) && !Number.isNaN(l.valor) && l.valor !== 0);
  const bal = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)[\s\S]*?<DTASOF>(\d{8})/i.exec(texto);
  return { linhas, saldo: bal ? Number(bal[1].replace(",", ".")) : undefined, saldoData: bal ? dataOfx(bal[2]) : undefined };
}

/** Número brasileiro ("1.234,56", "-50,00", "R$ 10,00 D") ou americano ("1234.56"). */
function numero(v: string): number | null {
  let s = v.replace(/R\$|\s/g, "");
  if (!s) return null;
  const negativo = /^-|\(.*\)|D$/i.test(s);
  s = s.replace(/[()DC+-]/gi, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -Math.abs(n) : n) : null;
}

function data(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{2,4})/.exec(s);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function dividir(linha: string, sep: string) {
  const out: string[] = [];
  let atual = "", aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

/** CSV de banco: acha sozinho as colunas de data, descrição e valor (ou débito/crédito). */
export function lerCSV(texto: string): Extrato {
  const brutas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (brutas.length < 2) return { linhas: [], erro: "Arquivo vazio." };
  const sep = [";", ",", "\t"].sort((a, b) => brutas[0].split(b).length - brutas[0].split(a).length)[0];
  const tabela = brutas.map((l) => dividir(l, sep));
  const inicio = tabela.findIndex((r) => r.some((c) => data(c)));
  if (inicio < 0) return { linhas: [], erro: "Não achei coluna de data." };
  const cab = (tabela[inicio - 1] ?? []).map((c) => c.toLowerCase());
  const corpo = tabela.slice(inicio).filter((r) => r.some((c) => data(c)));
  const ncol = Math.max(...corpo.map((r) => r.length));
  const col = (teste: (c: string) => boolean) => [...Array(ncol).keys()].filter((i) => corpo.filter((r) => r[i] && teste(r[i])).length >= corpo.length * 0.6);
  const iData = col((c) => !!data(c))[0];
  const numericas = col((c) => numero(c) !== null && /\d/.test(c) && !data(c));
  const iDeb = cab.findIndex((c) => /d[eé]bito|sa[ií]da/.test(c));
  const iCred = cab.findIndex((c) => /cr[eé]dito|entrada/.test(c));
  const iValorCab = cab.findIndex((c) => /^valor|valor \(r\$\)|quantia|montante/.test(c));
  const iSaldo = cab.findIndex((c) => /saldo/.test(c));
  const iValor = iValorCab >= 0 ? iValorCab : numericas.filter((i) => i !== iSaldo)[0];
  const texto_ = [...Array(ncol).keys()].filter((i) => i !== iData && !numericas.includes(i));
  const iDesc = texto_.sort((a, b) => corpo.reduce((s, r) => s + (r[b]?.length ?? 0), 0) - corpo.reduce((s, r) => s + (r[a]?.length ?? 0), 0))[0];

  const linhas: LinhaExtrato[] = [];
  corpo.forEach((r, n) => {
    const d = data(r[iData] ?? "");
    let v: number | null = null;
    if (iDeb >= 0 && iCred >= 0) {
      const deb = numero(r[iDeb] ?? ""), cred = numero(r[iCred] ?? "");
      v = cred ? Math.abs(cred) : deb ? -Math.abs(deb) : null;
    } else if (iValor !== undefined) v = numero(r[iValor] ?? "");
    const desc = (iDesc !== undefined ? r[iDesc] : "") || "sem descrição";
    if (d && v) linhas.push({ ref: "csv:" + hash(`${d}|${v}|${desc}|${n}`), data: d, descricao: desc, valor: v });
  });
  return linhas.length ? { linhas } : { linhas: [], erro: "Não achei as colunas de valor." };
}

export function lerExtrato(nome: string, texto: string): Extrato {
  return /<OFX>|OFXHEADER/i.test(texto) || /\.ofx$/i.test(nome) ? lerOFX(texto) : lerCSV(texto);
}

/* ---------------- Contas (DRE, DFC, KPIs) ---------------- */

export type Receb = { data: string; valor: number; linha: string | null };
export type Lanc = { data: string; valor: number; categoria: string };

export const mesDe = (d: string) => d.slice(0, 7);

export function ultimosMeses(ref: string, n: number) {
  const [a, m] = ref.split("-").map(Number);
  return [...Array(n).keys()].reverse().map((i) => {
    const dt = new Date(Date.UTC(a, m - 1 - i, 1));
    return dt.toISOString().slice(0, 7);
  });
}

export type DRE = {
  receita: number; receitaClientes: number; receitaDigital: number; receitaOutras: number;
  imposto: number; impostoEstimado: boolean; receitaLiquida: number;
  custos: number; lucroBruto: number; margemBruta: number | null;
  despesas: number; proLabore: number; resultadoOperacional: number;
  financeiro: number; lucroLiquido: number; margemLiquida: number | null;
  porCategoria: Map<string, number>; aClassificar: number;
};

/** DRE de um mês. Imposto: o DAS pago no mês; se não houver, estimado pela alíquota sobre a receita. */
export function dre(mes: string, receb: Receb[], lanc: Lanc[], aliquota: number): DRE {
  const r = receb.filter((x) => mesDe(x.data) === mes);
  const l = lanc.filter((x) => mesDe(x.data) === mes);
  const porCategoria = new Map<string, number>();
  l.forEach((x) => porCategoria.set(x.categoria, (porCategoria.get(x.categoria) ?? 0) + Number(x.valor)));
  const saida = (g: Grupo) => -l.filter((x) => grupoDe(x.categoria) === g && x.valor < 0).reduce((s, x) => s + Number(x.valor), 0);

  const receitaDigital = r.filter((x) => x.linha === "digital").reduce((s, x) => s + Number(x.valor), 0);
  const receitaClientes = r.filter((x) => x.linha !== "digital").reduce((s, x) => s + Number(x.valor), 0);
  // Entradas do extrato marcadas "outras" entram; as de cliente/digital já estão em recebimentos.
  const receitaOutras = l.filter((x) => x.categoria === "outras_entradas" && x.valor > 0).reduce((s, x) => s + Number(x.valor), 0);
  const receita = receitaClientes + receitaDigital + receitaOutras;
  const das = saida("imposto");
  const impostoEstimado = das === 0 && receita > 0;
  const imposto = impostoEstimado ? receita * aliquota : das;
  const receitaLiquida = receita - imposto;
  const custos = saida("custo");
  const lucroBruto = receitaLiquida - custos;
  const despesas = saida("despesa");
  const proLabore = saida("pro_labore");
  const resultadoOperacional = lucroBruto - despesas - proLabore;
  const financeiro = saida("financeiro");
  const lucroLiquido = resultadoOperacional - financeiro;
  const pct = (v: number) => (receita > 0 ? (v / receita) * 100 : null);
  return {
    receita, receitaClientes, receitaDigital, receitaOutras, imposto, impostoEstimado, receitaLiquida,
    custos, lucroBruto, margemBruta: pct(lucroBruto), despesas, proLabore, resultadoOperacional,
    financeiro, lucroLiquido, margemLiquida: pct(lucroLiquido), porCategoria,
    aClassificar: l.filter((x) => x.categoria === "a_classificar").length,
  };
}

/**
 * Caixa por mês a partir do extrato. Âncora: o saldo que o banco informou numa data (OFX traz).
 * saldo(t) = saldoBanco + Σ lançamentos até t − Σ lançamentos até a data do saldo.
 */
export function caixaMensal(meses: string[], lanc: Lanc[], saldoBanco: number, saldoData: string | null) {
  const ate = (t: string) => lanc.filter((x) => x.data <= t).reduce((s, x) => s + Number(x.valor), 0);
  const base = saldoBanco - (saldoData ? ate(saldoData) : 0);
  return meses.map((m) => {
    const doMes = lanc.filter((x) => mesDe(x.data) === m);
    const entradas = doMes.filter((x) => x.valor > 0).reduce((s, x) => s + Number(x.valor), 0);
    const saidas = -doMes.filter((x) => x.valor < 0).reduce((s, x) => s + Number(x.valor), 0);
    return { mes: m, entradas, saidas, saldo: base + ate(`${m}-31`) };
  });
}

