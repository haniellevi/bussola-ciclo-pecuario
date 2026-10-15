// Etapa 1 do processo semanal: coleta de fontes com API pública.
// Cada arquivo salvo leva fonte, URL e data da coleta.
// Uso: node pipeline/coletar.ts
import { mkdir, writeFile } from "node:fs/promises";

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

await coletarBcb();
await coletarIbgeAbate();
