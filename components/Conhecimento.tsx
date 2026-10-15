"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { entradaDoPainel } from "@/lib/entrada";
import { mesAno, numero, pct, reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";
import { estagio, NOME_ESTAGIO, PONTOS_ESTAGIO_CRIA, PONTOS_ESTAGIO_ENGORDA, relacaoTroca, TEXTO_SELO, veredito, type Estagio, type Perfil } from "@/lib/veredito";

// Aula em 5 passos. Os números vêm do painel (dados reais); os desenhos explicam a ideia.

const ESTAGIOS: { id: Estagio; de: number; ate: number; cor: string; o_que: string }[] = [
  { id: "inicio-alta", de: 0, ate: 0.17, cor: "#4ade80", o_que: "O preço saiu do fundo. Sobra pouco boi no mercado e o produtor começa a segurar as vacas." },
  { id: "meio-alta", de: 0.17, ate: 0.34, cor: "#4ade80", o_que: "Preço firme e subindo. As vacas continuam no pasto e o bezerro encarece mais rápido que o boi." },
  { id: "alta-madura", de: 0.34, ate: 0.5, cor: "#fbbf24", o_que: "Perto do topo. Já passou o tempo que as altas costumam durar e o descarte de vacas virou." },
  { id: "inicio-queda", de: 0.5, ate: 0.67, cor: "#fb7185", o_que: "O pico passou. Chegam mais animais ao mercado e o preço começa a ceder." },
  { id: "meio-queda", de: 0.67, ate: 0.84, cor: "#fb7185", o_que: "Muito boi e muita vaca indo para o abate. O preço está baixo e a reposição vai ficando barata." },
  { id: "fim-queda", de: 0.84, ate: 1, cor: "#4ade80", o_que: "Fundo do ciclo. Todo mundo vendendo, bezerro e matriz baratos. É aqui que nasce a próxima alta." },
];

// Largura do desenho: no celular a onda fica mais estreita para não achatar.
const A = 210;
const pontoEm = (L: number, t: number) => ({ x: 20 + t * (L - 40), y: 105 + 70 * Math.cos(2 * Math.PI * t) });
const centro = (e: Estagio) => {
  const s = ESTAGIOS.find((x) => x.id === e)!;
  return (s.de + s.ate) / 2;
};

function Passo({ n, titulo, resumo, children }: { n: number; titulo: string; resumo: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-3xl border border-terra-700 bg-terra-900/50 p-5 sm:p-8"
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-sol">Passo {n} de 5</p>
      <h3 className="mt-2 font-display text-2xl text-zinc-50 sm:text-3xl">{titulo}</h3>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-300">{resumo}</p>
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}

/* Passo 1: a onda com as 6 fases e o ponto de hoje */
function Onda({ hoje }: { hoje: Estagio }) {
  const parado = useReducedMotion();
  const [sel, setSel] = useState<Estagio>(hoje);
  const [L, setL] = useState(640);
  useEffect(() => {
    const m = matchMedia("(max-width: 639px)");
    const f = () => setL(m.matches ? 340 : 640);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const ponto = (t: number) => pontoEm(L, t);
  const caminho = useMemo(() => Array.from({ length: 101 }, (_, i) => pontoEm(L, i / 100)).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "), [L]);
  const amostras = useMemo(() => Array.from({ length: 41 }, (_, i) => pontoEm(L, i / 40)), [L]);
  const cur = ESTAGIOS.find((s) => s.id === sel)!;
  const pin = ponto(centro(hoje));
  // "estamos aqui" do lado sem curva; perto da borda vai para baixo para não cortar.
  const esq = centro(hoje) < 0.5;
  const apertado = esq ? pin.x < 120 : pin.x > L - 120;
  const rotulo = apertado
    ? { x: pin.x + (esq ? 14 : -14), y: pin.y + 22, textAnchor: esq ? ("start" as const) : ("end" as const) }
    : { x: pin.x + (esq ? -16 : 16), y: pin.y - 4, textAnchor: esq ? ("end" as const) : ("start" as const) };
  return (
    <div>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Uma volta completa do ciclo: sobe do fundo ao pico e cai de volta ao fundo" className="w-full">
        {ESTAGIOS.map((s) => (
          <g key={s.id}>
            <rect
              x={20 + s.de * (L - 40)}
              y={10}
              width={(s.ate - s.de) * (L - 40)}
              height={A - 40}
              fill={s.cor}
              opacity={sel === s.id ? 0.2 : 0.05}
              className="cursor-pointer transition-opacity"
              onClick={() => setSel(s.id)}
            />
          </g>
        ))}
        <motion.path key={L} d={caminho} fill="none" stroke="#e7ece9" strokeWidth={3} strokeLinecap="round" initial={parado ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2, ease: "easeInOut" }} />
        <text x={ponto(0.5).x} y={22} textAnchor="middle" fontSize={12} className="text-[16px] sm:text-[13px]" fill="#fbbf24">pico</text>
        <text x={ponto(0).x + 4} y={A - 60} fontSize={12} className="text-[16px] sm:text-[13px]" fill="#4ade80">fundo</text>
        <text x={ponto(1).x - 4} y={A - 60} textAnchor="end" fontSize={12} className="text-[16px] sm:text-[13px]" fill="#4ade80">fundo</text>
        {!parado && (
          <motion.circle
            r={6}
            fill="#fbbf24"
            animate={{ cx: amostras.map((p) => p.x), cy: amostras.map((p) => p.y) }}
            transition={{ duration: 16, ease: "linear", repeat: Infinity }}
          />
        )}
        <g>
          <circle cx={pin.x} cy={pin.y} r={9} fill="none" stroke="#fb923c" strokeWidth={2.5}>
            {!parado && <animate attributeName="r" values="9;15;9" dur="2s" repeatCount="indefinite" />}
          </circle>
          <circle cx={pin.x} cy={pin.y} r={4} fill="#fb923c" />
          <text {...rotulo} fontSize={12} fontWeight={600} className="text-[16px] sm:text-[13px]" fill="#fb923c">estamos aqui</text>
        </g>
        {ESTAGIOS.map((s) => (
          <text key={s.id} x={20 + ((s.de + s.ate) / 2) * (L - 40)} y={A - 8} textAnchor="middle" fontSize={12} className="max-sm:hidden" fill={sel === s.id ? "#fbbf24" : "#71807a"}>
            {NOME_ESTAGIO[s.id]}
          </text>
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Escolha uma fase para entender">
        {ESTAGIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSel(s.id)}
            aria-pressed={sel === s.id}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors ${sel === s.id ? "border-sol bg-sol/15 text-sol" : "border-terra-700 text-zinc-300 hover:border-zinc-500"}`}
          >
            {NOME_ESTAGIO[s.id]}
            {s.id === hoje && " · hoje"}
          </button>
        ))}
      </div>
      <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-terra-950 p-4 sm:p-5">
        <p className="font-display text-lg text-zinc-50">{NOME_ESTAGIO[cur.id][0].toUpperCase() + NOME_ESTAGIO[cur.id].slice(1)}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{cur.o_que}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-400">Quem faz recria ou engorda</dt>
            <dd className="mt-1 text-zinc-300">{PONTOS_ESTAGIO_ENGORDA[cur.id][1]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-400">Quem faz cria</dt>
            <dd className="mt-1 text-zinc-300">{PONTOS_ESTAGIO_CRIA[cur.id][1]}</dd>
          </div>
        </dl>
      </motion.div>
    </div>
  );
}

/* Passo 2: a engrenagem que faz o ciclo girar */
const ENGRENAGEM = [
  { t: "Boi caro", d: "O preço sobe e a pecuária dá lucro." },
  { t: "Produtor segura as vacas", d: "Para ter mais bezerros no futuro, ele deixa de mandar vaca para o abate." },
  { t: "Falta boi gordo", d: "Menos vacas no abate agora e ainda sem os bezerros novos prontos. O preço sobe mais." },
  { t: "Os bezerros crescem", d: "Como o gado leva anos para crescer, só depois de um bom tempo a oferta de animais volta a crescer." },
  { t: "Muito boi e muita vaca", d: "O produtor, vendo o preço ceder, descarta vacas de uma vez. Chega tudo ao mercado." },
  { t: "Boi barato", d: "O preço cai, o lucro some e o produtor desiste de segurar vacas. A volta começa." },
];

function Engrenagem() {
  const parado = useReducedMotion();
  const [i, setI] = useState(0);
  const [rodando, setRodando] = useState(true);
  useEffect(() => {
    if (!rodando || parado) return;
    const id = setInterval(() => setI((v) => (v + 1) % ENGRENAGEM.length), 2600);
    return () => clearInterval(id);
  }, [rodando, parado]);
  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENGRENAGEM.map((e, k) => (
          <li key={e.t}>
            <button
              onClick={() => {
                setI(k);
                setRodando(false);
              }}
              aria-current={i === k}
              className={`relative h-full w-full rounded-2xl border p-4 text-left transition-colors ${i === k ? "border-sol bg-sol/10" : "border-terra-700 bg-terra-950/60 hover:border-zinc-600"}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${i === k ? "bg-sol text-terra-950" : "bg-terra-800 text-zinc-300"}`}>{k + 1}</span>
              <span className="mt-2 block font-medium text-zinc-100">{e.t}</span>
              <span className="mt-1 block text-sm leading-relaxed text-zinc-400">{e.d}</span>
              {i === k && !parado && rodando && <motion.span layoutId="barra" className="absolute inset-x-4 bottom-2 h-0.5 origin-left rounded bg-sol" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2.6, ease: "linear" }} key={`b${i}`} />}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-4 text-sm text-zinc-400">
        <button onClick={() => setRodando((v) => !v)} className="min-h-11 shrink-0 rounded-lg border border-terra-700 px-4 py-2 text-zinc-200 hover:border-sol hover:text-sol">
          {rodando ? "Pausar" : "Tocar de novo"}
        </button>
        <span>Depois do 6, volta ao 1: por isso é um ciclo.</span>
      </div>
    </div>
  );
}

/* Passo 3: os 3 sinais, com os números de hoje */
function Sinais({ p }: { p: Painel }) {
  const parado = useReducedMotion();
  const serie = p.serie.slice(-132);
  const ini = serie[0].mes;
  const vals = serie.map((s) => s.boiReal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const X = (i: number) => 8 + (i / (serie.length - 1)) * 304;
  const Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * 104;
  const linha = serie.map((s, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(s.boiReal).toFixed(1)}`).join(" ");
  const pivos = p.pivos.filter((v) => v.mes >= ini);

  const fem = p.fase.femeas ?? 0, med = p.fase.femeasMedia10;
  const rt = relacaoTroca(p.hoje.boi, p.hoje.bezerro);
  const cheios = Math.floor(rt);
  const total = Math.max(Math.ceil(Math.max(rt, p.troca.mediana)), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl bg-terra-950 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Sinal 1 · Preço sem a inflação</p>
        <svg viewBox="0 0 320 120" role="img" aria-label={`Preço do boi corrigido pela inflação desde ${mesAno(ini)}, com os picos e vales`} className="mt-2 w-full">
          <motion.path d={linha} fill="none" stroke="#e7ece9" strokeWidth={2} initial={parado ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.2, ease: "easeInOut" }} />
          {pivos.map((v) => {
            const i = serie.findIndex((s) => s.mes === v.mes);
            return i < 0 ? null : (
              <motion.circle key={v.mes} cx={X(i)} cy={Y(v.boiReal)} r={4.5} fill={v.tipo === "pico" ? "#fbbf24" : "#4ade80"} initial={parado ? false : { opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.6, type: "spring" }} />
            );
          })}
        </svg>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Um pico (amarelo) ou vale (verde) só conta depois que o preço anda <strong className="text-zinc-100">20%</strong> no sentido contrário. Assim, sobe-e-desce pequeno não vira alarme falso.
        </p>
      </div>

      <div className="rounded-2xl bg-terra-950 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Sinal 2 · Vacas no abate</p>
        <div className="relative mt-8 h-4 rounded-full bg-terra-800" role="img" aria-label={`Vacas são ${pct(fem, 1)} do abate; a média dos últimos 10 anos é ${pct(med, 1)}`}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-capim to-sol" initial={parado ? false : { width: 0 }} whileInView={{ width: `${fem * 100 * 1.6}%` }} viewport={{ once: true }} transition={{ duration: 1.4, ease: "easeOut" }} style={parado ? { width: `${fem * 160}%` } : undefined} />
          <div className="absolute -top-6 whitespace-nowrap text-xs text-zinc-400" style={{ left: `${med * 160}%`, transform: "translateX(-50%)" }}>média {pct(med, 0)}</div>
          <div className="absolute top-0 h-full w-0.5 bg-zinc-300" style={{ left: `${med * 160}%` }} />
        </div>
        <p className="mt-3 font-display text-3xl tabular-nums text-zinc-50">{pct(fem, 1)}</p>
        <p className="text-xs text-zinc-400">das fêmeas entre os animais abatidos (média de 12 meses)</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Quando a fatia sobe, o produtor está vendendo vacas e vai nascer menos bezerro. {p.fase.picoVacas ? `O topo desta vez foi em ${mesAno(p.fase.picoVacas.mes)}${p.fase.picoVacas.confirmado ? ", já confirmado." : ", ainda sem confirmar (precisa cair meio ponto)."}` : "O topo desta vez ainda não apareceu."}
        </p>
      </div>

      <div className="rounded-2xl bg-terra-950 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Sinal 3 · Quanto 1 boi compra</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="img" aria-label={`1 boi gordo compra ${numero(rt)} bezerros; o normal é ${numero(p.troca.mediana)}`}>
          {Array.from({ length: total }, (_, k) => {
            const parte = Math.min(1, Math.max(0, rt - k));
            return (
              <motion.span key={k} initial={parado ? false : { opacity: 0, scale: 0.4 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 * k, type: "spring" }} className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-dashed border-terra-700 text-lg">
                <span className="absolute inset-y-0 left-0 bg-sol/25" style={{ width: `${parte * 100}%` }} />
                <span className="relative">{parte > 0 ? "🐄" : ""}</span>
              </motion.span>
            );
          })}
        </div>
        <p className="mt-3 font-display text-3xl tabular-nums text-zinc-50">{numero(rt)} bezerros</p>
        <p className="text-xs text-zinc-400">normal dos últimos 10 anos: {numero(p.troca.mediana)} (os quadros vazios mostram o que falta para o normal)</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Conta: 18 @ × {reais(p.hoje.boi, 2)} ÷ {reais(p.hoje.bezerro)} = {numero(rt)}. Quanto mais bezerros o boi paga, mais barata está a reposição para quem engorda.
        </p>
      </div>
    </div>
  );
}

/* Passo 4: da leitura à decisão, com os vereditos de hoje */
const PERFIS: { id: Perfil; nome: string; quem: string }[] = [
  { id: "cria", nome: "Cria", quem: "Tem vacas e vende bezerros" },
  { id: "engorda", nome: "Recria / Engorda", quem: "Compra bezerro e vende boi gordo" },
  { id: "iniciante", nome: "Iniciante", quem: "Está começando agora" },
];
const COR_SELO = { melhor: "text-capim border-capim/40 bg-capim/10", bom: "text-sol border-sol/40 bg-sol/10", aguarde: "text-alerta border-alerta/40 bg-alerta/10" } as const;

function Decisao({ p }: { p: Painel }) {
  const e = entradaDoPainel(p);
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        {PERFIS.map((f, k) => {
          const v = veredito(f.id, e);
          return (
            <motion.div key={f.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 * k }} className="rounded-2xl bg-terra-950 p-4">
              <p className="font-medium text-zinc-100">{f.nome}</p>
              <p className="text-xs text-zinc-400">{f.quem}</p>
              <p className={`mt-3 inline-block rounded-full border px-3 py-1 text-sm font-medium ${COR_SELO[v.selo]}`}>{TEXTO_SELO[v.selo]}</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{v.motivos[0]}</p>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-relaxed text-zinc-300 md:grid-cols-2">
        <p className="rounded-2xl bg-terra-950 p-4">
          <strong className="text-zinc-100">O selo é a leitura do ciclo, não a decisão do seu negócio.</strong> Quem compra todo dia decide pela margem: a calculadora da aba Hoje faz essa conta. O selo soma pontos por duas coisas: a fase do ciclo e a relação de troca. A fase pesa mais, porque foi o que mais separou bons e maus negócios nos testes com dados de 2006 a 2026.
        </p>
        <p className="rounded-2xl bg-terra-950 p-4">
          <strong className="text-zinc-100">Custo da arroba produzida.</strong> Para quem engorda, a conta é: custo por dia ÷ (ganho de peso por dia em kg ÷ 15). O resultado é quanto custa produzir 1 arroba; compare com o preço do boi. A calculadora da aba Hoje usa essa conta e soma compra, frete e juros.
        </p>
      </div>
    </div>
  );
}

const GLOSSARIO: [string, string][] = [
  ["Arroba (@)", "15 kg de carcaça. O preço do boi gordo é dado por arroba."],
  ["Retenção de fêmeas", "O produtor segura as vacas em vez de mandá-las ao abate, para ter mais bezerros depois."],
  ["Descarte de fêmeas", "Vacas enviadas ao abate. Quando o descarte sobe, a oferta de bezerros cai alguns anos depois."],
  ["Relação de troca", "Quantos bezerros um boi gordo de 18 arrobas compra."],
  ["GMD", "Ganho médio diário: quantos kg o animal engorda por dia."],
  ["Preço sem a inflação", "O preço de cada mês corrigido pelo IGP-DI, para comparar épocas diferentes."],
];

export function Conhecimento({ painel: p }: { painel: Painel }) {
  const hoje = estagio(entradaDoPainel(p));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-zinc-50 sm:text-4xl">Como funciona o ciclo pecuário</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-300">
          Em 5 passos, sem termo difícil. Cada desenho se mexe para mostrar a ideia, e os números vêm dos dados de hoje. Hoje o ciclo está em{" "}
          <strong className="text-sol">{NOME_ESTAGIO[hoje]}</strong>.
        </p>
      </div>

      <Passo n={1} titulo="O preço do boi sobe e desce em ondas" resumo="Cada volta leva alguns anos: do fundo ao pico e de volta ao fundo. Toque numa fase para ver o que acontece e o que significa para cada tipo de produtor.">
        <Onda hoje={hoje} />
      </Passo>

      <Passo n={2} titulo="Por que a onda existe" resumo="O gado leva anos para ser produzido. Quando o preço muda, a oferta só reage muito depois, e isso faz o preço passar do ponto. Siga a engrenagem:">
        <Engrenagem />
      </Passo>

      <Passo n={3} titulo="Os 3 sinais que a Bússola lê" resumo="Para saber em que ponto da onda estamos, a Bússola mede três coisas, sempre com dados públicos e atualizados toda semana.">
        <Sinais p={p} />
      </Passo>

      <Passo n={4} titulo="Do sinal à decisão" resumo="Cada perfil recebe um selo: Melhor momento, Bom para comprar ou Aguarde. O selo vem sempre com o motivo e a conta. Estes são os de hoje:">
        <Decisao p={p} />
      </Passo>

      <Passo n={5} titulo="O que a Bússola não sabe" resumo="Ela é uma leitura estatística, não uma bola de cristal. Três avisos honestos:">
        <ul className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <li className="rounded-2xl bg-terra-950 p-4">
            <strong className="text-zinc-100">Poucos ciclos.</strong> Temos dados do boi desde 1997, mas só os 3 ciclos completos desde 2006 entram nas contas: o de 1998–2006 foi atípico e piorou os testes. A janela do próximo pico é uma estimativa, não uma data.
          </li>
          <li className="rounded-2xl bg-terra-950 p-4">
            <strong className="text-zinc-100">Previsão curta é difícil.</strong> Em 3 meses o modelo empata com o palpite “o preço fica onde está”. Ele ajuda mais em 1 ano. A aba <em>Previsão</em> mostra os testes.
          </li>
          <li className="rounded-2xl bg-terra-950 p-4">
            <strong className="text-zinc-100">Surpresas existem.</strong> Uma tarifa, um embargo ou uma seca podem mexer no preço fora do ciclo. As notícias da semana aparecem na aba <em>Notícias</em>, mas ainda não entram na conta.
          </li>
        </ul>
      </Passo>

      <section aria-labelledby="gloss" className="rounded-3xl border border-terra-700 p-5 sm:p-8">
        <h3 id="gloss" className="font-display text-xl text-zinc-50">Palavras que aparecem no site</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {GLOSSARIO.map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium text-zinc-100">{t}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-zinc-400">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
