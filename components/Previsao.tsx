import { dataBr, reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo (R$/@)", bezerro: "Bezerro MS (R$/cabeça)" } as const;

// Previsões registradas na segunda-feira da semana. Nunca são editadas depois.
export function Previsao({ previsao }: { previsao: NonNullable<Painel["previsao"]> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-terra-700">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="bg-terra-900 px-4 py-3 text-left text-xs text-zinc-400">
          Registrada na semana {previsao.semana}, com o preço de {dataBr(previsao.dataBase)}. Depois de registrada, nunca é alterada.
        </caption>
        <thead className="bg-terra-900 text-xs text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">Preço</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Prazo</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Previsto</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Faixa provável</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {previsao.itens.map((i) => (
            <tr key={`${i.alvo}${i.semanas}`} className="border-t border-terra-800">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-zinc-300">{NOME[i.alvo]}</th>
              <td className="px-4 py-2.5 text-right text-zinc-400">{i.semanas} semanas</td>
              <td className="px-4 py-2.5 text-right font-medium text-zinc-100">{reais(i.previsto)}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400">{reais(i.minimo)} a {reais(i.maximo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
