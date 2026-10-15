// Teste no passado dos vereditos (Cria, Recria/Engorda, Iniciante), 2006–2023.
// Cada mês usa só o que se sabia naquele mês: fase, durações de ciclos já concluídos,
// faixas da relação de troca dos anos anteriores e previsão treinada até ali.
// Uso: node pipeline/modelo/backtest-veredito.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { estagio, relacaoTroca, veredito, type Entrada, type Perfil, type Selo } from "../../lib/veredito.ts";
import { montarSerie } from "./dados.ts";
import { CICLOS_DESDE, lerFasePreco, mesesEntre, pivosDePreco, relogioFemeas } from "./fase.ts";
import { prever, treinar } from "./previsao.ts";

const LIMIAR = 0.2;
// Padrão 2006–2023 (resultado publicado). Para olhar 2003–2005: TESTE_DE=2003-01 RTS_MIN=36 (o bezerro só existe desde fev/2000).
// Nesses anos não há ciclo completo no histórico das regras, então a leitura é só um teste extra.
const TESTE_DE = process.env.TESTE_DE ?? "2006-01";
const RTS_MIN = Number(process.env.RTS_MIN ?? 60);
const REL_DE = process.env.REL_DE ?? "0000-00"; // recorte só para a leitura do relatório (ex.: 2015-01 = período de teste das regras)
const REL_ATE = process.env.REL_ATE ?? "9999-99";
const VACAS = process.env.SEM_VACAS !== "1"; // SEM_VACAS=1 roda a regra antiga, só pelo preço
const MESES_ENGORDA = 18; // bezerro comprado vira boi gordo vendido
const MESES_CRIA = 30; // matriz comprada → bezerros vendidos
// Antes de existir ciclo completo nos dados, usa durações típicas citadas pelo setor (3 anos).
const DURACAO_PADRAO = [36];

const serie = montarSerie();
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const quantil = (v: number[], q: number) => [...v].sort((a, b) => a - b)[Math.round(q * (v.length - 1))];

type Linha = { mes: string; selos: Record<Perfil, Selo>; estagio: string; rt: number; troca: Entrada["troca"]; prevBoi: number | null; prevBezerro: number | null; engorda: number | null; cria: number | null };
const linhas: Linha[] = [];

for (let i = 0; i < serie.length; i++) {
  const m = serie[i];
  if (m.mes < TESTE_DE || m.mes > "2023-12" || !m.bezerro) continue;

  // Fase e durações só com o passado.
  const passado = serie.slice(0, i + 1);
  const fase = lerFasePreco(passado, i, LIMIAR);
  const pivos = pivosDePreco(passado, LIMIAR).filter((p) => p.mes >= CICLOS_DESDE);
  const dur = (de: string, para: string) =>
    pivos.flatMap((p, k) => (p.tipo === de && pivos[k + 1]?.tipo === para ? [mesesEntre(p.mes, pivos[k + 1].mes)] : []));
  const vacas = relogioFemeas(serie, i, pivos, fase.sobe ? (fase.ultimoPivo?.mes ?? null) : null);
  const subidas = dur("vale", "pico");
  const quedas = dur("pico", "vale");

  // Faixas da relação de troca: até 10 anos anteriores (mínimo 5).
  const rts = serie.slice(Math.max(0, i - 119), i + 1).map((x) => x.rt).filter((v): v is number => v != null);
  if (rts.length < RTS_MIN) continue;

  // Previsão de 13 semanas treinada só com resultados conhecidos até o mês.
  const varPrev = (alvo: "boi" | "bezerro") => {
    try {
      const p = prever(treinar(serie, alvo, 3, m.mes), serie, i);
      return p ? p.previsto / p.base - 1 : null;
    } catch {
      return null;
    }
  };

  const e: Entrada = {
    sobe: fase.sobe,
    meses: fase.mesesDesdePivo,
    duracaoSubidas: subidas.length ? subidas : DURACAO_PADRAO,
    duracaoQuedas: quedas.length ? quedas : DURACAO_PADRAO,
    realVsPicoAnterior: fase.realVsPicoAnterior,
    mesesDesdePicoFemeas: VACAS ? vacas.mesesDesdePico : 0,
    atrasoPicoBoi: VACAS ? vacas.atrasos : [],
    boi: m.boi,
    bezerro: m.bezerro,
    troca: { p25: quantil(rts, 0.25), mediana: quantil(rts, 0.5), p75: quantil(rts, 0.75) },
    previsaoBoi13: varPrev("boi"),
    previsaoBezerro13: varPrev("bezerro"),
  };

  // Resultado real: engorda = bezerros que o boi vendido 18 meses depois paga (compra a preço de hoje);
  // cria = valorização real do bezerro nos 30 meses seguintes.
  const venda = serie[i + MESES_ENGORDA];
  const futuroCria = serie[i + MESES_CRIA];
  linhas.push({
    mes: m.mes,
    estagio: estagio(e),
    rt: relacaoTroca(e.boi, e.bezerro),
    troca: e.troca,
    prevBoi: e.previsaoBoi13,
    prevBezerro: e.previsaoBezerro13,
    selos: { cria: veredito("cria", e).selo, engorda: veredito("engorda", e).selo, iniciante: veredito("iniciante", e).selo },
    engorda: venda ? (18 * venda.boi) / m.bezerro : null,
    cria: futuroCria?.bezerroReal && m.bezerroReal ? futuroCria.bezerroReal / m.bezerroReal - 1 : null,
  });
}

