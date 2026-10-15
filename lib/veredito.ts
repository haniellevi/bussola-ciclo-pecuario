// Veredito de compra por perfil. Regras simples e explicadas: cada ponto vira um motivo na tela.
import { numero, pct } from "./formato.ts";

export type Perfil = "cria" | "engorda" | "iniciante";
export type Selo = "melhor" | "bom" | "aguarde";
export type Estagio = "inicio-alta" | "meio-alta" | "alta-madura" | "inicio-queda" | "meio-queda" | "fim-queda";

export type Entrada = {
  sobe: boolean;
  meses: number; // desde o último pico/vale confirmado
  duracaoSubidas: number[];
  duracaoQuedas: number[];
  realVsPicoAnterior: number | null;
  // Relógio das vacas: meses desde o pico de fêmeas no abate desta alta (null = descarte de vacas ainda não virou)
  mesesDesdePicoFemeas: number | null;
  atrasoPicoBoi: number[]; // nos ciclos passados, meses entre o pico de fêmeas e o pico do boi
  boi: number; // R$/@
  bezerro: number; // R$/cabeça
  troca: { p25: number; mediana: number; p75: number }; // relação de troca dos últimos 10 anos
  previsaoBoi13: number | null; // variação prevista (0.05 = +5%)
  previsaoBezerro13: number | null;
};

export type Veredito = { selo: Selo; titulo: string; motivos: string[]; venda: string };

export const TEXTO_SELO: Record<Selo, string> = {
  melhor: "Melhor momento de compra",
  bom: "Bom para comprar",
  aguarde: "Aguarde",
};

export const NOME_ESTAGIO: Record<Estagio, string> = {
  "inicio-alta": "início da alta",
  "meio-alta": "alta",
  "alta-madura": "fim da alta",
  "inicio-queda": "início da queda",
  "meio-queda": "queda",
  "fim-queda": "fim da queda",
};

export const relacaoTroca = (boi: number, bezerro: number) => (18 * boi) / bezerro;

export function estagio(e: Entrada): Estagio {
  const ref = e.sobe ? e.duracaoSubidas : e.duracaoQuedas;
  const min = Math.min(...ref);
  if (e.sobe) {
    if (e.meses < min / 2) return "inicio-alta";
    // O pico do boi nunca veio antes de o descarte de vacas virar e de passar o atraso mínimo já visto.
    const vacas = e.mesesDesdePicoFemeas != null && (!e.atrasoPicoBoi.length || e.mesesDesdePicoFemeas >= Math.min(...e.atrasoPicoBoi));
    return e.meses >= min && vacas ? "alta-madura" : "meio-alta";
  }
  return e.meses < min / 2 ? "inicio-queda" : e.meses < min ? "meio-queda" : "fim-queda";
}

export function descreverEstagio(e: Entrada): string {
  const ref = e.sobe ? e.duracaoSubidas : e.duracaoQuedas;
  const faixa = `${Math.min(...ref)} a ${Math.max(...ref)} meses`;
  const nome = { "inicio-alta": "Início da alta", "meio-alta": "Alta", "alta-madura": "Fim da alta", "inicio-queda": "Início da queda", "meio-queda": "Queda", "fim-queda": "Fim da queda" }[estagio(e)];
  const base = `${nome}: o preço ${e.sobe ? "sobe" : "cai"} há ${e.meses} meses (antes durou de ${faixa}).`;
  if (!e.sobe || !e.atrasoPicoBoi.length) return base;
  const at = `${Math.min(...e.atrasoPicoBoi)} a ${Math.max(...e.atrasoPicoBoi)} meses`;
  return e.mesesDesdePicoFemeas == null
    ? `${base} O descarte de vacas ainda não virou; nos ciclos passados o pico do boi veio ${at} depois dessa virada.`
    : `${base} O descarte de vacas virou há ${e.mesesDesdePicoFemeas} meses; nos ciclos passados o pico do boi veio ${at} depois.`;
}

const seloPorPontos = (p: number): Selo => (p >= 2 ? "melhor" : p >= 1 ? "bom" : "aguarde");

function pontosTroca(rt: number, t: Entrada["troca"]): [number, string] {
  const txt = `1 boi gordo compra ${numero(rt)} bezerros`;
  if (rt >= t.p75) return [2, `${txt}: entre as melhores trocas dos últimos 10 anos (acima de ${numero(t.p75)}).`];
  if (rt >= t.mediana) return [1, `${txt}: acima do normal dos últimos 10 anos (${numero(t.mediana)}).`];
  if (rt >= t.p25) return [0, `${txt}: um pouco abaixo do normal (${numero(t.mediana)}).`];
  return [-1, `${txt}: entre as piores trocas dos últimos 10 anos (abaixo de ${numero(t.p25)}). Reposição cara.`];
}

