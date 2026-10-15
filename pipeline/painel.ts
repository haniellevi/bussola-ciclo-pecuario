// Gera data/painel.json: tudo o que o app mostra, num arquivo só.
// Roda depois de semanal.ts (no robô) e antes do build do app.
// Uso: node pipeline/painel.ts
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { montarSerie } from "./modelo/dados.ts";
import { CICLOS_DESDE, lerFasePreco, mesesEntre, pivosDePreco, pivosFemeas, relogioFemeas } from "./modelo/fase.ts";
import { somarMeses } from "../lib/formato.ts";

const DATA = new URL("../data/", import.meta.url);
const lerJson = (c: string) => JSON.parse(readFileSync(new URL(c, DATA), "utf8"));
const LIMIAR_CICLO = 0.2;

const serie = montarSerie();
const i = serie.length - 1;
// O primeiro mês da série não é um pico/vale de verdade, só o começo dos dados.
const todosPivos = pivosDePreco(serie, LIMIAR_CICLO).filter((p) => p.mes !== serie[0].mes);
// Durações e relógio das vacas só com os ciclos de 2006 em diante (ver CICLOS_DESDE).
const pivos = todosPivos.filter((p) => p.mes >= CICLOS_DESDE);
const fase = lerFasePreco(serie, i, LIMIAR_CICLO);
const duracoes = (de: string, para: string) =>
  pivos.flatMap((p, k) => (p.tipo === de && pivos[k + 1]?.tipo === para ? [mesesEntre(p.mes, pivos[k + 1].mes)] : []));

// Relógio das vacas. Se a virada das fêmeas ainda não se confirmou, usa o maior valor desde o último vale
// como pico provável (só para a janela; o veredito usa apenas a virada confirmada).
const valeAtual = fase.sobe ? (fase.ultimoPivo?.mes ?? null) : null;
const vacas = relogioFemeas(serie, i, pivos, valeAtual);
const ultFem = pivosFemeas(serie).at(-1);
const candidato =
  vacas.pico ??
  (fase.sobe && ultFem?.tipo === "vale"
    ? serie.filter((m) => m.mes > ultFem.mes && m.femeas != null).reduce((a, m) => (m.femeas! > a.femeas! ? m : a))
    : null);
const picoVacas = candidato && { mes: candidato.mes, femeas: "femeas" in candidato ? candidato.femeas! : 0, confirmado: Boolean(vacas.pico) };

// Janela do próximo pico (ou fundo): nos ciclos passados, as duas regras valeram juntas.
const subidas = duracoes("vale", "pico");
const quedas = duracoes("pico", "vale");
const janela = (() => {
  if (!fase.ultimoPivo) return null;
  const ref = fase.sobe ? subidas : quedas;
  let de = somarMeses(fase.ultimoPivo.mes, Math.min(...ref));
  let ate = somarMeses(fase.ultimoPivo.mes, Math.max(...ref));
  if (fase.sobe && picoVacas && vacas.atrasos.length) {
    const deV = somarMeses(picoVacas.mes, Math.min(...vacas.atrasos));
    const ateV = somarMeses(picoVacas.mes, Math.max(...vacas.atrasos));
    if (deV > de) de = deV;
    if (ateV < ate) ate = ateV;
    if (ate < de) ate = de;
  }
  return { de, ate };
})();

// Notícias da semana mais recente (pipeline/noticias.ts). Ainda não entram no cálculo.
const noticias = (() => {
  const arqs = existsSync(new URL("noticias/", DATA)) ? readdirSync(new URL("noticias/", DATA)).filter((f) => f.endsWith(".json")).sort() : [];
  if (!arqs.length) return null;
  const n = lerJson(`noticias/${arqs.at(-1)}`);
  const itens = (n.itens as { classe?: { relevante: boolean } }[]).filter((x) => !x.classe || x.classe.relevante).slice(0, 10);
  return { semana: n.semana, termometro: n.termometro, classificadas: n.itens.some((x: { classe?: unknown }) => x.classe), itens };
})();

