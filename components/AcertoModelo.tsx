import { pct } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo", bezerro: "Bezerro" } as const;

export function AcertoModelo({ acerto }: { acerto: Painel["acerto"] }) {
  const vivo = acerto.aoVivo;
  const grupos = [4, 13, 52].flatMap((s) =>
    (["boi", "bezerro"] as const).map((alvo) => {
      const g = vivo.filter((a) => a.alvo === alvo && a.semanas === s);
      return { alvo, s, n: g.length, erro: g.reduce((t, a) => t + Math.abs(a.erro), 0) / (g.length || 1), dentro: g.filter((a) => a.dentro).length / (g.length || 1) };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-terra-700">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="bg-terra-900 px-4 py-3 text-left text-xs text-zinc-400">
            Teste no passado: modelo ajustado só com dados até {acerto.teste.treinoAte.slice(0, 4)}, previsões feitas às cegas em {acerto.teste.periodo}.
          </caption>
          <thead className="bg-terra-900 text-xs text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Previsão</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Erro médio</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Se chutasse &quot;preço parado&quot;</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Acertou a direção</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Real dentro da faixa</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {acerto.teste.itens.map((it) => {
              const ganhou = it.erroMedioModelo < it.erroMedioIngenuo;
              return (
                <tr key={`${it.alvo}${it.semanas}`} className="border-t border-terra-800">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-zinc-300">
                    {NOME[it.alvo]} em {it.semanas} semanas
                  </th>
                  <td className={`px-4 py-2.5 text-right ${ganhou ? "text-capim" : "text-zinc-300"}`}>{pct(it.erroMedioModelo, 1)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500">{pct(it.erroMedioIngenuo, 1)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-300">{pct(it.acertoDirecao)}</td>
                  <td className={`px-4 py-2.5 text-right ${it.dentroDaFaixa80 >= 0.7 ? "text-zinc-300" : "text-sol"}`}>{pct(it.dentroDaFaixa80)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1.5 text-sm text-zinc-400">
        <li>A faixa foi feita para conter o preço real 8 em cada 10 vezes. Em 1 ano ela errou mais: a incerteza é grande.</li>
        <li>O teste cobre um só trecho do ciclo, quase todo de alta. É pouca prova; o acompanhamento ao vivo abaixo é o que vale.</li>
      </ul>

      <div className="rounded-2xl border border-terra-700 bg-terra-900/60 p-5">
        <h3 className="font-display text-lg text-zinc-100">Ao vivo, semana a semana</h3>
        {vivo.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">
            Toda segunda a previsão é registrada e não muda mais. A primeira comparação com o preço real sai 4 semanas depois do primeiro registro.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {grupos.filter((g) => g.n).map((g) => (
              <li key={`${g.alvo}${g.s}`} className="rounded-lg bg-terra-950 px-3 py-2 text-zinc-300">
                {NOME[g.alvo]} em {g.s} sem.: erro {pct(g.erro, 1)}, dentro da faixa {pct(g.dentro)} ({g.n} previsões)
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
