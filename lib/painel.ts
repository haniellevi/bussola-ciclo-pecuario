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

type GrupoSelo = { meses: number; media: number; acerto: number };
export type ResultadoVeredito = { corte: number; meses: number; melhor?: GrupoSelo; bom?: GrupoSelo; aguarde?: GrupoSelo };

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
    janela: { de: string; ate: string } | null; // onde o próximo pico/fundo caiu nos ciclos passados
    picoVacas: { mes: string; femeas: number; confirmado: boolean } | null;
    mesesDesdePicoVacas: number | null; // só com a virada confirmada
    atrasoPicoBoi: number[];
    femeas: number | null;
    femeasMedia10: number;
  };
  troca: { atual: number; p25: number; mediana: number; p75: number };
  previsao: { semana: string; dataBase: string; itens: ItemPrevisao[] } | null;
  acerto: {
    teste: { periodo: string; treinoAte: string; itens: AcertoTeste[] };
    anoAno: {
      periodo: string;
      itens: { alvo: "boi" | "bezerro"; semanas: number; erroMedioModelo: number; erroMedioIngenuo: number; anosMelhor: number; anos: number }[];
    };
    aoVivo: AvaliacaoAoVivo[];
    vereditos: { periodo: string; relatorio: Record<string, ResultadoVeredito> };
  };
  noticias: {
    semana: string;
    classificadas: boolean;
    termometro: { relevantes: number; saldo: number; porVariavel: Record<string, { n: number; saldo: number }> };
    itens: { fonte: string; titulo: string; link: string; data: string; resumo?: string; classe?: { relevante: boolean; direcao: "sobe" | "cai" | "neutro"; variavel: string } }[];
  } | null;
  pracas: { data: string; valores: Record<string, { vista: number | null; prazo30: number | null }> } | null;
  selic: { data: string; valor: number };
  reposicao: {
    data: string;
    categorias: Record<CategoriaReposicao, { nome: string; ref: string; peso: number; url: string; ufs: Record<string, { cab: number; kg: number; troca: number | null; marcado?: boolean }> }>;
  } | null;
};

export type CategoriaReposicao = "desmama" | "bezerro" | "garrote" | "boiMagro";

export const painel = dados as unknown as Painel;
