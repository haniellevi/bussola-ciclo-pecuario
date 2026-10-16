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
      <h2 id={`${id}-t`} className="font-display text-2xl text-texto sm:text-3xl">
        {titulo}
      </h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texto-3">{sub}</p>}
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
    { rotulo: "Bezerros que 1 boi compra", valor: numero(relacaoTroca(p.hoje.boi, p.hoje.bezerro)), nota: `normal: ${numero(p.troca.mediana)}` },
    boi13 && { rotulo: "Boi em 13 semanas", valor: reais(boi13.previsto), nota: `faixa ${reais(boi13.minimo)} a ${Math.round(boi13.maximo)}` },
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
    <div className="space-y-6">
      <header>
        <h1 className="max-w-3xl font-display text-3xl leading-tight text-texto sm:text-5xl">
          O ciclo do boi está em <span className={p.fase.sobe ? "text-capim" : "text-alerta"}>{NOME_ESTAGIO[est]}</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-base text-texto-2">
          {p.fase.sobe ? "Sobe" : "Cai"} há {p.fase.meses} meses.
          {p.fase.sobe && p.fase.janela ? ` Se o passado se repetir, o pico vem entre ${mesAno(p.fase.janela.de)} e ${mesAno(p.fase.janela.ate)}.` : ""}
        </p>
      </header>

      {/* A onda é o centro da página: um cartão próprio, logo no topo */}
      <section id="onda" aria-label="A onda do ciclo" className="rounded-3xl border border-linha bg-superficie p-4 sm:p-6">
        <CicloOnda serie={p.serie} pivos={p.pivos} fase={p.fase} hoje={p.hoje} previsaoBoi={prevBoi} />
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {numeros.map((n) => (
          <div key={n.rotulo} className="rounded-2xl border border-linha bg-superficie p-4">
            <dt className="text-xs text-texto-3">{n.rotulo}</dt>
            <dd className="mt-1 whitespace-nowrap font-display text-xl tabular-nums text-texto sm:text-2xl">{n.valor}</dd>
            <dd className="mt-0.5 text-xs text-texto-3">{n.nota}</dd>
          </div>
        ))}
      </dl>

      <section id="decisao" aria-label="Vale a pena comprar agora?" className="scroll-mt-20">
        <Decisao painel={p} />
      </section>

      <details className="group rounded-3xl border border-linha bg-superficie-2/60 p-5 sm:p-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-texto [&::-webkit-details-marker]:hidden">
          Por que dizemos que está em {NOME_ESTAGIO[est]}?
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-texto-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </summary>
        <ul className="mt-3 max-w-2xl space-y-2 text-base leading-relaxed text-texto-2">
          {leitura.map((l) => (
            <li key={l} className="flex gap-3">
              <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-texto-4" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-texto-3">
          Picos e vales só contam depois que o preço anda 20% no sentido contrário. Também olhamos as vacas no abate (média de 12 meses):{" "}
          <strong className="text-texto-2">{pct(p.fase.femeas ?? 0, 1)}</strong>, contra {pct(p.fase.femeasMedia10, 1)} nos últimos 10 anos. Quando muitas vacas vão para o abate,
          nascem menos bezerros depois. Nos ciclos de 2006 a 2023, cada virada no abate de vacas veio antes de um pico do boi. O IBGE publica com 3 meses de atraso. Passo a passo na aba Aprender.
        </p>
      </details>
    </div>
  );

  return (
    <>
      <AvisoChave />
      <Abas
        marca={
          <p className="flex items-center gap-2 text-sm font-semibold text-texto">
            <svg aria-hidden viewBox="0 0 32 32" className="h-6 w-6">
              <rect width="32" height="32" rx="8" className="fill-superficie-2" />
              <path d="M4 22c4-10 7-10 10-2s6 8 9-1 4-8 5-7" fill="none" className="stroke-capim" strokeWidth={3} strokeLinecap="round" />
              <circle cx="27" cy="12" r="2.6" className="fill-laranja" />
            </svg>
            Bússola do Ciclo Pecuário
          </p>
        }
        abas={[
          { id: "hoje", rotulo: "Hoje", conteudo: hoje },
          {
            id: "previsao",
            rotulo: "Previsão",
            conteudo: (
              <>
                {p.previsao && (
                  <Secao id="prev" titulo="O que esperamos para os preços" sub="Previsões em 4, 13 e 52 semanas, sempre com faixa. Quanto mais longe, maior a incerteza.">
                    <Previsao previsao={p.previsao} teste={p.acerto.teste} />
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
                    <Secao id="not" titulo="O que as notícias dizem" sub="Notícias de pecuária da semana. Toque numa notícia para ler na fonte.">
                      <Noticias noticias={p.noticias} />
                    </Secao>
                  ),
                },
              ]
            : []),
          { id: "conhecimento", rotulo: "Aprender", conteudo: <Conhecimento painel={p} /> },
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
      <footer className="mx-auto max-w-6xl border-t border-linha px-4 pb-28 pt-10 text-xs leading-relaxed text-texto-3 sm:px-6 sm:pb-10">
        <p className="max-w-3xl">
          <strong className="text-texto-3">Aviso:</strong> esta é uma ferramenta de simulação estatística e de leitura de tendências de mercado, feita com dados
          públicos. Não é recomendação de investimento nem garantia de preço. Decisões de compra e venda são de quem as toma.
        </p>
        <p className="mt-3">
          Fontes: {p.fontes}. Atualizado em {dataBr(p.geradoEm.slice(0, 10))}
          {p.previsao && `, previsão da semana ${p.previsao.semana}`}. Código e histórico de previsões:{" "}
          <a className="underline underline-offset-2 hover:text-tinta" href="https://github.com/haniellevi/bussola-ciclo-pecuario">GitHub</a>.
        </p>
      </footer>
    </>
  );
}
