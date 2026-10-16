import { dataBr, pct, reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo (R$/@)", bezerro: "Bezerro MS (R$/cabeça)" } as const;

// Previsões registradas na segunda-feira da semana. Nunca são editadas depois.
// Ao lado da faixa, quantas vezes o preço real ficou dentro dela no teste às cegas: a faixa promete 8 em 10, mas nem sempre cumpre.
export function Previsao({ previsao, teste }: { previsao: NonNullable<Painel["previsao"]>; teste: Painel["acerto"]["teste"] }) {
  const dentro = (alvo: string, semanas: number) => teste.itens.find((t) => t.alvo === alvo && t.semanas === semanas)?.dentroDaFaixa80;
  const nota = `A faixa foi feita para conter o preço real 8 em cada 10 vezes. "No teste" mostra quantas vezes isso aconteceu de verdade em ${teste.periodo}.`;
  return (
    <>
    {/* Celular: um cartão por preço, sem tabela larga escondendo números */}
    <div className="space-y-3 sm:hidden">
      <p className="text-xs text-texto-3">
        Registrada na semana {previsao.semana}, com o preço de {dataBr(previsao.dataBase)}. Depois de registrada, nunca é alterada. {nota}
      </p>
      {(["boi", "bezerro"] as const).map((alvo) => (
        <div key={alvo} className="rounded-2xl border border-linha bg-superficie p-4">
          <p className="font-medium text-texto">{NOME[alvo]}</p>
          <ul className="mt-2 divide-y divide-linha tabular-nums">
            {previsao.itens.filter((i) => i.alvo === alvo).map((i) => (
              <li key={i.semanas} className="flex items-baseline justify-between gap-3 py-2">
                <span className="whitespace-nowrap text-sm text-texto-3">{i.semanas} semanas</span>
                <span className="text-right">
                  <span className="block text-lg font-semibold text-texto">{reais(i.previsto)}</span>
                  <span className="block text-xs text-texto-3">
                    faixa {reais(i.minimo)} a {reais(i.maximo)}
                  </span>
                  {dentro(i.alvo, i.semanas) != null && (
                    <span className={`block text-xs ${dentro(i.alvo, i.semanas)! >= 0.7 ? "text-texto-3" : "text-sol"}`}>no teste: {pct(dentro(i.alvo, i.semanas)!)} dentro</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-linha sm:block">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="bg-superficie px-4 py-3 text-left text-xs text-texto-3">
          Registrada na semana {previsao.semana}, com o preço de {dataBr(previsao.dataBase)}. Depois de registrada, nunca é alterada. {nota}
        </caption>
        <thead className="bg-superficie text-xs text-texto-3">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">Preço</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Prazo</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Previsto</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Faixa provável</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Dentro, no teste</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {previsao.itens.map((i) => (
            <tr key={`${i.alvo}${i.semanas}`} className="border-t border-linha">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-texto-2">{NOME[i.alvo]}</th>
              <td className="px-4 py-2.5 text-right text-texto-3">{i.semanas} semanas</td>
              <td className="px-4 py-2.5 text-right font-medium text-texto">{reais(i.previsto)}</td>
              <td className="px-4 py-2.5 text-right text-texto-3">{reais(i.minimo)} a {reais(i.maximo)}</td>
              <td className={`px-4 py-2.5 text-right ${(dentro(i.alvo, i.semanas) ?? 1) >= 0.7 ? "text-texto-3" : "text-sol"}`}>{dentro(i.alvo, i.semanas) != null ? pct(dentro(i.alvo, i.semanas)!) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
