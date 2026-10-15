// Monta a série mensal usada pelo modelo a partir de data/raw.
import { readFileSync } from "node:fs";

const RAW = new URL("../../data/raw/", import.meta.url);
const ler = <T>(c: string): T => JSON.parse(readFileSync(new URL(c, RAW), "utf8")).dados;

// Atraso de publicação do IBGE: o abate do mês t só é conhecido por volta de t+3.
export const ATRASO_IBGE = 3;

export type Mes = {
  mes: string; // AAAA-MM
  boi: number; // R$/@ nominal, média do mês
  bezerro: number | null; // R$/cabeça nominal
  boiReal: number; // R$/@ em valores do último IGP-DI disponível
  bezerroReal: number | null;
  rt: number | null; // bezerros comprados por 1 boi de 18@
  femeas: number | null; // fatia de fêmeas no abate, média de 12 meses (0..1), já com atraso de publicação
  selic: number | null;
  dolar: number | null;
};

function mediaMensal(pontos: { data: string; valor: number }[]) {
  const soma = new Map<string, [number, number]>();
  for (const p of pontos) {
    const k = p.data.slice(0, 7);
    const [s, n] = soma.get(k) ?? [0, 0];
    soma.set(k, [s + p.valor, n + 1]);
  }
  return new Map([...soma].map(([k, [s, n]]) => [k, s / n]));
}

const porMes = (pontos: { data: string; valor: number }[]) =>
  new Map(pontos.map((p) => [p.data.slice(0, 7), p.valor]));

function mesMenos(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

// Último valor do IBGE já publicado no mês `mes` (referência de no máximo mes - ATRASO_IBGE).
function ultimoPublicado(femeas: Map<string, number>, mes: string): number | null {
  for (let n = ATRASO_IBGE; n < ATRASO_IBGE + 4; n++) {
    const v = femeas.get(mesMenos(mes, n));
    if (v !== undefined) return v;
  }
  return null;
}

export function montarSerie(): Mes[] {
  const boi = mediaMensal(ler("cepea/boi-gordo.json"));
  const bezerro = mediaMensal(ler("cepea/bezerro-ms.json"));
  const selic = porMes(ler("bcb/selic-mensal.json"));
  const dolar = porMes(ler("bcb/dolar-venda-media-mensal.json"));
  const igp = ler<{ data: string; valor: number }[]>("bcb/igp-di.json");
  const abate = ler<Record<string, number & string>[]>("ibge/abate-bovinos-mensal.json");

  // Índice de preços acumulado; meses sem IGP-DI ainda publicado usam o último índice.
  const indice = new Map<string, number>();
  let acc = 1;
  for (const p of igp) indice.set(p.data.slice(0, 7), (acc *= 1 + p.valor / 100));
  const ultimoIndice = acc;

  // Fatia de fêmeas: média móvel de 12 meses ponderada por cabeças.
  const femeas = new Map<string, number>();
  for (let i = 11; i < abate.length; i++) {
    const janela = abate.slice(i - 11, i + 1);
    const f = janela.reduce((s, r) => s + r.vacas + r.novilhas, 0);
    const t = janela.reduce((s, r) => s + r.bois + r.vacas + r.novilhos + r.novilhas, 0);
    femeas.set(abate[i].mes, f / t);
  }

  const serie: Mes[] = [];
  let indiceAnterior = 1;
  for (const mes of [...boi.keys()].sort()) {
    if (mes < "2000-01") continue;
    const ind = indice.get(mes) ?? (mes > [...indice.keys()].at(-1)! ? ultimoIndice : indiceAnterior);
    indiceAnterior = ind;
    const deflator = ultimoIndice / ind;
    const b = boi.get(mes)!;
    const z = bezerro.get(mes) ?? null;
    serie.push({
      mes,
      boi: b,
      bezerro: z,
      boiReal: b * deflator,
      bezerroReal: z && z * deflator,
      rt: z && (18 * b) / z,
      femeas: ultimoPublicado(femeas, mes),
      selic: selic.get(mes) ?? null,
      dolar: dolar.get(mes) ?? null,
    });
  }
  return serie;
}
