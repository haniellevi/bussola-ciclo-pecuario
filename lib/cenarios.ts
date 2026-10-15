// Cenários de preço de venda: usa a faixa de 80% da previsão registrada (pior, esperado, melhor).
// O horizonte é o mais próximo do prazo da operação (13 ou 52 semanas); o preço da pessoa é escalado pela mesma variação.
import { calcular, type Entradas, type Resultado } from "./margem.ts";
import type { Painel } from "./painel.ts";

export type Cenarios = { semanas: number; pior: Resultado; esperado: Resultado; melhor: Resultado };

export function cenarios(e: Entradas, painel: Painel, dias: number): Cenarios | null {
  if (e.estrutura === "revenda") return null; // revenda vende por um preço combinado, sem previsão
  const alvo = e.estrutura === "cria" ? "bezerro" : "boi";
  const horizonte = dias <= 227 ? 13 : 52;
  const it = painel.previsao?.itens.find((i) => i.alvo === alvo && i.semanas === horizonte);
  if (!it) return null;
  const campo = alvo === "boi" ? "vendaArroba" : "vendaBezerro";
  const com = (preco: number) => calcular({ ...e, [campo]: (e[campo] * preco) / it.base });
  return { semanas: horizonte, pior: com(it.minimo), esperado: com(it.previsto), melhor: com(it.maximo) };
}
