// Notícias da semana: lê os feeds RSS de sites que permitem robôs e, se houver chave do OpenRouter,
// pede ao modelo de notícias (MODELO_NOTICIAS, ex.: o Jev) que marque se cada uma puxa a arroba para
// cima ou para baixo e por qual variável. Grava data/noticias/AAAA-Snn.json.
// As notícias ainda NÃO entram no cálculo: o termômetro semanal é guardado e só vira variável do modelo
// depois de ~26 semanas, se provar que melhora a previsão (mesma regra de tudo aqui).
// Uso: node pipeline/noticias.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DATA = new URL("../data/noticias/", import.meta.url);
const UA = "BussolaCicloPecuario/1.0 (+https://github.com/haniellevi/bussola-ciclo-pecuario)";
// Sites que liberam robôs no robots.txt (conferido em 15/10/2026). Canal Rural e Portal DBO bloqueiam: fora.
const FEEDS = [
  { fonte: "Compre Rural", url: "https://www.comprerural.com/feed/" },
  { fonte: "BeefPoint", url: "https://www.beefpoint.com.br/feed/" },
  { fonte: "Folha Agrícola", url: "https://folhaagricola.com.br/feed/" },
  { fonte: "Canal do Criador", url: "https://canaldocriador.com.br/feed/" },
];
const ASSUNTO = /\b(boi|bois|bezerr|arroba|@|gado|pecu[aá]ri|vaca|novilh|f[eê]mea|abate|frigor[ií]fic|carne bovina|reposi[cç][aã]o|confinamento|bovin)/i;
const DIAS = 8;

export const VARIAVEIS = {
  femeas: "abate de fêmeas, retenção ou descarte de vacas",
  oferta: "oferta de boi pronto, escalas dos frigoríficos",
  exportacao: "exportação de carne, China, EUA, cotas e habilitações",
  demanda: "consumo interno, renda, preço da carne no varejo",
  custos: "milho, farelo, insumos, custo de confinamento",
  clima: "chuva, seca, pastagens, El Niño/La Niña",
  juros: "juros, crédito rural, dólar",
  politica: "impostos, leis, sanidade, rastreabilidade",
  outro: "outro assunto",
} as const;
type Variavel = keyof typeof VARIAVEIS;
type Classe = { relevante: boolean; direcao: "sobe" | "cai" | "neutro"; variavel: Variavel; resumo: string };
export type Noticia = { fonte: string; titulo: string; link: string; data: string; classe?: Classe };

function semanaIso(data: Date) {
  const q = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 12));
  q.setUTCDate(q.getUTCDate() - ((q.getUTCDay() + 6) % 7) + 3);
  const ano = q.getUTCFullYear();
  return `${ano}-S${String(1 + Math.floor((q.getTime() - Date.UTC(ano, 0, 1, 12)) / 604_800_000)).padStart(2, "0")}`;
}

const limpar = (t: string) =>
  t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();
const tag = (item: string, nome: string) => limpar(item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`))?.[1] ?? "");

async function lerFeed(f: (typeof FEEDS)[number]): Promise<Noticia[]> {
  const r = await fetch(f.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${f.fonte}: HTTP ${r.status}`);
  const xml = await r.text();
  const limite = Date.now() - DIAS * 86_400_000;
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, it]) => ({ fonte: f.fonte, titulo: tag(it, "title"), link: tag(it, "link"), data: new Date(tag(it, "pubDate")).toISOString().slice(0, 10), resumo: tag(it, "description").slice(0, 300) }))
    .filter((n) => n.titulo && n.link && new Date(n.data).getTime() >= limite && ASSUNTO.test(`${n.titulo} ${n.resumo}`))
    .map(({ resumo: _, ...n }) => n);
}