const ultimos10 = serie.slice(-120);
const quantil = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.round(q * (s.length - 1))];
};
const rts = ultimos10.map((m) => m.rt!).filter(Boolean);

const arqsPrev = readdirSync(new URL("previsoes/", DATA)).filter((f) => f.endsWith(".json")).sort();
const previsao = arqsPrev.length ? lerJson(`previsoes/${arqsPrev.at(-1)}`) : null;
const avaliacoes = lerJson("avaliacoes.json").avaliacoes;
const backtest = lerJson("backtest/relatorio.json");
const vereditos = lerJson("backtest/vereditos.json");
const scot = lerJson("raw/scot/boi-gordo.json").dados.at(-1);
const selic = lerJson("raw/bcb/selic-mensal.json").dados.at(-1);
const boiDiario = lerJson("raw/cepea/boi-gordo.json").dados;
const bezerroDiario = lerJson("raw/cepea/bezerro-ms.json").dados;

const painel = {
  geradoEm: new Date().toISOString(),
  fontes: "Cepea/Esalq-USP (CC BY-NC 4.0), IBGE, Banco Central, Scot Consultoria",
  hoje: {
    data: boiDiario.at(-1).data,
    boi: boiDiario.at(-1).valor,
    boiEstimado: boiDiario.at(-1).origem === "estimado-scot",
    bezerro: bezerroDiario.at(-1).valor,
    dataBezerro: bezerroDiario.at(-1).data,
  },
  serie: serie
    .map((m) => ({
      mes: m.mes,
      boi: +m.boi.toFixed(2),
      boiReal: +m.boiReal.toFixed(2),
      bezerro: m.bezerro && +m.bezerro.toFixed(0),
      rt: m.rt && +m.rt.toFixed(3),
      femeas: m.femeas && +m.femeas.toFixed(4),
    })),
  pivos: todosPivos.map((p) => ({ ...p, boiReal: +p.boiReal.toFixed(2) })),
  fase: {
    sobe: fase.sobe,
    desde: fase.ultimoPivo,
    meses: fase.mesesDesdePivo,
    realVsPicoAnterior: fase.realVsPicoAnterior,
    duracaoSubidas: subidas,
    duracaoQuedas: quedas,
    janela,
    picoVacas,
    mesesDesdePicoVacas: vacas.mesesDesdePico,
    atrasoPicoBoi: vacas.atrasos,
    femeas: serie[i].femeas,
    femeasMedia10: (() => {
      const f = ultimos10.map((m) => m.femeas).filter((v): v is number => v != null);
      return f.reduce((a, b) => a + b, 0) / f.length;
    })(),
  },
  troca: { atual: serie[i].rt, p25: quantil(rts, 0.25), mediana: quantil(rts, 0.5), p75: quantil(rts, 0.75) },
  previsao: previsao && {
    semana: previsao.semana,
    dataBase: previsao.dataBase,
    itens: previsao.previsoes.map((p: Record<string, number | string>) => ({
      alvo: p.alvo, semanas: p.semanas, base: p.base, previsto: p.previsto, minimo: p.minimo, maximo: p.maximo, segundaAlvo: p.segundaAlvo,
    })),
  },
  acerto: {
    teste: { periodo: "2023–2026", treinoAte: backtest.fimTreino, itens: backtest.previsao },
    anoAno: { periodo: "2014–2025", itens: backtest.rolante ?? [] },
    aoVivo: avaliacoes,
    vereditos: { periodo: vereditos.periodo, relatorio: vereditos.relatorio },
  },
  noticias,
  pracas: scot && { data: scot.data, valores: scot.pracas },
  selic: { data: selic.data, valor: selic.valor }, // % a.a., Banco Central
};

writeFileSync(new URL("painel.json", DATA), JSON.stringify(painel) + "\n");
console.log(`ok data/painel.json (${painel.serie.length} meses, fase ${fase.sobe ? "subindo" : "caindo"} há ${fase.mesesDesdePivo}m)`);
