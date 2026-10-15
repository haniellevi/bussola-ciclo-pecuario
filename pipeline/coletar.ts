// Etapa 1 do processo: coleta automática (roda todo dia útil).
// Cada arquivo salvo leva fonte, URL e data da coleta.
// Uso: node pipeline/coletar.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";

const RAIZ = new URL("../data/raw/", import.meta.url);

type Ponto = { data: string; valor: number };

// O Banco Central recusa consultas seguidas às vezes: tenta de novo com pausa.
async function baixarJson(url: string, tentativas = 4): Promise<unknown> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      return JSON.parse(await r.text());
    } catch (e) {
      if (i >= tentativas) throw e;
      await new Promise((ok) => setTimeout(ok, 5_000 * i));
    }
  }
}

async function salvar(caminho: string, fonte: string, url: string, dados: unknown) {
  const arquivo = new URL(caminho, RAIZ);
  await mkdir(new URL(".", arquivo), { recursive: true });
  const corpo = { fonte, url, coletadoEm: new Date().toISOString(), dados };
  await writeFile(arquivo, JSON.stringify(corpo, null, 1) + "\n");
  console.log(`ok ${caminho}`);
}

// Banco Central (SGS). Séries mensais: sem limite de 10 anos por consulta.
const SERIES_BCB = {
  "selic-mensal": 4189, // % a.a., Selic acumulada no mês anualizada
  "igp-di": 190, // % ao mês, usado para corrigir preços pela inflação
  "dolar-venda-media-mensal": 3698, // R$/US$
} as const;

