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
    for (let ini = 2000; ini <= anoAtual; ini += 10) {
      const fim = Math.min(ini + 9, anoAtual);
      bruto.push(
        ...((await baixarJson(`${base}&dataInicial=01/01/${ini}&dataFinal=31/12/${fim}`)) as typeof bruto),
      );
    }
    const url = `${base}&dataInicial=01/01/2000`;
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
      if (!antigo) {
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

// Uma fonte fora do ar não impede as outras; a conferência semanal avisa o que ficou velho.
let falhas = 0;
for (const coletar of [coletarCepeaViaNa, coletarBcb, coletarIbgeAbate]) {
  try {
    await coletar();
  } catch (e) {
    falhas++;
    console.error(`FALHOU ${coletar.name}: ${(e as Error).message}`);
  }
}
process.exitCode = falhas ? 1 : 0;