// Pesos testados em 2015–2023 depois de desenhados só com 2006–2014 (pipeline/modelo/backtest-veredito.ts).
// O que mais separou bons e maus negócios foi o momento do ciclo; a troca só ajuda quando está entre as melhores.
export const PONTOS_ESTAGIO_ENGORDA: Record<Estagio, [number, string]> = {
  "inicio-alta": [1, "Quem compra agora tende a vender com o boi mais caro."],
  "meio-alta": [-1, "A alta já passou da metade do que costuma durar: o bezerro tende a encarecer mais rápido que o boi."],
  "alta-madura": [-1, "Já está na faixa em que os ciclos anteriores viraram. Quem compra caro agora pode vender depois do pico."],
  "inicio-queda": [-1, "O boi tende a cair até a venda."],
  "meio-queda": [1, "A reposição vai ficando mais barata e a venda tende a pegar a recuperação."],
  "fim-queda": [2, "Reposição barata e alta pela frente, se o ciclo repetir."],
};

export const PONTOS_ESTAGIO_CRIA: Record<Estagio, [number, string]> = {
  "inicio-alta": [1, "Matrizes ainda em preço razoável e bezerro valorizando."],
  "meio-alta": [0, "Matrizes já subiram."],
  "alta-madura": [-1, "Matrizes e novilhas no auge do preço. Comprar agora é pagar o topo."],
  "inicio-queda": [-1, "O preço das matrizes ainda vai cair."],
  "meio-queda": [1, "Vacas indo para o abate, matrizes ficando baratas."],
  "fim-queda": [2, "Matrizes baratas antes da próxima alta. Historicamente, a melhor hora para a cria."],
};

const variacao = (v: number | null, nome: string) =>
  v == null ? "" : ` O modelo prevê ${nome} ${v >= 0 ? "subindo" : "caindo"} ${pct(Math.abs(v), 1)} em 13 semanas.`;

export function veredito(perfil: Perfil, e: Entrada): Veredito {
  const est = estagio(e);
  const rt = relacaoTroca(e.boi, e.bezerro);
  const [pTroca, mTroca] = pontosTroca(rt, e.troca);

  const engorda = (): Veredito => {
    const [pEst, mEst] = PONTOS_ESTAGIO_ENGORDA[est];
    const selo = seloPorPontos(Math.max(0, pTroca - 1) + pEst);
    const venda =
      e.previsaoBoi13 != null && e.previsaoBoi13 > 0.02
        ? `Venda do boi gordo: se o pasto e o caixa permitem, segurar pode compensar.${variacao(e.previsaoBoi13, "o boi")} Para se proteger de queda, avalie travar parte na B3.`
        : `Venda do boi gordo: sem alta forte prevista.${variacao(e.previsaoBoi13, "o boi")} Animal pronto não precisa esperar.`;
    return { selo, titulo: TEXTO_SELO[selo], motivos: [mTroca, mEst], venda };
  };

  const cria = (): Veredito => {
    const [pEst, mEst] = PONTOS_ESTAGIO_CRIA[est];
    const selo = seloPorPontos(pEst);
    const venda = e.sobe
      ? `Venda de bezerros: bom momento, bezerro valorizado (${e.bezerro.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/cabeça).${variacao(e.previsaoBezerro13, "o bezerro")} Com o ciclo ${est === "alta-madura" ? "perto do pico" : "em alta"}, segurar fêmeas para reprodução faz sentido só se houver pasto.`
      : "Venda de bezerros: preço em queda. Descartar vacas velhas e improdutivas agora ajuda o caixa.";
    return { selo, titulo: TEXTO_SELO[selo], motivos: [mEst, `Para a cria, a troca pesa menos: ${mTroca.charAt(0).toLowerCase()}${mTroca.slice(1)}`], venda };
  };

  if (perfil === "engorda") return engorda();
  if (perfil === "cria") return cria();

  // Iniciante: só recomenda o que vale para as duas atividades; erra para o lado da cautela.
  const a = engorda(), b = cria();
  const ordem: Selo[] = ["aguarde", "bom", "melhor"];
  const pior = ordem[Math.min(ordem.indexOf(a.selo), ordem.indexOf(b.selo))];
  const selo: Selo = pior === "melhor" ? "melhor" : pior === "bom" ? "bom" : "aguarde";
  const motivos =
    selo === "aguarde"
      ? [
          "Para quem está começando, o risco de entrar na hora errada é o maior de todos.",
          ...a.motivos,
          "Alternativas enquanto espera: guardar o capital em renda fixa, começar pequeno em parceria ou arrendamento, e acompanhar a virada aqui.",
        ]
      : ["As condições estão favoráveis para a cria e para a engorda.", ...a.motivos, "Comece pequeno e com reserva de caixa para pelo menos 12 meses."];
  return { selo, titulo: TEXTO_SELO[selo], motivos, venda: "Antes de vender ou comprar, faça a conta do custo por arroba no simulador abaixo." };
}

// Custo da arroba produzida: custo diário ÷ (ganho diário em kg ÷ 15 kg por arroba).
export const custoArroba = (custoDiario: number, gmdKg: number) => (gmdKg > 0 ? custoDiario / (gmdKg / 15) : Infinity);
