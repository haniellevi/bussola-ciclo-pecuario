import { numero, pct } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const NOME = { boi: "Boi gordo", bezerro: "Bezerro" } as const;
const ROTULO = { melhor: "Melhor momento", bom: "Bom para comprar", aguarde: "Aguarde" } as const;
const COR = { melhor: "text-capim", bom: "text-sol", aguarde: "text-alerta" } as const;
const sinal = (v: number) => `${v >= 0 ? "+" : ""}${pct(v)}`;
const VEREDITOS = [
  { chave: "engorda/engorda", titulo: "Recria / Engorda", explica: "Quantos bezerros o boi vendido 18 meses depois pagou", fmt: (v: number) => `${numero(v)} bezerros` },
  { chave: "cria/cria", titulo: "Cria", explica: "Quanto o bezerro valorizou (descontada a inflação) em 30 meses", fmt: sinal },
  { chave: "iniciante/engorda", titulo: "Iniciante (engorda)", explica: "Mesmo critério da engorda", fmt: (v: number) => `${numero(v)} bezerros` },
  { chave: "iniciante/cria", titulo: "Iniciante (cria)", explica: "Mesmo critério da cria", fmt: sinal },
];

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
        <li>O teste acima cobre um só trecho do ciclo, quase todo de alta. Por isso fizemos o teste mais duro abaixo.</li>
      </ul>

      <div className="rounded-2xl border border-terra-700 bg-terra-900/60 p-5">
        <h3 className="font-display text-lg text-zinc-100">Teste mais duro: ano a ano, {acerto.anoAno.periodo}</h3>
        <p className="mt-1 text-sm text-zinc-400">Cada ano previsto com o modelo treinado só até o ano anterior.</p>
        <ul className="mt-3 grid gap-2 text-sm tabular-nums sm:grid-cols-2">
          {acerto.anoAno.itens.map((it) => {
            const ganhou = it.erroMedioModelo < it.erroMedioIngenuo;
            return (
              <li key={`${it.alvo}${it.semanas}`} className="rounded-lg bg-terra-950 px-3 py-2 text-zinc-300">
                {NOME[it.alvo]} em {it.semanas} semanas: erro <span className={ganhou ? "text-capim" : "text-sol"}>{pct(it.erroMedioModelo, 1)}</span>{" "}
                <span className="text-zinc-500">
                  (preço parado {pct(it.erroMedioIngenuo, 1)}; melhor em {it.anosMelhor} de {it.anos} anos)
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Leitura honesta: em 3 meses o modelo empata com o palpite &quot;o preço fica onde está&quot;. Ele ajuda mais no horizonte de 1 ano. Testamos
          incluir o dólar e os juros: não melhoraram de forma consistente, então ficaram de fora.
        </p>
      </div>

      <div className="rounded-2xl border border-terra-700 bg-terra-900/60 p-5">
        <h3 className="font-display text-lg text-zinc-100">E os vereditos, teriam acertado?</h3>
        <p className="mt-1 text-sm text-zinc-400">
          As regras de cada perfil aplicadas mês a mês em {acerto.vereditos.periodo}, usando só o que se sabia em cada mês.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {VEREDITOS.map(({ chave, titulo, explica, fmt }) => {
            const r = acerto.vereditos.relatorio[chave];
            if (!r) return null;
            return (
              <div key={chave} className="rounded-xl bg-terra-950 p-4">
                <p className="text-sm font-medium text-zinc-200">{titulo}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{explica}</p>
                <dl className="mt-3 space-y-1.5 text-sm tabular-nums">
                  {(["melhor", "bom", "aguarde"] as const).map((s) =>
                    r[s] ? (
                      <div key={s} className="flex justify-between gap-3">
                        <dt className={COR[s]}>{ROTULO[s]}</dt>
                        <dd className="text-zinc-300">
                          {fmt(r[s]!.media)} <span className="text-zinc-500">· {r[s]!.meses} meses</span>
                        </dd>
                      </div>
                    ) : null,
                  )}
                  <div className="flex justify-between gap-3 border-t border-terra-800 pt-1.5 text-zinc-500">
                    <dt>Se comprasse sempre</dt>
                    <dd>{fmt(r.corte)} (mediana)</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          Cuidado: são só três ciclos completos, e os meses vizinhos se parecem, então há poucas decisões realmente independentes. As regras
          também foram escritas por quem já conhecia essa história. Para a cria, usamos a valorização do bezerro porque não há série pública de
          preço de matriz.
        </p>
      </div>

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
