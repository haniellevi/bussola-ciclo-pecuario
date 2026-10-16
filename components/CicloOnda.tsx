"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mesAno, numero, reais, somarMeses } from "@/lib/formato";
import type { ItemPrevisao, Painel } from "@/lib/painel";
import { CHAVE_HISTORICO, EVENTO_HISTORICO, lerHistorico, type Registro } from "@/lib/historico";

const M = { l: 44, r: 12, t: 24, b: 30 };
const CICLOS_MEDIA = 3; // ciclos completos (vale a vale) usados no "se o passado se repetir"

type Props = Pick<Painel, "serie" | "pivos" | "fase" | "hoje"> & { previsaoBoi: ItemPrevisao[] };

const indiceMes = (inicio: string, mes: string) => {
  const [a0, m0] = inicio.split("-").map(Number);
  const [a, m] = mes.split("-").map(Number);
  return (a - a0) * 12 + (m - m0);
};

// Onda do ciclo: passado real (Cepea, corrigido pela inflação), previsão de 1 ano e, depois dela,
// o caminho médio dos últimos ciclos a partir do vale atual. Arrasta para os lados; botões mudam o período.
export function CicloOnda({ serie, pivos, fase, hoje, previsaoBoi }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [foco, setFoco] = useState<number | null>(null);
  const [janela, setJanela] = useState<[number, number] | null>(null);
  const [historico, setHistorico] = useState<Registro[]>([]);
  const arraste = useRef<{ x: number; v: [number, number]; moveu: boolean } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // Aba escondida mede 0 de largura: mantém a medida anterior.
    const o = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setLargura(w);
    });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  // Decisões que a pessoa guardou na calculadora viram pontos na onda.
  useEffect(() => {
    const ler = () => setHistorico(lerHistorico());
    ler();
    const aoGuardar = (ev: StorageEvent) => ev.key === CHAVE_HISTORICO && ler();
    window.addEventListener(EVENTO_HISTORICO, ler);
    window.addEventListener("storage", aoGuardar);
    return () => {
      window.removeEventListener(EVENTO_HISTORICO, ler);
      window.removeEventListener("storage", aoGuardar);
    };
  }, []);

  const d = useMemo(() => {
    const inicio = serie[0].mes;
    const ultimo = serie.length - 1;
    const pivosIdx = pivos.map((p) => ({ ...p, i: indiceMes(inicio, p.mes) }));
    const sobe = serie.map((_, i) => {
      const ant = pivosIdx.filter((p) => p.i < i).at(-1);
      return ant ? ant.tipo === "vale" : pivosIdx[0]?.tipo === "pico";
    });

    // Previsão registrada (até 52 semanas)
    const futuro = previsaoBoi.filter((p) => p.semanas <= 52).sort((a, b) => a.semanas - b.semanas);
    const pontosFut = futuro.map((p) => ({ i: ultimo + Math.round(p.semanas / 4.345), p }));

    // Se o passado se repetir: preço de hoje × (caminho médio dos ciclos passados a partir do vale) ÷ (média no mesmo ponto).
    const vales = pivosIdx.filter((p) => p.tipo === "vale" && p.i >= 0 && p.i <= ultimo);
    const valeAtual = vales.at(-1);
    const ciclos = vales.slice(0, -1).map((v, j) => ({ de: v.i, ate: vales[j + 1].i })).slice(-CICLOS_MEDIA);
    const proj: { i: number; v: number; min: number; max: number }[] = [];
    if (valeAtual && ciclos.length >= 2) {
      const tHoje = ultimo - valeAtual.i;
      const razao = (c: { de: number; ate: number }, t: number) => (t <= c.ate - c.de ? serie[c.de + t].boiReal / serie[c.de].boiReal : null);
      const media = (t: number) => {
        const r = ciclos.map((c) => razao(c, t)).filter((x): x is number => x != null);
        return r.length >= 2 ? { m: r.reduce((a, b) => a + b, 0) / r.length, min: Math.min(...r), max: Math.max(...r) } : null;
      };
      const base = media(tHoje);
      if (base) {
        const f = serie[ultimo].boiReal / base.m;
        for (let t = tHoje; ; t++) {
          const x = media(t);
          if (!x) break;
          proj.push({ i: valeAtual.i + t, v: x.m * f, min: x.min * f, max: x.max * f });
        }
      }
    }

    const zona = fase.janela && { de: indiceMes(inicio, fase.janela.de), ate: indiceMes(inicio, fase.janela.ate) };
    const nMeses = Math.max(ultimo + 13, proj.at(-1)?.i ?? 0, (zona?.ate ?? 0) + 2);
    return { inicio, ultimo, pivosIdx, sobe, pontosFut, proj, zona, nMeses, ciclos };
  }, [serie, pivos, fase, previsaoBoi]);

  const PERIODOS: { id: string; rotulo: string; v: [number, number] }[] = [
    { id: "5", rotulo: "5 anos", v: [d.ultimo - 42, d.ultimo + 18] },
    { id: "10", rotulo: "10 anos", v: [d.ultimo - 96, d.ultimo + 24] },
    { id: "tudo", rotulo: "Tudo", v: [0, d.nMeses] },
    { id: "futuro", rotulo: "Futuro", v: [d.ultimo - 24, d.nMeses] },
  ];
  const celular = largura > 0 && largura < 640;
  const [v0, v1] = janela ?? (celular ? PERIODOS[1].v : PERIODOS[2].v);
  const ativo = PERIODOS.find((p) => p.v[0] === v0 && p.v[1] === v1)?.id;

  const W = largura || 1000;
  const H = celular ? 300 : 380;
  const largPlot = W - M.l - M.r;
  const x = (i: number) => M.l + ((i - v0) / (v1 - v0)) * largPlot;
  const visivel = (i: number) => i >= v0 - 1 && i <= v1 + 1;

  // Escala vertical do que está na tela (zoom de verdade quando o período é curto).
  const valores = [
    ...serie.flatMap((s, i) => (visivel(i) ? [s.boiReal] : [])),
    ...d.pontosFut.flatMap((f) => (visivel(f.i) ? [f.p.minimo, f.p.maximo] : [])),
    ...d.proj.flatMap((p) => (visivel(p.i) ? [p.min, p.max] : [])),
  ];
  const lo = Math.min(...valores), hi = Math.max(...valores);
  const passoY = hi - lo > 250 ? 100 : 50;
  const yMin = Math.floor((lo * 0.95) / passoY) * passoY;
  const yMax = Math.ceil((hi * 1.03) / passoY) * passoY;
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const linhasY = Array.from({ length: Math.round((yMax - yMin) / passoY) + 1 }, (_, k) => yMin + k * passoY);

  // Anos no eixo: passo que caiba na largura
  const anosNaTela = (v1 - v0) / 12;
  const passoAno = [1, 2, 5, 10].find((p) => (W - M.l) / (anosNaTela / p) > 56) ?? 10;
  const anos: { i: number; rotulo: string }[] = [];
  for (let i = Math.max(0, Math.floor(v0)); i <= Math.min(d.nMeses, v1); i++) {
    const mes = somarMeses(d.inicio, i);
    if (mes.endsWith("-01") && Number(mes.slice(0, 4)) % passoAno === 0) anos.push({ i, rotulo: mes.slice(0, 4) });
  }

  // Linhas: trechos de mesma direção (verde subindo, vermelho caindo)
  const trechos: { d: string; sobe: boolean; de: number }[] = [];
  let de = 0;
  for (let i = 1; i <= serie.length; i++) {
    if (i === serie.length || d.sobe[i] !== d.sobe[de]) {
      const fim = Math.min(i, d.ultimo);
      const pts = serie.slice(de, fim + 1).map((s, k) => `${x(de + k).toFixed(1)},${y(s.boiReal).toFixed(1)}`);
      trechos.push({ d: `M${pts.join("L")}`, sobe: d.sobe[de], de });
      de = i;
    }
  }
  const base = { i: d.ultimo, v: serie[d.ultimo].boiReal };
  const linhaPrev = [base, ...d.pontosFut.map((f) => ({ i: f.i, v: f.p.previsto }))].map((q) => `${x(q.i)},${y(q.v)}`).join(" ");
  const faixaPrev = [
    ...[base, ...d.pontosFut.map((f) => ({ i: f.i, v: f.p.maximo }))].map((q) => `${x(q.i)},${y(q.v)}`),
    ...d.pontosFut.map((f) => ({ i: f.i, v: f.p.minimo })).reverse().map((q) => `${x(q.i)},${y(q.v)}`),
  ].join(" ");
  const linhaProj = d.proj.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const faixaProj = [...d.proj.map((p) => `${x(p.i).toFixed(1)},${y(p.max).toFixed(1)}`), ...[...d.proj].reverse().map((p) => `${x(p.i).toFixed(1)},${y(p.min).toFixed(1)}`)].join(" ");

  const decisoes = historico
    .map((r) => {
      const i = indiceMes(d.inicio, r.data.slice(0, 7));
      return { r, i: Math.min(i, d.ultimo) };
    })
    .filter((q) => q.i >= 0);

  // Arrastar move o período; tocar sem arrastar mostra o mês.
  const mesEm = (clientX: number) => {
    const r = caixa.current!.getBoundingClientRect();
    return Math.round(v0 + ((clientX - r.left - M.l) / largPlot) * (v1 - v0));
  };
  const mover = (desloc: number) => {
    const span = v1 - v0;
    const n0 = Math.min(Math.max(desloc + v0, -6), d.nMeses + 6 - span);
    setJanela([n0, n0 + span]);
  };
  const aoDescer = (ev: React.PointerEvent) => {
    arraste.current = { x: ev.clientX, v: [v0, v1], moveu: false };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const aoMover = (ev: React.PointerEvent) => {
    const a = arraste.current;
    if (a) {
      const dx = ev.clientX - a.x;
      if (Math.abs(dx) > 6) a.moveu = true;
      if (a.moveu) {
        const span = a.v[1] - a.v[0];
        const n0 = Math.min(Math.max(a.v[0] - (dx / largPlot) * span, -6), d.nMeses + 6 - span);
        setJanela([n0, n0 + span]);
        setFoco(null);
      }
    } else if (ev.pointerType === "mouse") setFoco(mesEm(ev.clientX));
  };
  const aoSubir = (ev: React.PointerEvent) => {
    const a = arraste.current;
    arraste.current = null;
    if (a && !a.moveu) setFoco(mesEm(ev.clientX));
  };

  const f = foco != null && foco >= 0 && foco <= d.nMeses ? foco : null;
  const real = f != null && f <= d.ultimo ? serie[f] : null;
  const pj = f != null && f > d.ultimo ? d.proj.find((p) => p.i === f) : undefined;
  const prev = f != null && f > d.ultimo ? d.pontosFut.find((p) => Math.abs(p.i - f) <= 1) : undefined;
  const decisoesNoMes = f != null ? decisoes.filter((q) => q.i === f) : [];
  const yFoco = real ? real.boiReal : pj ? pj.v : null;
  const pctX = f != null ? (x(f) / W) * 100 : 0;
  const pico = pivos.filter((p) => p.tipo === "pico").at(-1);
  const t = (px: number) => ({ fontSize: px });

  return (
    <figure>
      <div role="group" aria-label="Período" className="flex rounded-full bg-superficie-2 p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={ativo === p.id}
            onClick={() => {
              setJanela(p.v);
              setFoco(null);
            }}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-2 text-sm font-medium transition-colors ${ativo === p.id ? "bg-superficie text-texto shadow-sm" : "text-texto-3"}`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div
        ref={caixa}
        className="relative mt-3 cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={() => (arraste.current = null)}
        onPointerLeave={(ev) => ev.pointerType === "mouse" && !arraste.current && setFoco(null)}
      >
        {largura > 0 && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="block"
            role="img"
            aria-label={`Preço real do boi gordo de ${mesAno(serie[0].mes)} a ${mesAno(serie[d.ultimo].mes)}, com picos e vales, previsão de 12 meses e o caminho médio dos ${d.ciclos.length} últimos ciclos.`}
          >
            <defs>
              <clipPath id="plot">
                <rect x={M.l} y={0} width={largPlot} height={H} />
              </clipPath>
            </defs>

            {linhasY.map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--color-linha)" strokeDasharray="2 6" />
                <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="fill-texto-3 tabular-nums" style={t(12)}>
                  {Math.round(v)}
                </text>
              </g>
            ))}

            <g clipPath="url(#plot)">
              {anos.map((a) => (
                <text key={a.i} x={x(a.i)} y={H - 8} textAnchor="middle" className="fill-texto-3 tabular-nums" style={t(12)}>
                  {a.rotulo}
                </text>
              ))}

              {/* Futuro: fundo levemente diferente a partir de hoje */}
              <rect x={x(d.ultimo)} y={M.t} width={Math.max(0, x(d.nMeses + 6) - x(d.ultimo))} height={H - M.t - M.b} className="fill-superficie-2" opacity={0.6} />
              <text x={x(d.ultimo) + 6} y={M.t + 14} className="fill-texto-3" style={t(12)}>
                futuro
              </text>

              {d.zona && (
                <g>
                  <rect x={x(d.zona.de)} y={M.t} width={x(d.zona.ate) - x(d.zona.de)} height={H - M.t - M.b} fill="var(--color-sol)" fillOpacity={0.1} />
                  <text x={(x(d.zona.de) + x(d.zona.ate)) / 2} y={M.t + 30} textAnchor="middle" className="fill-sol font-semibold" style={t(12)}>
                    {fase.sobe ? "pico?" : "fundo?"}
                  </text>
                </g>
              )}

              {d.proj.length > 1 && (
                <g>
                  <polygon points={faixaProj} className="fill-texto-4" fillOpacity={0.15} />
                  <polyline points={linhaProj} fill="none" stroke="var(--color-texto-3)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
                </g>
              )}

              <polygon points={faixaPrev} fill="var(--color-sol)" fillOpacity={0.15} />
              <polyline points={linhaPrev} fill="none" stroke="var(--color-sol)" strokeWidth={2.5} strokeDasharray="7 5" />

              {trechos.map((tr) => (
                <path key={tr.de} d={tr.d} fill="none" stroke={tr.sobe ? "var(--color-capim)" : "var(--color-alerta)"} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              ))}

              {d.pivosIdx.map((p) => (
                <g key={p.mes}>
                  <circle cx={x(p.i)} cy={y(p.boiReal)} r={3.5} className={p.tipo === "pico" ? "fill-capim" : "fill-alerta"} />
                  <text x={x(p.i)} y={y(p.boiReal) + (p.tipo === "pico" ? -10 : 18)} textAnchor="middle" className="fill-texto-3" style={t(12)}>
                    {p.tipo} {mesAno(p.mes).replace("/20", "/").replace("/19", "/")}
                  </text>
                </g>
              ))}

              {decisoes.map((q) => (
                <circle key={q.r.id} cx={x(q.i)} cy={y(serie[q.i].boiReal)} r={7} fill="none" stroke="var(--color-tinta)" strokeWidth={2.5} />
              ))}

              <circle cx={x(d.ultimo)} cy={y(base.v)} r={10} fill="var(--color-capim)" opacity={0.25} className="motion-safe:animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
              <circle cx={x(d.ultimo)} cy={y(base.v)} r={5.5} className="fill-capim stroke-fundo" strokeWidth={2} />
              <text x={x(d.ultimo)} y={y(base.v) - 14} textAnchor="middle" className="fill-texto font-semibold" style={t(12.5)}>
                hoje
              </text>

              {f != null && yFoco != null && (
                <g pointerEvents="none">
                  <line x1={x(f)} x2={x(f)} y1={M.t} y2={H - M.b} stroke="var(--color-texto-3)" strokeOpacity={0.5} />
                  <circle cx={x(f)} cy={y(yFoco)} r={5} fill="var(--color-texto)" />
                </g>
              )}
            </g>
          </svg>
        )}
        {largura === 0 && <div style={{ height: 300 }} />}

        {f != null && (real || pj || prev || decisoesNoMes.length > 0) && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-linha bg-superficie p-3 text-xs shadow-xl"
            style={pctX > 55 ? { right: `${100 - pctX + 2}%` } : { left: `${pctX + 2}%` }}
          >
            <p className="mb-1.5 font-semibold text-texto">{mesAno(somarMeses(d.inicio, f))}</p>
            {real && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums text-texto-3">
                <dt>Boi gordo</dt>
                <dd className="text-right text-texto">{reais(real.boi)}/@</dd>
                <dt>Em valores de hoje</dt>
                <dd className="text-right text-texto">{reais(real.boiReal)}/@</dd>
                {real.bezerro && (
                  <>
                    <dt>Bezerro MS</dt>
                    <dd className="text-right text-texto">{reais(real.bezerro)}</dd>
                  </>
                )}
                {real.rt && (
                  <>
                    <dt>Boi compra</dt>
                    <dd className="text-right text-texto">{numero(real.rt)} bezerros</dd>
                  </>
                )}
              </dl>
            )}
            {real && <p className={`mt-1.5 font-medium ${d.sobe[f] ? "text-capim" : "text-alerta"}`}>Ciclo {d.sobe[f] ? "subindo" : "caindo"}</p>}
            {prev && (
              <p className="text-texto-2">
                <span className="text-sol">Previsão:</span> {reais(prev.p.previsto)}/@ (faixa {reais(prev.p.minimo)} a {reais(prev.p.maximo)})
              </p>
            )}
            {pj && (
              <p className="mt-1 text-texto-2">
                Se o passado se repetir: <strong className="text-texto">{reais(pj.v)}/@</strong> (entre {reais(pj.min)} e {reais(pj.max)}). Não é previsão.
              </p>
            )}
            {decisoesNoMes.map((q) => (
              <p key={q.r.id} className="mt-1.5 text-tinta">
                Sua conta: {q.r.titulo} · {q.r.veredito}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button type="button" aria-label="Voltar no tempo" onClick={() => mover(-(v1 - v0) / 3)} className="flex h-10 w-10 items-center justify-center rounded-full bg-superficie-2 text-texto-2">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <p className="flex-1 text-center text-xs text-texto-3">Arraste para ver o passado e o futuro. Toque num ponto para ver o mês.</p>
        <button type="button" aria-label="Avançar no tempo" onClick={() => mover((v1 - v0) / 3)} className="flex h-10 w-10 items-center justify-center rounded-full bg-superficie-2 text-texto-2">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-texto-3">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-capim" /> subindo</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-alerta" /> caindo</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed border-sol" /> previsão de 1 ano</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dotted border-texto-3" /> se o passado se repetir</span>
        {d.zona && <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-sol/30" /> onde {fase.sobe ? "o pico" : "o fundo"} caiu nos ciclos passados</span>}
        {decisoes.length > 0 && <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full border-2 border-tinta" /> suas contas</span>}
      </figcaption>
      <p className="mt-2 text-xs text-texto-3">
        Boi gordo Cepea em valores de hoje (IGP-DI). Hoje: {reais(hoje.boi, 2)}/@{pico ? ` · último pico ${mesAno(pico.mes)}` : ""}. A linha pontilhada repete a média dos {d.ciclos.length} últimos ciclos a partir do vale de{" "}
        {d.pivosIdx.filter((p) => p.tipo === "vale").at(-1) ? mesAno(d.pivosIdx.filter((p) => p.tipo === "vale").at(-1)!.mes) : ""}; com tão poucos ciclos, é só uma referência.
      </p>
    </figure>
  );
}
