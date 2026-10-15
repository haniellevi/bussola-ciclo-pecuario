const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const reais = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: casas, minimumFractionDigits: casas });

export const numero = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

export const pct = (v: number, casas = 0) => `${numero(v * 100, casas)}%`;

// "2023-09" → "set/2023"
export const mesAno = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;

// "2026-10-14" → "14/10/2026"
export const dataBr = (d: string) => d.split("-").reverse().join("/");

export const somarMeses = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
