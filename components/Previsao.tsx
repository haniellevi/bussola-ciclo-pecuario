import { pct, reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo", bezerro: "Bezerro MS" } as const;
const UNIDADE = { boi: "R$ por arroba", bezerro: "R$ por cabeça" } as const;

// Previsões registradas na segunda-feira da semana. Nunca são editadas depois.
// Um cartão por preço; em cada prazo, o valor grande, a faixa como barra e quantas vezes a faixa acertou no teste às cegas.
export function Previsao({ previsao, teste }: { previsao: NonNullable<Painel["previsao"]>; teste: Painel["acerto"]["teste"] }) {
  const dentro = (alvo: string, semanas: number) => teste.itens.find((t) => t.alvo === alvo && t.semanas === semanas)?.dentroDaFaixa80;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {(["boi", "bezerro"] as const).map((alvo) => {
          const itens = previsao.itens.filter((i) => i.alvo === alvo);
          const lo = Math.min(...itens.map((i) => i.minimo));
          const hi = Math.max(...itens.map((i) => i.maximo));
          const pos = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
          return (
            <section key={alvo} className="rounded-3xl bg-superficie p-5">
              <h3 className="text-lg font-semibold text-texto">
                {NOME[alvo]} <span className="text-sm font-normal text-texto-3">{UNIDADE[alvo]}</span>
              </h3>
              <ul className="mt-2">
                {itens.map((i) => {
                  const d = dentro(i.alvo, i.semanas);
                  return (
                    <li key={i.semanas} className="space-y-2 border-t border-superficie-2 py-3.5 first:border-t-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-texto-3">Em {i.semanas} semanas</span>
                        <span className="text-2xl font-semibold tabular-nums text-texto">{reais(i.previsto)}</span>
                      </div>
                      {/* Faixa provável como barra: onde o preço deve ficar, e o ponto é o valor previsto */}
                      <div aria-hidden className="relative h-2 rounded-full bg-superficie-2">
                        <div className="absolute inset-y-0 rounded-full bg-tinta/25" style={{ left: pos(i.minimo), width: `calc(${pos(i.maximo)} - ${pos(i.minimo)})` }} />
                        <div className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-superficie bg-tinta" style={{ left: pos(i.previsto) }} />
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-texto-3">
                        <span>
                          entre {reais(i.minimo)} e {reais(i.maximo)}
                        </span>
                        {d != null && <span className={d >= 0.7 ? "" : "text-sol"}>no teste: {pct(d)} dentro</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-texto-3">
        A faixa foi feita para conter o preço real 8 em cada 10 vezes. &quot;No teste&quot; mostra quantas vezes isso aconteceu de verdade em {teste.periodo}.
      </p>
    </div>
  );
}
