import { dataBr, reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo (R$/@)", bezerro: "Bezerro MS (R$/cabeça)" } as const;

// Previsões registradas na segunda-feira da semana. Nunca são editadas depois.
export function Previsao({ previsao }: { previsao: NonNullable<Painel["previsao"]> }) {
  return (
    <>
    {/* Celular: um cartão por preço, sem tabela larga escondendo números */}
    <div className="space-y-3 sm:hidden">
      <p className="text-xs text-zinc-400">
        Registrada na semana {previsao.semana}, com o preço de {dataBr(previsao.dataBase)}. Depois de registrada, nunca é alterada.
      </p>
      {(["boi", "bezerro"] as const).map((alvo) => (
        <div key={alvo} className="rounded-2xl border border-terra-700 bg-terra-900 p-4">
          <p className="font-medium text-zinc-100">{NOME[alvo]}</p>
          <ul className="mt-2 divide-y divide-terra-800 tabular-nums">
            {previsao.itens.filter((i) => i.alvo === alvo).map((i) => (
              <li key={i.semanas} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm text-zinc-400">{i.semanas} semanas</span>
                <span className="text-right">
                  <span className="block text-lg font-semibold text-zinc-50">{reais(i.previsto)}</span>
                  <span className="block text-xs text-zinc-400">
                    faixa {reais(i.minimo)} a {reais(i.maximo)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-terra-700 sm:block">
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
    </>
  );
}
