"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { mesAno, numero, reais, somarMeses } from "@/lib/formato";
import type { ItemPrevisao, Painel } from "@/lib/painel";

const W = 1000;
const H = 380;
const M = { l: 56, r: 20, t: 28, b: 40 };
const DURACAO = 2.4; // segundos para desenhar a onda inteira

type Props = Pick<Painel, "serie" | "pivos" | "fase" | "hoje"> & { previsaoBoi: ItemPrevisao[] };

const indiceMes = (inicio: string, mes: string) => {
  const [a0, m0] = inicio.split("-").map(Number);
  const [a, m] = mes.split("-").map(Number);
  return (a - a0) * 12 + (m - m0);
};

export function CicloOnda({ serie, pivos, fase, hoje, previsaoBoi }: Props) {
  const reduzir = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
  const [foco, setFoco] = useState<number | null>(null);

  const g = useMemo(() => {
    const inicio = serie[0].mes;
    const ultimo = serie.length - 1;
    const futuro = previsaoBoi.filter((p) => p.semanas <= 52).sort((a, b) => a.semanas - b.semanas);
    const zonaMes = fase.janela && { de: indiceMes(inicio, fase.janela.de), ate: indiceMes(inicio, fase.janela.ate) };
    // O eixo vai até a previsão de 1 ano ou até o fim da zona histórica, o que vier depois.
    const nMeses = Math.max(ultimo + 13, (zonaMes?.ate ?? 0) + 3);
    const valores = [...serie.map((s) => s.boiReal), ...futuro.map((p) => p.maximo)];
    const passo = 100;
    const yMin = Math.floor((Math.min(...valores) * 0.85) / passo) * passo;
    const yMax = Math.ceil((Math.max(...valores) * 1.04) / passo) * passo;
    const x = (i: number) => M.l + (i / nMeses) * (W - M.l - M.r);
    const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * (H - M.t - M.b);

    // Mês i está "subindo" se o último pico/vale antes dele foi um vale.
    const pivosIdx = pivos.map((p) => ({ ...p, i: indiceMes(inicio, p.mes) }));
    const sobe = serie.map((_, i) => {
      const ant = pivosIdx.filter((p) => p.i < i).at(-1);
      return ant ? ant.tipo === "vale" : pivosIdx[0]?.tipo === "pico";
    });

    // Trechos de mesma direção viram caminhos separados (verde subindo, rosa caindo).
    const trechos: { d: string; sobe: boolean; de: number; ate: number }[] = [];
    let de = 0;
    for (let i = 1; i <= serie.length; i++) {
      if (i === serie.length || sobe[i] !== sobe[de]) {
        const fim = Math.min(i, ultimo);
        const pts = serie.slice(de, fim + 1).map((s, k) => `${x(de + k).toFixed(1)},${y(s.boiReal).toFixed(1)}`);
        trechos.push({ d: `M${pts.join("L")}`, sobe: sobe[de], de, ate: fim });
        de = i;
      }
    }

    const zona = zonaMes;

    const base = { i: ultimo, v: serie[ultimo].boiReal };
    const pontosFut = futuro.map((p) => ({ i: ultimo + Math.round(p.semanas / 4.345), p }));
    const linhaFut = [base, ...pontosFut.map((f) => ({ i: f.i, v: f.p.previsto }))];
    const faixa = [
      ...[{ i: ultimo, v: base.v }, ...pontosFut.map((f) => ({ i: f.i, v: f.p.maximo }))].map((q) => `${x(q.i)},${y(q.v)}`),
      ...[...pontosFut.map((f) => ({ i: f.i, v: f.p.minimo }))].reverse().map((q) => `${x(q.i)},${y(q.v)}`),
      `${x(ultimo)},${y(base.v)}`,
    ].join(" ");

    const anos: { i: number; rotulo: string }[] = [];
    for (let i = 0; i <= nMeses; i++) {
      const mes = somarMeses(inicio, i);
      if (mes.endsWith("-01") && Number(mes.slice(0, 4)) % 2 === 0) anos.push({ i, rotulo: mes.slice(0, 4) });
    }
    const linhasY = Array.from({ length: (yMax - yMin) / passo + 1 }, (_, k) => yMin + k * passo);

    return { x, y, sobe, trechos, zona, base, linhaFut, faixa, pontosFut, anos, linhasY, pivosIdx, ultimo, nMeses, inicio };
  }, [serie, pivos, fase, previsaoBoi]);

  // No celular o gráfico fica mais largo que a tela; começa mostrando o "hoje" (fim da linha).
  const rolagem = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = rolagem.current;
    if (r) r.scrollLeft = r.scrollWidth;
  }, []);

  const aoMover = (ev: React.PointerEvent) => {
    const r = caixa.current!.getBoundingClientRect();
    const xv = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.round(((xv - M.l) / (W - M.l - M.r)) * g.nMeses);
    setFoco(i >= 0 && i <= g.ultimo ? i : null);
  };

  const ponto = foco != null ? serie[foco] : null;
  const pctX = foco != null ? (g.x(foco) / W) * 100 : 0;
  const pico = pivos.filter((p) => p.tipo === "pico").at(-1);

  return (
    <figure className="relative">
      <div ref={rolagem} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div
        ref={caixa}
        className="relative min-w-[46rem] select-none sm:min-w-0"
        onPointerMove={aoMover}
        onPointerDown={aoMover}
        onPointerLeave={() => setFoco(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Preço real do boi gordo de ${mesAno(serie[0].mes)} a ${mesAno(serie[g.ultimo].mes)}, com picos e vales do ciclo e previsão para 12 meses.`}
        >
          <defs>
            <linearGradient id="zona" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-sol)" stopOpacity="0.02" />
              <stop offset="0.5" stopColor="var(--color-sol)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--color-sol)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {g.linhasY.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={g.y(v)} y2={g.y(v)} stroke="var(--color-terra-700)" strokeDasharray="2 6" />
              <text x={M.l - 10} y={g.y(v) + 4} textAnchor="end" className="fill-zinc-500 text-[13px] tabular-nums">
                {Math.round(v)}
              </text>
            </g>
          ))}
          {g.anos.map((a) => (
            <text key={a.i} x={g.x(a.i)} y={H - 12} textAnchor="middle" className="fill-zinc-500 text-[13px] tabular-nums">
              {a.rotulo}
            </text>
          ))}

          {g.zona && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduzir ? 0 : DURACAO, duration: 0.8 }}>
              <rect x={g.x(g.zona.de)} y={M.t} width={g.x(g.zona.ate) - g.x(g.zona.de)} height={H - M.t - M.b} fill="url(#zona)" />
              <text x={(g.x(g.zona.de) + g.x(g.zona.ate)) / 2} y={M.t + 14} textAnchor="middle" className="fill-sol text-[11px] font-medium uppercase tracking-wider">
                <tspan>Zona histórica</tspan>
                <tspan x={(g.x(g.zona.de) + g.x(g.zona.ate)) / 2} dy={14}>
                  {fase.sobe ? "de pico" : "de fundo"}
                </tspan>
              </text>
            </motion.g>
          )}

          {g.trechos.map((t) => {
            const frac = (t.ate - t.de) / g.ultimo;
            return (
              <motion.path
                key={t.de}
                d={t.d}
                fill="none"
                stroke={t.sobe ? "var(--color-capim)" : "var(--color-alerta)"}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: reduzir ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: reduzir ? 0 : (t.de / g.ultimo) * DURACAO, duration: reduzir ? 0 : frac * DURACAO, ease: "linear" }}
              />
            );
          })}

          {g.pivosIdx.map((p) => (
            <motion.g key={p.mes} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduzir ? 0 : (p.i / g.ultimo) * DURACAO }}>
              <circle cx={g.x(p.i)} cy={g.y(p.boiReal)} r={3.5} className={p.tipo === "pico" ? "fill-capim" : "fill-alerta"} />
              <text
                x={g.x(p.i)}
                y={g.y(p.boiReal) + (p.tipo === "pico" ? -12 : 22)}
                textAnchor="middle"
                className="fill-zinc-400 text-[12px]"
              >
                {p.tipo} {mesAno(p.mes).replace("/20", "/")}
              </text>
            </motion.g>
          ))}

          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduzir ? 0 : DURACAO + 0.3, duration: 0.8 }}>
            <polygon points={g.faixa} fill="var(--color-sol)" fillOpacity={0.12} />
            <polyline
              points={g.linhaFut.map((q) => `${g.x(q.i)},${g.y(q.v)}`).join(" ")}
              fill="none"
              stroke="var(--color-sol)"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
            {g.pontosFut.filter((f) => f.p.semanas >= 13).map((f) => (
              <text key={f.p.semanas} x={g.x(f.i) - 4} y={g.y(f.p.previsto) - 10} textAnchor="end" className="fill-sol text-[12px] tabular-nums">
                {Math.round(f.p.previsto)}
              </text>
            ))}
          </motion.g>

          <g transform={`translate(${g.x(g.ultimo)} ${g.y(g.base.v)})`}>
            {!reduzir && (
              <motion.circle
                r={6}
                fill="none"
                stroke="var(--color-capim)"
                strokeWidth={2}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 3.2], opacity: [0.9, 0] }}
                transition={{ delay: DURACAO, duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <circle r={5.5} className="fill-capim stroke-terra-950" strokeWidth={2} />
          </g>

          {foco != null && ponto && (
            <g pointerEvents="none">
              <line x1={g.x(foco)} x2={g.x(foco)} y1={M.t} y2={H - M.b} stroke="#a1a1aa" strokeOpacity={0.4} />
              <circle cx={g.x(foco)} cy={g.y(ponto.boiReal)} r={5} fill="white" />
            </g>
          )}
        </svg>

        {foco != null && ponto && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-terra-700 bg-terra-900/95 p-3 text-xs shadow-xl backdrop-blur"
            style={pctX > 55 ? { right: `${100 - pctX + 2}%` } : { left: `${pctX + 2}%` }}
          >
            <p className="mb-1.5 font-semibold text-zinc-100">{mesAno(ponto.mes)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums text-zinc-400">
              <dt>Boi gordo</dt>
              <dd className="text-right text-zinc-100">{reais(ponto.boi)}/@</dd>
              <dt>Em valores de hoje</dt>
              <dd className="text-right text-zinc-100">{reais(ponto.boiReal)}/@</dd>
              {ponto.bezerro && (
                <>
                  <dt>Bezerro MS</dt>
                  <dd className="text-right text-zinc-100">{reais(ponto.bezerro)}</dd>
                </>
              )}
              {ponto.rt && (
                <>
                  <dt>Boi compra</dt>
                  <dd className="text-right text-zinc-100">{numero(ponto.rt)} bezerros</dd>
                </>
              )}
            </dl>
            <p className={`mt-1.5 font-medium ${g.sobe[foco] ? "text-capim" : "text-alerta"}`}>
              Ciclo {g.sobe[foco] ? "subindo" : "caindo"}
            </p>
          </div>
        )}
      </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400 sm:hidden">Arraste o gráfico para o lado para ver os anos anteriores.</p>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-capim" /> preço subindo</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-alerta" /> preço caindo</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed border-sol" /> previsão e faixa provável</span>
        <span>Boi gordo Cepea, R$/@ em valores de hoje (corrigido pelo IGP-DI). Hoje: {reais(hoje.boi, 2)}/@{pico ? ` · último pico ${mesAno(pico.mes)}` : ""}.</span>
      </figcaption>
    </figure>
  );
}