// ---------- Relatório ----------
const SELOS: Selo[] = ["melhor", "bom", "aguarde"];
const NOME: Record<Selo, string> = { melhor: "Melhor momento", bom: "Bom para comprar", aguarde: "Aguarde" };
const relatorio: Record<string, unknown> = {};

function avaliar(perfil: Perfil, criterio: "engorda" | "cria") {
  const validas = linhas.filter((l) => l[criterio] != null && l.mes >= REL_DE && l.mes <= REL_ATE);
  const todos = validas.map((l) => l[criterio]!);
  const corte = mediana(todos);
  const fmt = (v: number) => (criterio === "engorda" ? `${v.toFixed(2)} bezerros` : `${v >= 0 ? "+" : ""}${pct(v)}`);
  console.log(`\n${perfil.toUpperCase()} — critério ${criterio === "engorda" ? "troca na venda (18 meses)" : "valorização real do bezerro (30 meses)"}`);
  console.log(`  Comprar sempre: média ${fmt(todos.reduce((a, b) => a + b) / todos.length)} | mediana ${fmt(corte)} | ${validas.length} meses`);
  const r: Record<string, unknown> = { corte, meses: validas.length };
  for (const s of SELOS) {
    const g = validas.filter((l) => l.selos[perfil] === s).map((l) => l[criterio]!);
    if (!g.length) {
      console.log(`  ${NOME[s].padEnd(17)} nunca apareceu`);
      continue;
    }
    const media = g.reduce((a, b) => a + b) / g.length;
    const acima = g.filter((v) => v > corte).length / g.length;
    const acerto = s === "aguarde" ? 1 - acima : acima; // aguarde acerta quando o negócio teria sido ruim
    r[s] = { meses: g.length, media, acimaDaMediana: acima, acerto };
    console.log(`  ${NOME[s].padEnd(17)} ${String(g.length).padStart(3)} meses | média ${fmt(media).padEnd(14)} | acertou ${pct(acerto)}`);
  }
  relatorio[`${perfil}/${criterio}`] = r;
}

avaliar("engorda", "engorda");
avaliar("cria", "cria");
avaliar("iniciante", "engorda");
avaliar("iniciante", "cria");

// Linha do tempo: selo predominante por ano.
console.log("\nSelo mais frequente por ano (engorda | cria | iniciante):");
const anos = [...new Set(linhas.map((l) => l.mes.slice(0, 4)))];
for (const a of anos) {
  const g = linhas.filter((l) => l.mes.startsWith(a) && l.mes >= REL_DE && l.mes <= REL_ATE);
  const moda = (p: Perfil) => {
    const c = SELOS.map((s) => [s, g.filter((l) => l.selos[p] === s).length] as const).sort((x, y) => y[1] - x[1]);
    return c[0][0];
  };
  console.log(`  ${a}: ${moda("engorda").padEnd(8)} | ${moda("cria").padEnd(8)} | ${moda("iniciante")}`);
}

const SAIDA = process.env.BACKTEST_DIR ?? "../../data/backtest/";
mkdirSync(new URL(SAIDA, import.meta.url), { recursive: true });
writeFileSync(
  new URL(`${SAIDA}vereditos.json`, import.meta.url),
  JSON.stringify({ geradoEm: new Date().toISOString(), periodo: `${linhas[0].mes.slice(0, 4)}–2023`, relatorio, linhas }, null, 1) + "\n",
);
