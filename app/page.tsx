import { AcertoModelo } from "@/components/AcertoModelo";
import { ChatConsultor } from "@/components/ChatConsultor";
import { CicloOnda } from "@/components/CicloOnda";
import { Decisao } from "@/components/Decisao";
import { Noticias } from "@/components/Noticias";
import { entradaDoPainel } from "@/lib/entrada";
import { dataBr, mesAno, numero, pct, reais } from "@/lib/formato";
import { painel } from "@/lib/painel";
import { estagio, relacaoTroca } from "@/lib/veredito";

const NOME_ESTAGIO = {
  "inicio-alta": "início da alta",
  "meio-alta": "alta",
  "alta-madura": "fim da alta",
  "inicio-queda": "início da queda",
  "meio-queda": "queda",
  "fim-queda": "fim da queda",
} as const;

function Secao({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-6 border-t border-terra-800 py-12 sm:py-16">
      <h2 id={`${id}-t`} className="font-display text-2xl text-zinc-50 sm:text-3xl">
        {titulo}
      </h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{sub}</p>}
      <div className="mt-8">{children}</div>
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

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pb-10 pt-10 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sol">Bússola do Ciclo Pecuário</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-zinc-50 sm:text-6xl">
          O ciclo do boi está em <span className={p.fase.sobe ? "text-capim" : "text-alerta"}>{NOME_ESTAGIO[est]}</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          O preço {p.fase.sobe ? "sobe" : "cai"} há {p.fase.meses} meses, desde o {p.fase.desde?.tipo} de {p.fase.desde && mesAno(p.fase.desde.mes)}.
          {p.fase.sobe && ` Nos ciclos anteriores, a subida durou de ${Math.min(...subidas)} a ${Math.max(...subidas)} meses.`}
          {p.fase.realVsPicoAnterior && ` Descontada a inflação, o boi está em ${pct(p.fase.realVsPicoAnterior)} do último pico.`}
          {vacas && atrasos.length > 0 &&
            ` O descarte de vacas ${vacas.confirmado ? "virou" : "parece ter virado"} em ${mesAno(vacas.mes)}, e o pico do boi sempre veio de ${Math.min(...atrasos)} a ${Math.max(...atrasos)} meses depois disso.`}
          {p.fase.sobe && p.fase.janela && ` Se o passado se repetir, o pico fica entre ${mesAno(p.fase.janela.de)} e ${mesAno(p.fase.janela.ate)}.`}
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-terra-700 bg-terra-700 lg:grid-cols-4">
          {numeros.map((n) => (
            <div key={n.rotulo} className="bg-terra-900 p-4 sm:p-5">
              <dt className="text-xs text-zinc-500">{n.rotulo}</dt>
              <dd className="mt-1 font-display text-xl tabular-nums text-zinc-50 sm:text-2xl">{n.valor}</dd>
              <dd className="mt-0.5 text-xs text-zinc-500">{n.nota}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Seções" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
          <a href="#onda" className="hover:text-sol">A onda do ciclo</a>
          {p.noticias && <a href="#noticias" className="hover:text-sol">Notícias</a>}
          <a href="#decisao" className="hover:text-sol">Comprar ou esperar?</a>
          <a href="#acerto" className="hover:text-sol">Quanto o modelo acerta</a>
          <a href="#consultor" className="hover:text-sol">Consultor</a>
        </nav>
      </header>

      <Secao id="onda" titulo="A onda do ciclo" sub="Preço real do boi gordo desde 2006, corrigido pela inflação. Picos e vales só contam depois que o preço anda 20%. Toque ou passe o mouse para ver cada mês.">
        <CicloOnda serie={p.serie} pivos={p.pivos} fase={p.fase} hoje={p.hoje} previsaoBoi={prevBoi} />
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Fêmeas no abate (média de 12 meses): <strong className="text-zinc-200">{pct(p.fase.femeas ?? 0, 1)}</strong>, contra{" "}
          {pct(p.fase.femeasMedia10, 1)} nos últimos 10 anos. Quando muitas vacas vão para o abate, nascem menos bezerros depois. O nível
          sozinho não marca a virada, mas a mudança de direção sim: desde 2006, cada pico de vacas no abate veio antes de um pico do boi, sem
          sinal falso. A virada só conta quando a fatia cai meio ponto a partir do topo (ex.: de 47,0% para 46,5%), e o IBGE publica com 3 meses de atraso.
        </p>
      </Secao>

      {p.noticias && (
        <Secao id="noticias" titulo="O que as notícias dizem" sub="Notícias de pecuária da semana, de sites que permitem leitura automática. Toque para ler na fonte.">
          <Noticias noticias={p.noticias} />
        </Secao>
      )}

      <Secao id="decisao" titulo="Comprar ou esperar?" sub="Escolha o seu perfil. O veredito vem de regras simples, com o motivo de cada uma. Mude os preços para ver como ele reage.">
        <Decisao painel={p} />
      </Secao>

      <Secao id="acerto" titulo="Quanto o modelo acerta" sub="Toda previsão é registrada antes e comparada depois. Sem isso, não dá para confiar.">
        <AcertoModelo acerto={p.acerto} />
      </Secao>

      <Secao id="consultor" titulo="Consultor do Ciclo" sub="Responda cinco perguntas e veja o que o momento do ciclo significa para o seu caso. Com uma chave do OpenRouter, dá para conversar livremente.">
        <div className="max-w-2xl">
          <ChatConsultor painel={p} />
        </div>
      </Secao>

      <footer className="border-t border-terra-800 py-10 text-xs leading-relaxed text-zinc-500">
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
    </main>
  );
}
