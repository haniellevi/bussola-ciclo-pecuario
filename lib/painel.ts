import dados from "../data/painel.json";

export type Pivo = { mes: string; tipo: "pico" | "vale"; boiReal: number };
export type ItemPrevisao = {
  alvo: "boi" | "bezerro";
  semanas: number;
  base: number;
  previsto: number;
  minimo: number;
  maximo: number;
  segundaAlvo: string;
};
export type AcertoTeste = {
  alvo: "boi" | "bezerro";
  semanas: number;
  previsoesTeste: number;
  erroMedioModelo: number;
  erroMedioIngenuo: number;
  acertoDirecao: number;
  dentroDaFaixa80: number;
};
export type AvaliacaoAoVivo = { alvo: "boi" | "bezerro"; semanas: number; erro: number; dentro: boolean; direcaoCerta: boolean };

export type Painel = {
  geradoEm: string;
  fontes: string;
  hoje: { data: string; boi: number; boiEstimado: boolean; bezerro: number; dataBezerro: string };
  serie: { mes: string; boi: number; boiReal: number; bezerro: number | null; rt: number | null; femeas: number | null }[];
  pivos: Pivo[];
  fase: {
    sobe: boolean;
    desde: Pivo | null;
    meses: number;
    realVsPicoAnterior: number | null;
    duracaoSubidas: number[];
    duracaoQuedas: number[];
    femeas: number | null;
    femeasMedia10: number;
  };
  troca: { atual: number; p25: number; mediana: number; p75: number };
  previsao: { semana: string; dataBase: string; itens: ItemPrevisao[] } | null;
  acerto: { teste: { periodo: string; treinoAte: string; itens: AcertoTeste[] }; aoVivo: AvaliacaoAoVivo[] };
  pracas: { data: string; valores: Record<string, { vista: number | null; prazo30: number | null }> } | null;
};

export const painel = dados as unknown as Painel;