export async function classificar(itens: Noticia[]): Promise<Map<string, Classe>> {
  const chave = process.env.OPENROUTER_API_KEY?.trim();
  const modelo = process.env.MODELO_NOTICIAS?.trim();
  const saida = new Map<string, Classe>();
  if (!chave || !modelo || !itens.length) return saida;
  const pedido = `Você classifica notícias para pecuaristas de corte no Brasil. Para cada manchete, responda:
- relevante: true se afeta o preço do boi gordo ou do bezerro nas próximas semanas ou meses.
- direcao: "sobe", "cai" ou "neutro" — para onde a notícia empurra o preço da arroba do boi.
- variavel: uma de ${Object.entries(VARIAVEIS).map(([k, v]) => `"${k}" (${v})`).join(", ")}.
- resumo: uma frase curta em português simples, sem inventar número que não esteja na manchete.
Responda SÓ um JSON: {"itens":[{"i":0,"relevante":true,"direcao":"sobe","variavel":"exportacao","resumo":"..."}]}

Manchetes:
${itens.map((n, i) => `${i}. [${n.fonte}, ${n.data}] ${n.titulo}`).join("\n")}`;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "X-Title": "Bussola do Ciclo Pecuario" },
    body: JSON.stringify({ model: modelo, messages: [{ role: "user", content: pedido }], response_format: { type: "json_object" }, max_tokens: 4000 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const texto: string = (await r.json())?.choices?.[0]?.message?.content ?? "";
  const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  for (const c of json.itens ?? []) {
    const n = itens[c.i];
    // Só aceita respostas dentro do formato combinado; o resto fica sem classificação.
    if (!n || typeof c.relevante !== "boolean" || !["sobe", "cai", "neutro"].includes(c.direcao) || !(c.variavel in VARIAVEIS)) continue;
    saida.set(n.link, { relevante: c.relevante, direcao: c.direcao, variavel: c.variavel, resumo: String(c.resumo ?? "").slice(0, 240) });
  }
  return saida;
}

// Termômetro: saldo das notícias relevantes (sobe − cai) ÷ relevantes, de −1 a +1, por variável.
export function termometro(itens: Noticia[]) {
  const rel = itens.filter((n) => n.classe?.relevante);
  const saldo = (g: Noticia[]) => (g.length ? (g.filter((n) => n.classe!.direcao === "sobe").length - g.filter((n) => n.classe!.direcao === "cai").length) / g.length : 0);
  const porVariavel = Object.fromEntries(
    Object.keys(VARIAVEIS).flatMap((v) => {
      const g = rel.filter((n) => n.classe!.variavel === v);
      return g.length ? [[v, { n: g.length, saldo: +saldo(g).toFixed(2) }]] : [];
    }),
  );
  return { relevantes: rel.length, saldo: +saldo(rel).toFixed(2), porVariavel };
}

if (import.meta.main) {
  const semana = semanaIso(new Date());
  const arquivo = new URL(`${semana}.json`, DATA);
  const antigo: { itens: Noticia[] } = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf8")) : { itens: [] };
  const conhecidas = new Map(antigo.itens.map((n) => [n.link, n]));
  const avisos: string[] = [];
  for (const f of FEEDS) {
    try {
      for (const n of await lerFeed(f)) if (!conhecidas.has(n.link)) conhecidas.set(n.link, n);
    } catch (e) {
      avisos.push(`Feed ${f.fonte} falhou: ${(e as Error).message}`);
    }
  }
  const itens = [...conhecidas.values()].sort((a, b) => b.data.localeCompare(a.data));
  const semClasse = itens.filter((n) => !n.classe);
  try {
    const classes = await classificar(semClasse.slice(0, 60));
    for (const n of semClasse) n.classe = classes.get(n.link) ?? n.classe;
    if (semClasse.length && !process.env.OPENROUTER_API_KEY) avisos.push("Sem OPENROUTER_API_KEY: notícias guardadas sem classificação.");
    else if (semClasse.length && !process.env.MODELO_NOTICIAS) avisos.push("Sem MODELO_NOTICIAS: notícias guardadas sem classificação.");
  } catch (e) {
    avisos.push(`Classificação falhou: ${(e as Error).message}`);
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(arquivo, JSON.stringify({ semana, atualizadoEm: new Date().toISOString(), avisos, termometro: termometro(itens), itens }, null, 1) + "\n");
  console.log(`ok data/noticias/${semana}.json: ${itens.length} notícias, ${itens.filter((n) => n.classe).length} classificadas`);
  for (const a of avisos) console.warn(`aviso: ${a}`);
}