async function coletarBcb() {
  // A API exige data final e aceita no máximo 10 anos por consulta.
  const anoAtual = new Date().getFullYear();
  for (const [nome, codigo] of Object.entries(SERIES_BCB)) {
    const base = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json`;
    const bruto: { data: string; valor: string }[] = [];
    // Desde 1994 (Plano Real): o Cepea boi começa em 1997 e precisa do IGP-DI desde lá para corrigir os preços.
    for (let ini = 1994; ini <= anoAtual; ini += 10) {
      const fim = Math.min(ini + 9, anoAtual);
      bruto.push(
        ...((await baixarJson(`${base}&dataInicial=01/01/${ini}&dataFinal=31/12/${fim}`)) as typeof bruto),
      );
    }
    const url = `${base}&dataInicial=01/01/1994`;
    const pontos: Ponto[] = bruto.map((p) => {
      const [d, m, a] = p.data.split("/");
      return { data: `${a}-${m}-${d}`, valor: Number(p.valor) };
    });
    await salvar(`bcb/${nome}.json`, `Banco Central do Brasil, SGS série ${codigo}`, url, pontos);
  }
}

// IBGE, Pesquisa Trimestral do Abate (tabela 1092): cabeças abatidas por mês e tipo.
const MESES_DO_TRIMESTRE: Record<string, number> = { "No 1º mês": 0, "No 2º mês": 1, "No 3º mês": 2 };

async function coletarIbgeAbate() {
  const url =
    "https://apisidra.ibge.gov.br/values/t/1092/n1/all/v/284/p/all/c12716/allxt/c18/all";
  const [, ...linhas] = (await baixarJson(url)) as Record<string, string>[];
  const porMes = new Map<string, Record<string, number>>();
  for (const l of linhas) {
    const offset = MESES_DO_TRIMESTRE[l.D4N];
    if (offset === undefined || !/^\d+$/.test(l.V)) continue;
    const ano = Number(l.D3C.slice(0, 4));
    const tri = Number(l.D3C.slice(4));
    const mes = (tri - 1) * 3 + 1 + offset;
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    const reg = porMes.get(chave) ?? {};
    reg[l.D5N.toLowerCase()] = Number(l.V);
    porMes.set(chave, reg);
  }
  const dados = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, r]) => ({ mes, ...r }));
  await salvar("ibge/abate-bovinos-mensal.json", "IBGE, Pesquisa Trimestral do Abate de Animais, tabela 1092", url, dados);
}

// Indicadores do Cepea (boi gordo e bezerro MS), republicados pelo Notícias Agrícolas.
// O site do Cepea bloqueia robôs; o Notícias Agrícolas permite (robots.txt) e mostra os
// últimos ~10 dias úteis com os mesmos valores. Os dias novos entram no histórico;
// dias que já existem são conferidos, e divergências viram aviso no relatório.
const PAGINAS_CEPEA = {
  "cepea/boi-gordo.json": "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-gordo-indicador-esalq-bmf",
  "cepea/bezerro-ms.json": "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/indicador-bezerro-esalq-bmf-bovespa-ms",
} as const;

function lerTabelasNa(html: string): Ponto[] {
  const pontos: Ponto[] = [];
  for (const [tabela] of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const texto = tabela.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const m = texto.match(/(\d{2})\/(\d{2})\/(\d{4}) ([\d.]+,\d+)/);
    if (!m) continue;
    pontos.push({ data: `${m[3]}-${m[2]}-${m[1]}`, valor: Number(m[4].replace(/\./g, "").replace(",", ".")) });
  }
  return pontos;
}

async function coletarCepeaViaNa() {
  for (const [caminho, url] of Object.entries(PAGINAS_CEPEA)) {
    const r = await fetch(url, {
      headers: { "User-Agent": "BussolaCicloPecuario/1.0 (+https://github.com/haniellevi/bussola-ciclo-pecuario)" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`${r.status} em ${url}`);
    const novos = lerTabelasNa(await r.text());
    if (novos.length < 3) throw new Error(`Notícias Agrícolas: página mudou, só ${novos.length} dias lidos em ${url}`);

    const arquivo = new URL(caminho, RAIZ);
    const atual = JSON.parse(await readFile(arquivo, "utf8"));
    const porData = new Map<string, Ponto & { origem?: string }>(atual.dados.map((p: Ponto) => [p.data, p]));
    const avisos: string[] = [];
    let adicionados = 0;
    for (const p of novos) {
      const antigo = porData.get(p.data);
      if (!antigo || antigo.origem === "estimado-scot") {
        porData.set(p.data, { ...p, origem: "noticiasagricolas" });
        adicionados++;
      } else if (Math.abs(antigo.valor / p.valor - 1) > 0.005) {
        avisos.push(`${p.data}: histórico tem ${antigo.valor}, Notícias Agrícolas mostra ${p.valor}`);
      }
    }
    const corpo = {
      ...atual,
      coletadoEm: new Date().toISOString(),
      coletaAutomatica: url,
      divergencias: avisos,
      dados: [...porData.values()].sort((a, b) => a.data.localeCompare(b.data)),
    };
    await writeFile(arquivo, JSON.stringify(corpo, null, 1) + "\n");
    console.log(`ok ${caminho}: +${adicionados} dias, último ${corpo.dados.at(-1).data}${avisos.length ? `, ${avisos.length} divergência(s)` : ""}`);
  }
}

// Scot Consultoria: boi gordo por praça (pesquisa própria, não é o Cepea). Serve para
// conferir o Cepea e como reserva se a coleta do Cepea parar. A página só mostra o dia atual,
// então o histórico é montado pela coleta diária.
const URL_SCOT = "https://www.scotconsultoria.com.br/cotacoes/boi-gordo/";
const PRACA_REFERENCIA = "SP Barretos"; // mesma região do indicador do Cepea
const num = (s: string) => (s === "-" ? null : Number(s.replace(/\./g, "").replace(",", ".")));
const ACENTOS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú" };
// A Scot escreve acentos como entidades HTML (&iacute;, &ccedil;, &#227;...).
const textoHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z])acute;/g, (_, l) => ACENTOS[l] ?? l)
    .replace(/&([a-zA-Z])(tilde|circ|grave);/g, (_, l, t) => (l + { tilde: "̃", circ: "̂", grave: "̀" }[t as string]).normalize("NFC"))
    .replace(/&ccedil;/g, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

async function coletarScot() {
  const r = await fetch(URL_SCOT, {
    headers: { "User-Agent": "BussolaCicloPecuario/1.0 (+https://github.com/haniellevi/bussola-ciclo-pecuario)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`${r.status} em ${URL_SCOT}`);
  const tabela = [...(await r.text()).matchAll(/<table[\s\S]*?<\/table>/g)]
    .map(([t]) => textoHtml(t))
    .find((t) => t.includes("Mercado Físico"));
  const data = tabela?.match(/Mercado Físico - (\d{2})\/(\d{2})\/(\d{4})/);
  if (!tabela || !data) throw new Error("Scot: tabela do mercado físico não encontrada (página mudou?)");
  const valor = "(-|[\\d.]+,\\d{2})";
  const linha = new RegExp(`([A-Z]{2}) ([A-ZÀ-Úa-zà-ú][A-Za-zÀ-ú. ]*?) ${valor} ${valor}`, "g");
  const pracas: Record<string, { vista: number | null; prazo30: number | null }> = {};
  for (const m of tabela.matchAll(linha)) pracas[`${m[1]} ${m[2].trim()}`] = { vista: num(m[3]), prazo30: num(m[4]) };
  if (!pracas[PRACA_REFERENCIA]?.vista) throw new Error(`Scot: praça ${PRACA_REFERENCIA} não encontrada`);

  const arquivo = new URL("scot/boi-gordo.json", RAIZ);
  let dados: { data: string; pracas: typeof pracas }[] = [];
  try {
    dados = JSON.parse(await readFile(arquivo, "utf8")).dados;
  } catch {}
  const dia = `${data[3]}-${data[2]}-${data[1]}`;
  dados = [...dados.filter((d) => d.data !== dia), { data: dia, pracas }].sort((a, b) => a.data.localeCompare(b.data));
  await salvar("scot/boi-gordo.json", "Scot Consultoria, boi gordo mercado físico (preço bruto, R$/@)", URL_SCOT, dados);
}

// Confere Cepea × Scot e, se o Cepea parou, estima os dias faltantes pela Scot.
const MIN_DIAS_COMUNS = 5;
async function conferirEReservar() {
  const arqCepea = new URL("cepea/boi-gordo.json", RAIZ);
  const cepea = JSON.parse(await readFile(arqCepea, "utf8"));
  const scot = JSON.parse(await readFile(new URL("scot/boi-gordo.json", RAIZ), "utf8")).dados as { data: string; pracas: Record<string, { vista: number | null }> }[];
  const reais = new Map<string, number>(cepea.dados.filter((p: { origem?: string }) => p.origem !== "estimado-scot").map((p: Ponto) => [p.data, p.valor]));
  const razoes = scot
    .filter((s) => reais.has(s.data) && s.pracas[PRACA_REFERENCIA]?.vista)
    .slice(-20)
    .map((s) => reais.get(s.data)! / s.pracas[PRACA_REFERENCIA].vista!);
  const avisos: string[] = [];
  if (razoes.length < MIN_DIAS_COMUNS) {
    console.log(`Scot: ${razoes.length} dia(s) em comum com o Cepea; reserva liga com ${MIN_DIAS_COMUNS}.`);
  } else {
    const ordenadas = [...razoes].sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)];
    const hoje = razoes.at(-1)!;
    if (Math.abs(hoje / mediana - 1) > 0.03)
      avisos.push(`Cepea e Scot se afastaram: Cepea/Scot = ${hoje.toFixed(3)}, normal ≈ ${mediana.toFixed(3)}`);
    const ultimoReal = [...reais.keys()].sort().at(-1)!;
    let estimados = 0;
    for (const s of scot) {
      const v = s.pracas[PRACA_REFERENCIA]?.vista;
      if (s.data <= ultimoReal || !v || cepea.dados.some((p: Ponto) => p.data === s.data)) continue;
      cepea.dados.push({ data: s.data, valor: Math.round(v * mediana * 100) / 100, origem: "estimado-scot" });
      estimados++;
    }
    if (estimados) {
      cepea.dados.sort((a: Ponto, b: Ponto) => a.data.localeCompare(b.data));
      avisos.push(`Coleta do Cepea parada desde ${ultimoReal}: ${estimados} dia(s) estimado(s) pela Scot (fator ${mediana.toFixed(3)}).`);
    }
  }
  cepea.reservaScot = avisos;
  await writeFile(arqCepea, JSON.stringify(cepea, null, 1) + "\n");
  for (const a of avisos) console.log(`aviso: ${a}`);
}

// Uma fonte fora do ar não impede as outras; a conferência semanal avisa o que ficou velho.
let falhas = 0;
for (const coletar of [coletarCepeaViaNa, coletarScot, conferirEReservar, coletarBcb, coletarIbgeAbate]) {
  try {
    await coletar();
  } catch (e) {
    falhas++;
    console.error(`FALHOU ${coletar.name}: ${(e as Error).message}`);
  }
}
process.exitCode = falhas ? 1 : 0;
