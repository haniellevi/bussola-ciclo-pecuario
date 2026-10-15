// Fase do ciclo a partir da fatia de fêmeas no abate (dado já com atraso de publicação).
//
//   fêmeas ACIMA da média e SUBINDO  → Baixa  (liquidação: vacas indo para o abate)
//   fêmeas ACIMA da média e CAINDO   → Virada (retenção começa; preço tende a subir)
//   fêmeas ABAIXO da média e CAINDO  → Alta   (oferta curta de boi)
//   fêmeas ABAIXO da média e SUBINDO → Topo   (retenção acabando; preço perto do pico)
import type { Mes } from "./dados.ts";

export type Fase = "Baixa" | "Virada" | "Alta" | "Topo";
export type ParamsFase = { janelaMedia: number; janelaDirecao: number };

// Fases em que, pela teoria, o preço real tende a subir.
export const FASES_DE_SUBIDA: Fase[] = ["Virada", "Alta"];

export type LeituraFase = {
  fase: Fase;
  femeas: number;
  media: number;
  variacao: number; // mudança da fatia de fêmeas na janela de direção (pontos de 0..1)
};

export function lerFase(serie: Mes[], i: number, p: ParamsFase): LeituraFase | null {
  const atual = serie[i].femeas;
  const antes = serie[i - p.janelaDirecao]?.femeas;
  const janela = serie.slice(Math.max(0, i - p.janelaMedia + 1), i + 1).map((m) => m.femeas);
  if (atual == null || antes == null || janela.some((v) => v == null) || janela.length < p.janelaMedia)
    return null;
  const media = (janela as number[]).reduce((a, b) => a + b, 0) / janela.length;
  const variacao = atual - antes;
  const acima = atual >= media;
  const subindo = variacao > 0;
  const fase: Fase = acima ? (subindo ? "Baixa" : "Virada") : subindo ? "Topo" : "Alta";
  return { fase, femeas: atual, media, variacao };
}

// Gabarito olhando para trás: o preço real estava entre um vale e o pico seguinte?
// Viradas só contam quando o preço anda pelo menos `limiar` (ex.: 20%) a partir do extremo.
type Pivo = { i: number; tipo: "pico" | "vale" };

function zigzag(precos: number[], limiar: number): Pivo[] {
  const pivos: Pivo[] = [];
  let maxI = 0;
  let minI = 0;
  let dir: 0 | 1 | -1 = 0; // 1: procurando pico; -1: procurando vale
  for (let i = 1; i < precos.length; i++) {
    if (precos[i] > precos[maxI]) maxI = i;
    if (precos[i] < precos[minI]) minI = i;
    if (dir !== -1 && precos[i] < precos[maxI] * (1 - limiar)) {
      pivos.push({ i: maxI, tipo: "pico" });
      dir = -1;
      minI = i;
    } else if (dir !== 1 && precos[i] > precos[minI] * (1 + limiar)) {
      pivos.push({ i: minI, tipo: "vale" });
      dir = 1;
      maxI = i;
    }
  }
  return pivos;
}

// Mês i "sobe" se está depois de um vale e até o pico seguinte.
export function gabaritoSubida(precos: number[], limiar: number): boolean[] {
  const pivos = zigzag(precos, limiar);
  if (!pivos.length) return precos.map(() => false);
  return precos.map((_, i) => {
    const anterior = pivos.filter((p) => p.i < i).at(-1);
    return anterior ? anterior.tipo === "vale" : pivos[0].tipo === "pico";
  });
}

// Fase pelo próprio preço, só com o que se sabia no mês i: último pico/vale já confirmado
// (preço andou `limiar` a partir dele) e o preço real comparado ao último pico.
export type LeituraPreco = {
  sobe: boolean;
  ultimoPivo: { mes: string; tipo: "pico" | "vale"; boiReal: number } | null;
  mesesDesdePivo: number;
  realVsPicoAnterior: number | null; // preço real atual ÷ último pico confirmado
};

