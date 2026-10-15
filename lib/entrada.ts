import type { Painel } from "./painel";
import type { Entrada } from "./veredito";

export function entradaDoPainel(p: Painel, boi = p.hoje.boi, bezerro = p.hoje.bezerro): Entrada {
  const varPrev = (alvo: "boi" | "bezerro") => {
    const it = p.previsao?.itens.find((i) => i.alvo === alvo && i.semanas === 13);
    return it ? it.previsto / it.base - 1 : null;
  };
  return {
    sobe: p.fase.sobe,
    meses: p.fase.meses,
    duracaoSubidas: p.fase.duracaoSubidas,
    duracaoQuedas: p.fase.duracaoQuedas,
    realVsPicoAnterior: p.fase.realVsPicoAnterior,
    mesesDesdePicoFemeas: p.fase.mesesDesdePicoVacas,
    atrasoPicoBoi: p.fase.atrasoPicoBoi,
    boi,
    bezerro,
    troca: p.troca,
    previsaoBoi13: varPrev("boi"),
    previsaoBezerro13: varPrev("bezerro"),
  };
}
