// Margem do negócio: conta o resultado por cabeça com a estrutura e a estratégia de quem usa.
// Tudo é conta simples e aberta: nenhum preço ou custo é decidido aqui, quem informa é a pessoa.
export type Estrutura = "recria" | "confinamento" | "cria" | "revenda";
export type Selo = "compensa" | "apertada" | "nao";

export type Entradas = {
  estrutura: Estrutura;
  // Engorda a pasto e confinamento
  compraCab: number; // R$/cabeça paga na compra (revenda: compra do animal)
  pesoCompra: number; // kg vivo
  pesoVenda: number; // kg vivo (revenda: igual ao da compra)
  gmd: number; // ganho de peso por dia (kg)
  custoDia: number; // R$/cabeça/dia (comida + operação)
  rendimento: number; // % de carcaça (engorda)
  vendaArroba: number; // R$/@ do boi gordo
  mortalidade: number; // % de animais que se perdem
  // Cria
  taxaDesmama: number; // % de bezerros desmamados por matriz por ano
  custoMatrizAno: number; // R$/matriz/ano
  valorMatriz: number; // R$ da matriz (capital parado)
  vendaBezerro: number; // R$/cabeça do bezerro vendido
  // Revenda
  vendaCab: number; // R$/cabeça na venda
  diasRevenda: number;
  quebra: number; // % de perda de valor no transporte (peso e mortes)
  // Comum
  frete: number; // R$/cabeça (todas as viagens)
  juros: number; // % ao ano, custo do dinheiro parado
};

export type Partes = { compra: number; frete: number; operacao: number; juros: number; perdas: number };
export type Resultado = {
  dias: number;
  receita: number;
  capital: number; // dinheiro parado no negócio (por cabeça)
  partes: Partes;
  margem: number; // R$ por cabeça (cria: por matriz, no ano)
  margemMes: number; // R$ por cabeça por mês
  retorno: number; // margem ÷ capital
  selo: Selo;
  // Quanto o preço de venda e o de compra podem andar até a margem zerar
  empateVenda: number; // R$/@ (cria: R$/bezerro; revenda: R$/cabeça)
  tetoCompra: number; // R$/cabeça máximo para a margem não ficar negativa
  principal: keyof Partes; // maior fatia de custo
};

export const NOME_ESTRUTURA: Record<Estrutura, string> = {
  recria: "Recria e engorda a pasto",
  confinamento: "Confinamento (giro contínuo)",
  cria: "Cria",
  revenda: "Compra para revenda",
};
export const NOME_PARTE: Record<keyof Partes, string> = {
  compra: "o animal comprado",
  frete: "o frete",
  operacao: "o custo diário (comida e operação)",
  juros: "o custo do dinheiro parado",
  perdas: "as perdas (mortes e quebra)",
};
// Folga mínima para dizer que compensa: 5% sobre o dinheiro parado, já descontados os juros.
export const FOLGA_COMPENSA = 0.05;

const ARROBA_KG = 15;

export function calcular(e: Entradas): Resultado {
  const diasAno = 365;
  let dias: number, receita: number, compra: number, operacao: number, perdas: number, capital: number;
  const jurosDia = e.juros / 100 / diasAno;

  if (e.estrutura === "cria") {
    // Por matriz, em 1 ano.
    dias = diasAno;
    receita = (e.taxaDesmama / 100) * e.vendaBezerro;
    compra = 0;
    operacao = e.custoMatrizAno;
    perdas = 0;
    capital = e.valorMatriz + e.custoMatrizAno / 2;
  } else if (e.estrutura === "revenda") {
    dias = Math.max(1, e.diasRevenda);
    receita = e.vendaCab;
    compra = e.compraCab;
    operacao = 0;
    perdas = (e.quebra / 100) * e.vendaCab;
    capital = e.compraCab + e.frete;
  } else {
    dias = e.gmd > 0 ? Math.max(1, Math.round((e.pesoVenda - e.pesoCompra) / e.gmd)) : 9999;
    const arrobas = (e.pesoVenda * (e.rendimento / 100)) / ARROBA_KG;
    receita = arrobas * e.vendaArroba;
    compra = e.compraCab;
    operacao = e.custoDia * dias;
    perdas = (e.mortalidade / 100) * receita;
    capital = e.compraCab + e.frete + operacao / 2;
  }
  const juros = capital * jurosDia * dias;
  const frete = e.estrutura === "cria" ? 0 : e.frete;
  const partes: Partes = { compra, frete, operacao, juros, perdas };
  const margem = receita - compra - frete - operacao - juros - perdas;
  const retorno = capital > 0 ? margem / capital : 0;
  const selo: Selo = margem < 0 ? "nao" : retorno >= FOLGA_COMPENSA ? "compensa" : "apertada";

  // Empate: preço de venda em que a margem é zero (as demais contas ficam como estão).
  const semReceita = compra + frete + operacao + juros;
  let empateVenda: number;
  if (e.estrutura === "cria") empateVenda = e.taxaDesmama > 0 ? semReceita / (e.taxaDesmama / 100) : Infinity;
  else if (e.estrutura === "revenda") empateVenda = semReceita / (1 - e.quebra / 100);
  else {
    const arrobas = (e.pesoVenda * (e.rendimento / 100)) / ARROBA_KG;
    empateVenda = arrobas > 0 ? semReceita / (arrobas * (1 - e.mortalidade / 100)) : Infinity;
  }
  const tetoCompra = e.estrutura === "cria" ? Infinity : e.compraCab + margem;
  const principal = (Object.keys(partes) as (keyof Partes)[]).reduce((a, b) => (partes[b] > partes[a] ? b : a));
  return { dias, receita, capital, partes, margem, margemMes: margem / (dias / 30.4), retorno, selo, empateVenda, tetoCompra, principal };
}

// Custo da arroba produzida: custo diário ÷ (ganho diário em kg ÷ 15 kg por arroba).
export const custoArroba = (custoDiario: number, gmdKg: number) => (gmdKg > 0 ? custoDiario / (gmdKg / ARROBA_KG) : Infinity);
