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

  const boi = (s: number) => acerto.teste.itens.find((i) => i.alvo === "boi" && i.semanas === s);
  const resumo = [
    { rotulo: "1 mês", it: boi(4) },
    { rotulo: "3 meses", it: boi(13) },
    { rotulo: "1 ano", it: boi(52) },
  ];

  return (
    <div className="space-y-3">
      {/* O essencial à vista; os testes completos ficam fechados, para quem quiser conferir */}
      <section className="space-y-3 rounded-3xl bg-superficie p-5">
        <h3 className="text-lg font-semibold text-texto">Dá para confiar?</h3>
        <dl className="grid grid-cols-3 gap-2">
          {resumo.map(({ rotulo, it }) =>
            it ? (
              <div key={rotulo} className="rounded-2xl bg-fundo p-3">
                <dt className="whitespace-nowrap text-xs text-texto-3">{rotulo}</dt>
                <dd className="text-xl font-semibold tabular-nums text-texto">±{pct(it.erroMedioModelo)}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <p className="text-sm text-texto-2">
          Erro médio do boi gordo no teste às cegas de {acerto.teste.periodo}. Em 1 e 3 meses a previsão quase empata com &quot;o preço fica onde
          está&quot;; ela ajuda mais em 1 ano.
        </p>
      </section>

      <Dobra titulo="Os números do teste" sub={`Previsões feitas às cegas em ${acerto.teste.periodo}`}>
      <p className="text-xs text-texto-3">
        Modelo ajustado só com dados até {acerto.teste.treinoAte.slice(0, 4)}. Verde: errou menos que chutar &quot;preço parado&quot;.
      </p>
      <div className="space-y-3 sm:hidden">
        {acerto.teste.itens.map((it) => {
          const ganhou = it.erroMedioModelo < it.erroMedioIngenuo;
          return (
            <div key={`${it.alvo}${it.semanas}`} className="rounded-2xl bg-fundo p-4">
              <p className="font-medium text-texto">
                {NOME[it.alvo]} em {it.semanas} semanas
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm tabular-nums">
                <div>
                  <dt className="text-xs text-texto-3">Erro médio</dt>
                  <dd className={`text-base font-semibold ${ganhou ? "text-capim" : "text-texto"}`}>{pct(it.erroMedioModelo, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-3">Chute &quot;preço parado&quot;</dt>
                  <dd className="text-base text-texto-2">{pct(it.erroMedioIngenuo, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-3">Acertou a direção</dt>
                  <dd className="text-base text-texto-2">{pct(it.acertoDirecao)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-3">Real dentro da faixa</dt>
                  <dd className={`text-base ${it.dentroDaFaixa80 >= 0.7 ? "text-texto-2" : "text-sol"}`}>{pct(it.dentroDaFaixa80)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl bg-fundo sm:block">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-xs text-texto-3">
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
                <tr key={`${it.alvo}${it.semanas}`} className="border-t border-linha">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-texto-2">
                    {NOME[it.alvo]} em {it.semanas} semanas
                  </th>
                  <td className={`px-4 py-2.5 text-right ${ganhou ? "text-capim" : "text-texto-2"}`}>{pct(it.erroMedioModelo, 1)}</td>
                  <td className="px-4 py-2.5 text-right text-texto-3">{pct(it.erroMedioIngenuo, 1)}</td>
                  <td className="px-4 py-2.5 text-right text-texto-2">{pct(it.acertoDirecao)}</td>
                  <td className={`px-4 py-2.5 text-right ${it.dentroDaFaixa80 >= 0.7 ? "text-texto-2" : "text-sol"}`}>{pct(it.dentroDaFaixa80)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1.5 text-xs text-texto-3">
        <li>A faixa foi feita para conter o preço real 8 em cada 10 vezes. Em 1 ano ela errou mais: a incerteza é grande.</li>
        <li>Este teste cobre um só trecho do ciclo, quase todo de alta. Por isso há o teste mais duro, ano a ano.</li>
      </ul>
      </Dobra>

      <Dobra titulo="Teste mais duro, ano a ano" sub={`${acerto.anoAno.periodo}: cada ano previsto só com o que se sabia antes`}>
        <ul className="grid gap-2 text-sm tabular-nums sm:grid-cols-2">
          {acerto.anoAno.itens.map((it) => {
            const ganhou = it.erroMedioModelo < it.erroMedioIngenuo;
            return (
              <li key={`${it.alvo}${it.semanas}`} className="rounded-lg bg-fundo px-3 py-2 text-texto-2">
                {NOME[it.alvo]} em {it.semanas} semanas: erro <span className={ganhou ? "text-capim" : "text-sol"}>{pct(it.erroMedioModelo, 1)}</span>{" "}
                <span className="text-texto-3">
                  (preço parado {pct(it.erroMedioIngenuo, 1)}; melhor em {it.anosMelhor} de {it.anos} anos)
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs leading-relaxed text-texto-3">
          Leitura honesta: em 3 meses o modelo empata com o palpite &quot;o preço fica onde está&quot;. Ele ajuda mais no horizonte de 1 ano. Testamos
          incluir o dólar e os juros: não melhoraram de forma consistente, então ficaram de fora.
        </p>
      </Dobra>

      <Dobra titulo="A leitura do ciclo teria acertado?" sub={`Regras de cada perfil aplicadas mês a mês em ${acerto.vereditos.periodo}`}>
        <div className="grid gap-3 md:grid-cols-2">
          {VEREDITOS.map(({ chave, titulo, explica, fmt }) => {
            const r = acerto.vereditos.relatorio[chave];
            if (!r) return null;
            return (
              <div key={chave} className="rounded-xl bg-fundo p-3 sm:p-4">
                <p className="text-sm font-medium text-texto-2">{titulo}</p>
                <p className="mt-0.5 text-xs text-texto-3">{explica}</p>
                <dl className="mt-3 space-y-1.5 text-sm tabular-nums">
                  {(["melhor", "bom", "aguarde"] as const).map((s) =>
                    r[s] ? (
                      <div key={s} className="flex flex-wrap justify-between gap-x-3">
                        <dt className={`whitespace-nowrap ${COR[s]}`}>{ROTULO[s]}</dt>
                        <dd className="whitespace-nowrap text-texto-2">
                          {fmt(r[s]!.media)} <span className="text-texto-3">· {r[s]!.meses} meses</span>
                        </dd>
                      </div>
                    ) : null,
                  )}
                  <div className="flex flex-wrap justify-between gap-x-3 border-t border-linha pt-1.5 text-texto-3">
                    <dt className="whitespace-nowrap">Se comprasse sempre</dt>
                    <dd className="whitespace-nowrap">{fmt(r.corte)} (mediana)</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-texto-3">
          Cuidado: são só três ciclos completos, e os meses vizinhos se parecem, então há poucas decisões realmente independentes. As regras
          também foram escritas por quem já conhecia essa história. Para a cria, usamos a valorização do bezerro porque não há série pública de
          preço de matriz.
        </p>
      </Dobra>

      <Dobra titulo="Ao vivo, semana a semana" sub={vivo.length ? `${vivo.length} previsões já conferidas` : "A primeira conferência sai 4 semanas depois do primeiro registro"}>
        {vivo.length === 0 ? (
          <p className="text-sm text-texto-3">
            Toda segunda a previsão é registrada e não muda mais. A primeira comparação com o preço real sai 4 semanas depois do primeiro registro.
          </p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {grupos.filter((g) => g.n).map((g) => (
              <li key={`${g.alvo}${g.s}`} className="rounded-lg bg-fundo px-3 py-2 text-texto-2">
                {NOME[g.alvo]} em {g.s} sem.: erro {pct(g.erro, 1)}, dentro da faixa {pct(g.dentro)} ({g.n} previsões)
              </li>
            ))}
          </ul>
        )}
      </Dobra>
    </div>
  );
}

// Parte que abre e fecha: título e uma linha de resumo; o detalhe só aparece se a pessoa tocar.
function Dobra({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-superficie">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold text-texto">{titulo}</span>
          <span className="block text-xs text-texto-3">{sub}</span>
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-texto-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}
