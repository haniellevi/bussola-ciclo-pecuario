// Histórico de decisões da calculadora, guardado só no aparelho (localStorage). Sem servidor, sem login.
export const CHAVE_HISTORICO = "bussola:historico";
export const EVENTO_HISTORICO = "bussola:historico"; // avisa a onda na mesma página

export type Registro = {
  id: string;
  data: string; // AAAA-MM-DD
  titulo: string; // ex.: "Recria a pasto em MT"
  veredito: string; // ex.: "Não compensa, −R$ 822 por cabeça"
  decisao: string; // "Vou comprar" | "Vou esperar" | "Só simulando"
  detalhe: string; // números principais
};

export function lerHistorico(): Registro[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function gravarHistorico(lista: Registro[]) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista));
  } catch {}
  window.dispatchEvent(new Event(EVENTO_HISTORICO));
}

// Planilha simples (abre no Excel): uma linha por decisão.
export function historicoCsv(lista: Registro[]) {
  const c = (t: string) => `"${t.replace(/"/g, '""')}"`;
  return ["Data;Negócio;Resultado;Decisão;Números", ...lista.map((r) => [r.data.split("-").reverse().join("/"), r.titulo, r.veredito, r.decisao, r.detalhe].map(c).join(";"))].join("\n");
}
