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
