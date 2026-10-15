// Teste no passado: ajusta tudo só com dados até 2022 e mede o acerto em 2023–2026.
// Uso: node pipeline/modelo/backtest.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { INICIO_SERIE, montarSerie } from "./dados.ts";
import { FASES_DE_SUBIDA, gabaritoSubida, lerFase, lerFasePreco, pivosDePreco, type ParamsFase } from "./fase.ts";
import { prever, treinar, treinarCalibrado, type Alvo } from "./previsao.ts";

const FIM_TREINO = "2022-12";
const LIMIAR_CICLO = 0.2;
const serie = montarSerie();
const gabarito = gabaritoSubida(serie.map((m) => m.boiReal), LIMIAR_CICLO);
const noTreino = (i: number) => serie[i].mes <= FIM_TREINO;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// ---------- Fase ----------
// O gabarito só fica confirmado depois que o preço anda 20%; no treino, usamos meses até 2020
// para não usar viradas que só se confirmaram depois de 2022.
const FIM_GABARITO_TREINO = "2020-12";
const gabaritoTreino = gabaritoSubida(
  serie.filter((m) => m.mes <= FIM_TREINO).map((m) => m.boiReal),
  LIMIAR_CICLO,
);

function acertoFase(p: ParamsFase, de: string, ate: string, gab: boolean[]) {
  let ok = 0, n = 0;
  serie.forEach((m, i) => {
    if (m.mes < de || m.mes > ate || i >= gab.length) return;
    const l = lerFase(serie, i, p);
    if (!l) return;
    n++;
    if (FASES_DE_SUBIDA.includes(l.fase) === gab[i]) ok++;
  });
  return { acerto: ok / n, meses: n };
}

// Linha de base: "se o preço real subiu nos últimos 12 meses, continua subindo".
function acertoMomento(de: string, ate: string, gab: boolean[]) {
  let ok = 0, n = 0;
  serie.forEach((m, i) => {
    if (m.mes < de || m.mes > ate || i < 12 || i >= gab.length) return;
    n++;
    if ((m.boiReal > serie[i - 12].boiReal) === gab[i]) ok++;
  });
  return { acerto: ok / n, meses: n };
}

const candidatos: ParamsFase[] = [];
for (const janelaMedia of [60, 84, 120]) for (const janelaDirecao of [3, 6, 9, 12]) candidatos.push({ janelaMedia, janelaDirecao });
const ranking = candidatos
  .map((p) => ({ p, ...acertoFase(p, INICIO_SERIE, FIM_GABARITO_TREINO, gabaritoTreino) }))
  .sort((a, b) => b.acerto - a.acerto);
const melhor = ranking[0].p;

// Regra alternativa: direção do preço pelo último pico/vale já confirmado (sem olhar o futuro).
function acertoPreco(limiar: number, de: string, ate: string, gab: boolean[]) {
  let ok = 0, n = 0;
  serie.forEach((m, i) => {
    if (m.mes < de || m.mes > ate || i >= gab.length) return;
    n++;
    if (lerFasePreco(serie, i, limiar).sobe === gab[i]) ok++;
  });
  return { acerto: ok / n, meses: n };
}
const regrasPreco = [0.08, 0.1, 0.15, 0.2]
  .map((l) => ({ limiar: l, ...acertoPreco(l, INICIO_SERIE, FIM_GABARITO_TREINO, gabaritoTreino) }))
  .sort((a, b) => b.acerto - a.acerto);
const momentoTreino = acertoMomento(INICIO_SERIE, FIM_GABARITO_TREINO, gabaritoTreino);
const faseTeste = acertoFase(melhor, "2023-01", "2026-12", gabarito);
const momentoTeste = acertoMomento("2023-01", "2026-12", gabarito);

console.log("=== FASE DO CICLO ===");
console.log("Picos e vales (preço real, limiar 20%):", pivosDePreco(serie, LIMIAR_CICLO).map((p) => `${p.tipo} ${p.mes}`).join(", "));
console.log(`Melhor regra no treino (até ${FIM_GABARITO_TREINO}): média ${melhor.janelaMedia}m, direção ${melhor.janelaDirecao}m → acerto ${pct(ranking[0].acerto)} em ${ranking[0].meses} meses`);
console.log(`Teste 2023–2026: acerto ${pct(faseTeste.acerto)} em ${faseTeste.meses} meses (palpite "segue a tendência de 12m": ${pct(momentoTeste.acerto)})`);
console.log(`Treino, tendência 12m: ${pct(momentoTreino.acerto)}`);
for (const r of regrasPreco) console.log(`Treino, regra de preço limiar ${pct(r.limiar)}: ${pct(r.acerto)}`);
const melhorPreco = regrasPreco[0];
const precoTeste = acertoPreco(melhorPreco.limiar, "2023-01", "2026-12", gabarito);
console.log(`Escolhida no treino: limiar ${pct(melhorPreco.limiar)} → teste 2023–2026: ${pct(precoTeste.acerto)}`);
for (const m of serie.filter((x) => x.mes >= "2023-01" && x.mes.endsWith("-01") || x.mes === serie.at(-1)!.mes)) {
  const l = lerFasePreco(serie, serie.indexOf(m), melhorPreco.limiar);
  console.log(`  ${m.mes} preço ${l.sobe ? "subindo" : "caindo"} desde ${l.ultimoPivo?.tipo} ${l.ultimoPivo?.mes} (${l.mesesDesdePivo}m) | real vs pico anterior ${l.realVsPicoAnterior?.toFixed(2)}`);
}
const linhaFase = serie
  .map((m, i) => ({ mes: m.mes, l: lerFase(serie, i, melhor), sobe: gabarito[i] }))
  .filter((x) => x.mes >= "2022-01" && x.l);
