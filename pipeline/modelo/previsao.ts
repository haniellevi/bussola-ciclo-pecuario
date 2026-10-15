// Previsão de preço: regressão linear simples (com leve regularização) sobre sinais do ciclo.
// Prevê a variação percentual (log) do preço nominal em h meses, a partir só do que se sabia no mês t.
import type { Mes } from "./dados.ts";

export type Alvo = "boi" | "bezerro";

const JANELA_LONGA = 120; // até 10 anos de histórico para as médias de referência
// Mínimo de meses com dado dentro da janela longa. 120 = exige os 10 anos completos (modelo anterior);
// 60 ou 36 aceitam menos anos e treinam com mais meses, mas no teste ano a ano de 2014–2025 o resultado ficou instável
// (melhor em 3 meses, pior em 1 ano), então o padrão continua 120.
const JANELA_MIN = Number(process.env.JANELA_MIN ?? 120);

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// Sinais explicáveis. Retorna null se faltar dado.
export function sinais(serie: Mes[], i: number, alvo: Alvo): Record<string, number> | null {
  const m = serie[i];
  const preco = (k: number) => serie[k]?.[alvo];
  const real = (k: number) => (alvo === "boi" ? serie[k]?.boiReal : serie[k]?.bezerroReal);
  if (i < 12 || m.femeas == null || serie[i - 6]?.femeas == null) return null;
  const p = preco(i), p3 = preco(i - 3), p12 = preco(i - 12);
  const trecho = serie.slice(Math.max(0, i - JANELA_LONGA + 1), i + 1);
  const presentes = (v: (number | null | undefined)[]) => v.filter((x): x is number => x != null);
  const reaisLongos = presentes(trecho.map((_, k) => real(i - trecho.length + 1 + k)));
  const femeasLongas = presentes(trecho.map((x) => x.femeas));
  const rts = presentes(trecho.map((x) => x.rt));
  if ([p, p3, p12, m.rt, real(i)].some((v) => v == null)) return null;
  if ([reaisLongos, femeasLongas, rts].some((v) => v.length < JANELA_MIN)) return null;
  const mesDoAno = Number(m.mes.slice(5)) - 1;
  return {
    femeasVsMedia: (m.femeas - media(femeasLongas)) * 100,
    femeasDirecao: (m.femeas - serie[i - 6].femeas!) * 100,
    momento3m: Math.log(p! / p3!),
    momento12m: Math.log(p! / p12!),
    precoRealVsMedia: Math.log(real(i)! / media(reaisLongos)),
    trocaVsMedia: Math.log(m.rt! / media(rts)),
    sazonalSen: Math.sin((2 * Math.PI * mesDoAno) / 12),
    sazonalCos: Math.cos((2 * Math.PI * mesDoAno) / 12),
  };
}

export type Modelo = {
  alvo: Alvo;
  horizonte: number;
  nomes: string[];
  pesos: number[]; // [intercepto, ...]
  centro: number[];
  escala: number[];
  erroP10: number; // faixa de 80%: quantis dos erros no treino
  erroP90: number;
  amostras: number;
};

function resolver(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((l, i) => l[n] / l[i]);
}

const quantil = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

export function amostras(serie: Mes[], alvo: Alvo, h: number, ateMes: string) {
  const X: Record<string, number>[] = [];
  const y: number[] = [];
  for (let i = 0; i + h < serie.length; i++) {
    if (serie[i + h].mes > ateMes) break; // o resultado precisa ser conhecido até `ateMes`
    const s = sinais(serie, i, alvo);
    const futuro = serie[i + h][alvo];
    if (!s || futuro == null) continue;
    X.push(s);
    y.push(Math.log(futuro / serie[i][alvo]!));
  }
  return { X, y };
}

export function treinar(serie: Mes[], alvo: Alvo, h: number, ateMes: string, ridge = 1): Modelo {
  const { X, y } = amostras(serie, alvo, h, ateMes);
  const nomes = Object.keys(X[0]);
  const col = nomes.map((n) => X.map((x) => x[n]));
  const centro = col.map(media);
  const escala = col.map((c, j) => Math.sqrt(media(c.map((v) => (v - centro[j]) ** 2))) || 1);
  const Z = X.map((x) => [1, ...nomes.map((n, j) => (x[n] - centro[j]) / escala[j])]);
  const k = nomes.length + 1;
  const A = Array.from({ length: k }, (_, a) =>
    Array.from({ length: k }, (_, b) => Z.reduce((s, z) => s + z[a] * z[b], 0) + (a === b && a > 0 ? ridge * Z.length * 0.01 : 0)),
  );
  const b = Array.from({ length: k }, (_, a) => Z.reduce((s, z, i) => s + z[a] * y[i], 0));
  const pesos = resolver(A, b);
  const erros = Z.map((z, i) => y[i] - z.reduce((s, v, j) => s + v * pesos[j], 0));
  return {
    alvo, horizonte: h, nomes, pesos, centro, escala,
    erroP10: quantil(erros, 0.1), erroP90: quantil(erros, 0.9), amostras: y.length,
  };
}

// Faixa honesta: erros de previsões feitas "às cegas" no passado (treina até o ano anterior,
// prevê o ano seguinte), em vez dos erros do próprio treino, que são otimistas.
export function treinarCalibrado(serie: Mes[], alvo: Alvo, h: number, ateMes: string): Modelo {
  const erros: number[] = [];
  const anoFim = Number(ateMes.slice(0, 4));
  for (let ano = anoFim - 9; ano <= anoFim; ano++) {
    const corte = `${ano - 1}-12`;
    const m = treinar(serie, alvo, h, corte);
    serie.forEach((x, i) => {
      if (!x.mes.startsWith(String(ano)) || !serie[i + h] || serie[i + h].mes > ateMes) return;
      const p = prever(m, serie, i);
      const real = serie[i + h][alvo];
      if (p && real != null) erros.push(Math.log(real / p.previsto));
    });
  }
  const final = treinar(serie, alvo, h, ateMes);
  return { ...final, erroP10: quantil(erros, 0.1), erroP90: quantil(erros, 0.9) };
}

export function prever(modelo: Modelo, serie: Mes[], i: number) {
  const s = sinais(serie, i, modelo.alvo);
  if (!s) return null;
  const z = [1, ...modelo.nomes.map((n, j) => (s[n] - modelo.centro[j]) / modelo.escala[j])];
  const logVar = z.reduce((acc, v, j) => acc + v * modelo.pesos[j], 0);
  const base = serie[i][modelo.alvo]!;
  return {
    base,
    previsto: base * Math.exp(logVar),
    minimo: base * Math.exp(logVar + modelo.erroP10),
    maximo: base * Math.exp(logVar + modelo.erroP90),
    contribuicoes: Object.fromEntries(modelo.nomes.map((n, j) => [n, z[j + 1] * modelo.pesos[j + 1]])),
  };
}