export function lerFasePreco(serie: Mes[], i: number, limiar: number): LeituraPreco {
  const precos = serie.slice(0, i + 1).map((m) => m.boiReal);
  const pivos = zigzag(precos, limiar);
  const ult = pivos.at(-1);
  const pico = pivos.filter((p) => p.tipo === "pico").at(-1);
  return {
    sobe: ult ? ult.tipo === "vale" : false,
    ultimoPivo: ult ? { mes: serie[ult.i].mes, tipo: ult.tipo, boiReal: serie[ult.i].boiReal } : null,
    mesesDesdePivo: ult ? i - ult.i : 0,
    realVsPicoAnterior: pico ? serie[i].boiReal / serie[pico.i].boiReal : null,
  };
}

export function pivosDePreco(serie: Mes[], limiar: number) {
  return zigzag(serie.map((m) => m.boiReal), limiar).map((p) => ({
    mes: serie[p.i].mes,
    tipo: p.tipo,
    boiReal: serie[p.i].boiReal,
  }));
}

// Viradas da fatia de fêmeas no abate (média 12 meses, já com atraso do IBGE), só com o que se sabia
// no mês i: uma virada vale quando a fatia volta `limiar` pontos a partir do extremo.
// Em 2006–2023 marcou uma virada por meia-onda, sem sinal falso.
export const LIMIAR_FEMEAS = 0.005;
export type PivoFemeas = { mes: string; tipo: "pico" | "vale"; femeas: number; confirmado: string };

export function pivosFemeas(serie: Mes[], ate = serie.length - 1, limiar = LIMIAR_FEMEAS): PivoFemeas[] {
  const pivos: PivoFemeas[] = [];
  let dir = 1; // 1: procurando pico; -1: procurando vale
  let ext: { mes: string; v: number } | null = null;
  for (const m of serie.slice(0, ate + 1)) {
    const f = m.femeas;
    if (f == null) continue;
    if (!ext || (dir === 1 && f > ext.v) || (dir === -1 && f < ext.v)) ext = { mes: m.mes, v: f };
    if (dir === 1 && f < ext.v - limiar) {
      pivos.push({ mes: ext.mes, tipo: "pico", femeas: ext.v, confirmado: m.mes });
      dir = -1;
      ext = { mes: m.mes, v: f };
    } else if (dir === -1 && f > ext.v + limiar) {
      pivos.push({ mes: ext.mes, tipo: "vale", femeas: ext.v, confirmado: m.mes });
      dir = 1;
      ext = { mes: m.mes, v: f };
    }
  }
  return pivos;
}

export const mesesEntre = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

// Relógio das vacas: nos ciclos de 2006–2023 o pico do boi veio sempre depois do pico de fêmeas no abate
// (fim do descarte de vacas). Devolve o pico de fêmeas da alta atual (se já confirmado) e quanto tempo,
// nos ciclos já conhecidos no mês i, o boi levou desse pico até o pico de preço.
export function relogioFemeas(serie: Mes[], i: number, pivosPreco: { mes: string; tipo: "pico" | "vale" }[], valeAtual: string | null) {
  const fp = pivosFemeas(serie, i);
  const atrasos = fp
    .filter((p) => p.tipo === "pico")
    .flatMap((pf) => {
      // Só conta se o pico de fêmeas caiu dentro de uma alta do preço (último pivô antes dele foi um vale).
      const antes = pivosPreco.filter((p) => p.mes <= pf.mes).at(-1);
      const pp = pivosPreco.find((p) => p.tipo === "pico" && p.mes > pf.mes);
      return antes?.tipo === "vale" && pp ? [mesesEntre(pf.mes, pp.mes)] : [];
    });
  const ult = fp.at(-1);
  const pico = valeAtual && ult?.tipo === "pico" && ult.mes > valeAtual ? ult : null;
  return { pico, mesesDesdePico: pico ? mesesEntre(pico.mes, serie[i].mes) : null, atrasos };
}
