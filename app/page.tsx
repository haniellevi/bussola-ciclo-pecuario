import { Abas } from "@/components/Abas";
import { AcertoModelo } from "@/components/AcertoModelo";
import { AvisoChave } from "@/components/AvisoChave";
import { ChatConsultor } from "@/components/ChatConsultor";
import { CicloOnda } from "@/components/CicloOnda";
import { Conhecimento } from "@/components/Conhecimento";
import { Decisao } from "@/components/Decisao";
import { Noticias } from "@/components/Noticias";
import { Previsao } from "@/components/Previsao";
import { entradaDoPainel } from "@/lib/entrada";
import { dataBr, mesAno, numero, pct, reais } from "@/lib/formato";
import { painel } from "@/lib/painel";
import { estagio, NOME_ESTAGIO, relacaoTroca } from "@/lib/veredito";

function Secao({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="mt-14 first:mt-0">
      <h2 id={`${id}-t`} className="font-display text-2xl text-zinc-50 sm:text-3xl">
        {titulo}
      </h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{sub}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Pagina() {
  const p = painel;
  const est = estagio(entradaDoPainel(p));
  const subidas = p.fase.duracaoSubidas;
  const vacas = p.fase.picoVacas;
  const atrasos = p.fase.atrasoPicoBoi;
  const prevBoi = p.previsao?.itens.filter((i) => i.alvo === "boi") ?? [];
  const boi13 = prevBoi.find((i) => i.semanas === 13);

  const numeros = [
    { rotulo: "Boi gordo hoje", valor: `${reais(p.hoje.boi, 2)}/@`, nota: `Cepea, ${dataBr(p.hoje.data)}${p.hoje.boiEstimado ? " (estimado pela Scot)" : ""}` },
    { rotulo: "Bezerro MS", valor: reais(p.hoje.bezerro), nota: "por cabeça" },
    { rotulo: "1 boi compra", valor: `${numero(relacaoTroca(p.hoje.boi, p.hoje.bezerro))} bezerros`, nota: `normal: ${numero(p.troca.mediana)}` },
    boi13 && { rotulo: "Boi em 13 semanas", valor: reais(boi13.previsto), nota: `faixa ${reais(boi13.minimo)}–${reais(boi13.maximo)}` },
  ].filter(Boolean) as { rotulo: string; valor: string; nota: string }[];

  const leitura = [
    `O preço ${p.fase.sobe ? "sobe" : "cai"} há ${p.fase.meses} meses, desde o ${p.fase.desde?.tipo} de ${p.fase.desde ? mesAno(p.fase.desde.mes) : ""}.${p.fase.sobe ? ` Nas altas anteriores, a subida durou de ${Math.min(...subidas)} a ${Math.max(...subidas)} meses.` : ""}`,
    p.fase.realVsPicoAnterior ? `Sem a inflação, o boi está em ${pct(p.fase.realVsPicoAnterior)} do último pico.` : null,
    vacas && atrasos.length > 0
      ? `O descarte de vacas ${vacas.confirmado ? "virou" : "parece ter virado"} em ${mesAno(vacas.mes)}. O pico do boi sempre veio de ${Math.min(...atrasos)} a ${Math.max(...atrasos)} meses depois disso.`
      : null,
    p.fase.sobe && p.fase.janela ? `Se o passado se repetir, o pico fica entre ${mesAno(p.fase.janela.de)} e ${mesAno(p.fase.janela.ate)}. São só 3 ciclos: é uma estimativa.` : null,
  ].filter(Boolean) as string[];

  const hoje = (
    <>
      <h1 className="max-w-3xl font-display text-4xl leading-tight text-zinc-50 sm:text-5xl">
        O ciclo do boi está em <span className={p.fase.sobe ? "text-capim" : "text-alerta"}>{NOME_ESTAGIO[est]}</span>.
      </h1>
      <ul className="mt-5 max-w-2xl space-y-2 text-base leading-relaxed text-zinc-300">
        {leitura.map((l) => (
          <li key={l} className="flex gap-3">
            <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sol" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-terra-700 bg-terra-700 lg:grid-cols-4">
        {numeros.map((n) => (
          <div key={n.rotulo} className="bg-terra-900 p-4 sm:p-5">
            <dt className="text-xs text-zinc-400">{n.rotulo}</dt>
            <dd className="mt-1 font-display text-xl tabular-nums text-zinc-50 sm:text-2xl">{n.valor}</dd>
            <dd className="mt-0.5 text-xs text-zinc-400">{n.nota}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-14">
        <Secao id="decisao" titulo="Vale a pena? Faça a conta do seu negócio" sub="Escolha como você trabalha e digite os seus números. A margem por cabeça aparece na hora, com o motivo e o risco do ciclo. Todo campo muda o resultado.">
          <Decisao painel={p} />
        </Secao>
        <Secao id="onda" titulo="A onda do ciclo" sub="Preço real do boi gordo desde 1997, corrigido pela inflação. Toque ou passe o mouse para ver cada mês.">
          <CicloOnda serie={p.serie} pivos={p.pivos} fase={p.fase} hoje={p.hoje} previsaoBoi={prevBoi} />
          <details className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-400">
            <summary className="cursor-pointer text-zinc-300 hover:text-sol">Como a Bússola percebe a virada do ciclo</summary>
            <p className="mt-3">
              Picos e vales só contam depois que o preço anda 20% no sentido contrário. Além do preço, olhamos as vacas no abate (média de 12 meses):{" "}
              <strong className="text-zinc-200">{pct(p.fase.femeas ?? 0, 1)}</strong>, contra {pct(p.fase.femeasMedia10, 1)} nos últimos 10 anos. Quando muitas vacas vão
              para o abate, nascem menos bezerros depois. O nível sozinho não marca a virada, mas a mudança de direção sim: nos ciclos de 2006 a 2023, cada pico de vacas no abate veio antes
              de um pico do boi, sem sinal falso. A virada só conta quando a fatia cai meio ponto a partir do topo, e o IBGE publica com 3 meses de atraso.{" "}
              <span className="text-zinc-400">Veja o passo a passo na aba Conhecimento.</span>
            </p>
          </details>
        </Secao>
      </div>
    </>
  );

  return (
    <>
      <AvisoChave />
      <header className="mx-auto max-w-6xl px-4 pb-5 pt-6 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sol">Bússola do Ciclo Pecuário</p>
      </header>
      <Abas
        abas={[
          { id: "hoje", rotulo: "Hoje", conteudo: hoje },
          {
            id: "previsao",
            rotulo: "Previsão",
            conteudo: (
              <>
                {p.previsao && (
                  <Secao id="prev" titulo="O que esperamos para os preços" sub="Previsões em 4, 13 e 52 semanas, sempre com faixa. Quanto mais longe, maior a incerteza.">
                    <Previsao previsao={p.previsao} />
                  </Secao>
                )}
                <Secao id="acerto" titulo="Quanto o modelo acerta" sub="Toda previsão é registrada antes e comparada depois. Sem isso, não dá para confiar.">
                  <AcertoModelo acerto={p.acerto} />
                </Secao>
              </>
            ),
          },
          ...(p.noticias
            ? [
                {
                  id: "noticias",
                  rotulo: "Notícias",
                  conteudo: (
                    <Secao id="not" titulo="O que as notícias dizem" sub="Notícias de pecuária da semana, de sites que permitem leitura automática. Toque para ler na fonte.">
                      <Noticias noticias={p.noticias} />
                    </Secao>
                  ),
                },
              ]
            : []),
          { id: "conhecimento", rotulo: "Conhecimento", conteudo: <Conhecimento painel={p} /> },
          {
            id: "consultor",
            rotulo: "Consultor",
            conteudo: (
              <Secao id="cons" titulo="Consultor do Ciclo" sub="Responda cinco perguntas e veja o que o momento do ciclo significa para o seu caso. Depois, converse livremente com a IA.">
                <div className="max-w-2xl">
                  <ChatConsultor painel={p} />
                </div>
              </Secao>
            ),
          },
        ]}
      />
      <footer className="mx-auto max-w-6xl border-t border-terra-800 px-4 py-10 text-xs leading-relaxed text-zinc-400 sm:px-6">
        <p className="max-w-3xl">
          <strong className="text-zinc-400">Aviso:</strong> esta é uma ferramenta de simulação estatística e de leitura de tendências de mercado, feita com dados
          públicos. Não é recomendação de investimento nem garantia de preço. Decisões de compra e venda são de quem as toma.
        </p>
        <p className="mt-3">
          Fontes: {p.fontes}. Atualizado em {dataBr(p.geradoEm.slice(0, 10))}
          {p.previsao && `, previsão da semana ${p.previsao.semana}`}. Código e histórico de previsões:{" "}
          <a className="underline underline-offset-2 hover:text-sol" href="https://github.com/haniellevi/bussola-ciclo-pecuario">GitHub</a>.
        </p>
      </footer>
    </>
  );
}