for (const x of linhaFase.filter((_, k) => k % 3 === 0 || k === linhaFase.length - 1))
  console.log(`  ${x.mes} fase=${x.l!.fase.padEnd(6)} fêmeas=${pct(x.l!.femeas)} média=${pct(x.l!.media)} real=${x.sobe ? "subindo" : "caindo"}`);

// ---------- Previsão de preço ----------
console.log("\n=== PREVISÃO DE PREÇO (treino até 2022, teste 2023–2026) ===");
const resultados: Record<string, unknown>[] = [];
for (const alvo of ["boi", "bezerro"] as Alvo[]) {
  for (const h of [1, 3, 12]) {
    const modelo = treinarCalibrado(serie, alvo, h, FIM_TREINO);
    let erroModelo = 0, erroIngenuo = 0, dentro = 0, n = 0, direcaoOk = 0;
    for (let i = 0; i + h < serie.length; i++) {
      if (noTreino(i + h) || serie[i].mes < "2023-01") continue;
      const p = prever(modelo, serie, i);
      const real = serie[i + h][alvo];
      if (!p || real == null) continue;
      n++;
      erroModelo += Math.abs(p.previsto / real - 1);
      erroIngenuo += Math.abs(p.base / real - 1);
      if (real >= p.minimo && real <= p.maximo) dentro++;
      if (Math.sign(p.previsto - p.base) === Math.sign(real - p.base)) direcaoOk++;
    }
    const r = {
      alvo, semanas: Math.round(h * 4.345), meses: h, amostrasTreino: modelo.amostras, previsoesTeste: n,
      erroMedioModelo: erroModelo / n, erroMedioIngenuo: erroIngenuo / n,
      acertoDirecao: direcaoOk / n, dentroDaFaixa80: dentro / n,
    };
    resultados.push(r);
    console.log(
      `${alvo.padEnd(7)} ${String(r.semanas).padStart(2)} sem: erro médio ${pct(r.erroMedioModelo)} (preço parado: ${pct(r.erroMedioIngenuo)}) | direção certa ${pct(r.acertoDirecao)} | real dentro da faixa 80%: ${pct(r.dentroDaFaixa80)} | n=${n}`,
    );
  }
}

// Previsão de hoje, com o modelo treinado em TODOS os dados (para uso real).
console.log("\n=== HOJE (modelo re-treinado com todos os dados) ===");
const ultimo = serie.length - 1;
const faseHoje = lerFase(serie, ultimo, melhor);
console.log(`${serie[ultimo].mes}: fase ${faseHoje?.fase} | fêmeas ${pct(faseHoje!.femeas)} vs média ${pct(faseHoje!.media)} | relação de troca ${serie[ultimo].rt!.toFixed(2)}`);
const hoje: Record<string, unknown>[] = [];
for (const alvo of ["boi", "bezerro"] as Alvo[])
  for (const h of [1, 3, 12]) {
    const p = prever(treinarCalibrado(serie, alvo, h, serie[ultimo].mes), serie, ultimo)!;
    hoje.push({ alvo, meses: h, ...p });
    console.log(`  ${alvo.padEnd(7)} +${h}m: R$ ${p.previsto.toFixed(0)} (faixa ${p.minimo.toFixed(0)}–${p.maximo.toFixed(0)}) a partir de ${p.base.toFixed(0)}`);
  }

// Teste mais duro: ano a ano de 2014 a 2025, cada ano previsto com o modelo treinado até o ano anterior.
console.log("\n=== PREVISÃO, ANO A ANO 2014–2025 ===");
const rolante: Record<string, unknown>[] = [];
for (const alvo of ["boi", "bezerro"] as Alvo[])
  for (const h of [3, 12]) {
    let em = 0, ei = 0, n = 0, anosMelhor = 0, anos = 0;
    for (let ano = 2014; ano <= 2025; ano++) {
      const modelo = treinar(serie, alvo, h, `${ano - 1}-12`);
      let a = 0, b = 0, k = 0;
      serie.forEach((x, i) => {
        if (!x.mes.startsWith(String(ano)) || !serie[i + h]) return;
        const p = prever(modelo, serie, i);
        const real = serie[i + h][alvo];
        if (!p || real == null) return;
        a += Math.abs(p.previsto / real - 1);
        b += Math.abs(p.base / real - 1);
        k++;
      });
      if (!k) continue;
      em += a; ei += b; n += k; anos++;
      if (a < b) anosMelhor++;
    }
    const r = { alvo, semanas: Math.round(h * 4.345), erroMedioModelo: em / n, erroMedioIngenuo: ei / n, anosMelhor, anos };
    rolante.push(r);
    console.log(`${alvo.padEnd(7)} ${String(r.semanas).padStart(2)} sem: erro ${pct(r.erroMedioModelo)} (preço parado ${pct(r.erroMedioIngenuo)}) | melhor em ${anosMelhor} de ${anos} anos`);
  }

const SAIDA = process.env.BACKTEST_DIR ?? "../../data/backtest/";
mkdirSync(new URL(SAIDA, import.meta.url), { recursive: true });
writeFileSync(
  new URL(`${SAIDA}relatorio.json`, import.meta.url),
  JSON.stringify({ geradoEm: new Date().toISOString(), fimTreino: FIM_TREINO, regraFase: melhor,
    fase: { femeas: { treino: ranking[0], teste: faseTeste }, preco: { ...melhorPreco, teste: precoTeste }, linhaDeBase: { treino: momentoTreino, teste: momentoTeste } }, previsao: resultados, rolante, hoje }, null, 1) + "\n",
);
