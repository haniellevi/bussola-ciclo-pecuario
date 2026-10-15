// Rodada semanal: conferir dados → registrar previsão (imutável) → comparar previsões vencidas → relatório.
// Pressupõe que coletar.ts e ler_cepea.py já rodaram.
// Uso: node pipeline/semanal.ts   (gera data/semanal/relatorio.md e sai com código 0)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { montarSerie } from "./modelo/dados.ts";
import { lerFasePreco, pivosDePreco } from "./modelo/fase.ts";
import { prever, treinarCalibrado, type Alvo } from "./modelo/previsao.ts";

const DATA = new URL("../data/", import.meta.url);
const PREVISOES = new URL("previsoes/", DATA);
const LIMIAR_CICLO = 0.2; // escolhido no teste (pipeline/modelo/backtest.ts)
const HORIZONTES = [
  { semanas: 4, meses: 1 },
  { semanas: 13, meses: 3 },
  { semanas: 52, meses: 12 },
];
const ALVOS: Alvo[] = ["boi", "bezerro"];
const ARQ_CEPEA: Record<Alvo, string> = { boi: "cepea/boi-gordo.json", bezerro: "cepea/bezerro-ms.json" };

type Dia = { data: string; valor: number };
const lerRaw = (c: string) => JSON.parse(readFileSync(new URL(`raw/${c}`, DATA), "utf8"));
const hoje = process.env.HOJE ?? new Date().toISOString().slice(0, 10);
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

// Semana ISO: identifica a semana da previsão e a semana-alvo.
function semanaIso(data: string) {
  const quinta = new Date(`${data}T12:00:00Z`);
  quinta.setUTCDate(quinta.getUTCDate() - ((quinta.getUTCDay() + 6) % 7) + 3);
  const ano = quinta.getUTCFullYear();
  const semana = 1 + Math.floor((quinta.getTime() - Date.UTC(ano, 0, 1, 12)) / 604_800_000);
  return `${ano}-S${String(semana).padStart(2, "0")}`;
}
const segundaDa = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Média dos dias úteis de uma semana (segunda a domingo).
function mediaDaSemana(dias: Dia[], segunda: string) {
  const fim = somarDias(segunda, 6);
  const v = dias.filter((d) => d.data >= segunda && d.data <= fim).map((d) => d.valor);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// ---------- 1. Conferência ----------
type Aviso = { nivel: "bloqueia" | "revisar"; texto: string };
const avisos: Aviso[] = [];
const diarios = {} as Record<Alvo, Dia[]>;
for (const alvo of ALVOS) {
  const dias: Dia[] = lerRaw(ARQ_CEPEA[alvo]).dados;
  diarios[alvo] = dias;
  const ultimo = dias.at(-1)!;
  const idade = diasEntre(ultimo.data, hoje);
  if (idade > 14) avisos.push({ nivel: "bloqueia", texto: `Cepea ${alvo}: último dado é de ${ultimo.data} (${idade} dias). Baixe a planilha nova.` });
  else if (idade > 7) avisos.push({ nivel: "revisar", texto: `Cepea ${alvo}: último dado é de ${ultimo.data} (${idade} dias). Baixe a planilha nova.` });
  for (let i = Math.max(1, dias.length - 30); i < dias.length; i++) {
    if (!(dias[i].valor > 0)) avisos.push({ nivel: "bloqueia", texto: `Cepea ${alvo}: valor inválido em ${dias[i].data}.` });
    const salto = dias[i].valor / dias[i - 1].valor - 1;
    if (Math.abs(salto) > 0.07)
      avisos.push({ nivel: "revisar", texto: `Cepea ${alvo}: salto de ${pct(salto)} em ${dias[i].data} (${dias[i - 1].valor} → ${dias[i].valor}). Confira no site.` });
  }
}
for (const [arq, maxDias] of [["bcb/selic-mensal.json", 45], ["bcb/igp-di.json", 75], ["ibge/abate-bovinos-mensal.json", 200]] as const) {
  const r = lerRaw(arq);
  const idade = diasEntre(r.coletadoEm.slice(0, 10), hoje);
  if (idade > 8) avisos.push({ nivel: "revisar", texto: `${r.fonte}: coleta falhou esta semana (última em ${r.coletadoEm.slice(0, 10)}).` });
  const ultimo = r.dados.at(-1);
  const ref = ultimo.data ?? `${ultimo.mes}-01`;
  if (diasEntre(ref, hoje) > maxDias) avisos.push({ nivel: "revisar", texto: `${r.fonte}: último dado é de ${ref}, mais antigo que o normal.` });
}
const bloqueado = avisos.some((a) => a.nivel === "bloqueia");

// ---------- 2. Previsão da semana (registrada uma única vez) ----------
const serie = montarSerie();
const iUlt = serie.length - 1;
const dataBase = ALVOS.map((a) => diarios[a].at(-1)!.data).sort()[0];
const semana = semanaIso(dataBase);
const arqPrev = new URL(`${semana}.json`, PREVISOES);
mkdirSync(PREVISOES, { recursive: true });
let registrouAgora = false;

if (!bloqueado && !existsSync(arqPrev)) {
  const segunda = segundaDa(dataBase);
  const previsoes = [];
  for (const alvo of ALVOS) {
    const base = mediaDaSemana(diarios[alvo], segunda)!;
    for (const h of HORIZONTES) {
      const modelo = treinarCalibrado(serie, alvo, h.meses, serie[iUlt].mes);
      const p = prever(modelo, serie, iUlt)!;
      const fator = (v: number) => v / p.base; // o modelo prevê variação; aplicamos sobre a média da semana
      previsoes.push({
        alvo, semanas: h.semanas,
        semanaAlvo: semanaIso(somarDias(segunda, 7 * h.semanas)),
        segundaAlvo: somarDias(segunda, 7 * h.semanas),
        base, previsto: base * fator(p.previsto), minimo: base * fator(p.minimo), maximo: base * fator(p.maximo),
        contribuicoes: p.contribuicoes,
        modelo: { nomes: modelo.nomes, pesos: modelo.pesos, amostras: modelo.amostras },
      });
    }
  }
  const fase = lerFasePreco(serie, iUlt, LIMIAR_CICLO);
  writeFileSync(arqPrev, JSON.stringify({
    semana, dataBase, registradoEm: new Date().toISOString(),
    avisos, fase, femeas: serie[iUlt].femeas, relacaoTroca: serie[iUlt].rt, previsoes,
  }, null, 1) + "\n");
  registrouAgora = true;
}

// ---------- 3. Comparação das previsões vencidas ----------
type Avaliacao = { semana: string; alvo: Alvo; semanas: number; previsto: number; real: number; erro: number; dentro: boolean; direcaoCerta: boolean };
const avaliacoes: Avaliacao[] = [];
const ultimaSegundaCompleta = somarDias(segundaDa(dataBase), diarios.boi.at(-1)!.data >= somarDias(segundaDa(dataBase), 4) ? 0 : -7);
for (const arq of readdirSync(PREVISOES).filter((f) => f.endsWith(".json")).sort()) {
  const reg = JSON.parse(readFileSync(new URL(arq, PREVISOES), "utf8"));
  for (const p of reg.previsoes) {
    if (p.segundaAlvo > ultimaSegundaCompleta) continue;
    const real = mediaDaSemana(diarios[p.alvo as Alvo], p.segundaAlvo);
    if (real == null) continue;
    avaliacoes.push({
      semana: reg.semana, alvo: p.alvo, semanas: p.semanas, previsto: p.previsto, real,
      erro: p.previsto / real - 1, dentro: real >= p.minimo && real <= p.maximo,
      direcaoCerta: Math.sign(p.previsto - p.base) === Math.sign(real - p.base),
    });
  }
}
writeFileSync(new URL("avaliacoes.json", DATA), JSON.stringify({ atualizadoEm: new Date().toISOString(), avaliacoes }, null, 1) + "\n");

// ---------- 4. Relatório (vira a issue semanal e o e-mail) ----------
const atual = existsSync(arqPrev) ? JSON.parse(readFileSync(arqPrev, "utf8")) : null;
const pivos = pivosDePreco(serie, LIMIAR_CICLO);
const subidas = pivos.flatMap((p, k) => (p.tipo === "vale" && pivos[k + 1] ? [diasEntre(`${p.mes}-01`, `${pivos[k + 1].mes}-01`) / 30.44] : []));
const l: string[] = [];
l.push(`# Bússola do Ciclo — semana ${semana}`, "");
if (bloqueado) l.push("> ⛔ **Previsão desta semana NÃO foi registrada** por problema nos dados (veja abaixo).", "");
else if (!registrouAgora) l.push("> A previsão desta semana já tinha sido registrada; nada foi alterado.", "");
if (avisos.length) {
  l.push("## Precisa da sua atenção", ...avisos.map((a) => `- ${a.nivel === "bloqueia" ? "⛔" : "⚠️"} ${a.texto}`), "");
}
const f = lerFasePreco(serie, iUlt, LIMIAR_CICLO);
l.push("## Onde estamos no ciclo");
l.push(`- Preço do boi **${f.sobe ? "subindo" : "caindo"}** desde o ${f.ultimoPivo?.tipo} de ${f.ultimoPivo?.mes} (há ${f.mesesDesdePivo} meses).`);
if (f.sobe && subidas.length)
  l.push(`- Subidas anteriores duraram de ${Math.round(Math.min(...subidas))} a ${Math.round(Math.max(...subidas))} meses (média ${Math.round(subidas.reduce((a, b) => a + b) / subidas.length)}).`);
if (f.realVsPicoAnterior) l.push(`- Boi, descontada a inflação, está em ${pct(f.realVsPicoAnterior)} do último pico.`);
if (serie[iUlt].femeas) l.push(`- Contexto: fêmeas no abate (média 12 meses) ${pct(serie[iUlt].femeas!)}.`);
l.push(`- Relação de troca: 1 boi de 18@ compra **${serie[iUlt].rt!.toFixed(2).replace(".", ",")}** bezerros.`, "");
if (atual) {
  l.push(`## Previsão registrada (base: semana de ${segundaDa(atual.dataBase)})`, "| | em | previsto | faixa provável |", "|---|---|---|---|");
  for (const p of atual.previsoes)
    l.push(`| ${p.alvo === "boi" ? "Boi gordo (R$/@)" : "Bezerro MS (R$/cab)"} | ${p.semanas} semanas | ${brl(p.previsto)} | ${brl(p.minimo)} – ${brl(p.maximo)} |`);
  l.push("");
}
const recentes = avaliacoes.filter((a) => a.semana >= semanaIso(somarDias(hoje, -7 * 60)));
if (recentes.length) {
  l.push("## Como o modelo está acertando (previsões já vencidas)", "| | em | previsões | erro médio | dentro da faixa | direção certa |", "|---|---|---|---|---|---|");
  for (const alvo of ALVOS)
    for (const h of HORIZONTES) {
      const g = recentes.filter((a) => a.alvo === alvo && a.semanas === h.semanas);
      if (!g.length) continue;
      const m = (fn: (a: Avaliacao) => number) => g.reduce((s, a) => s + fn(a), 0) / g.length;
      l.push(`| ${alvo} | ${h.semanas} sem | ${g.length} | ${pct(m((a) => Math.abs(a.erro)))} | ${pct(m((a) => +a.dentro))} | ${pct(m((a) => +a.direcaoCerta))} |`);
    }
  l.push("");
} else l.push("_Ainda não há previsões vencidas para comparar. A primeira comparação sai em 4 semanas._", "");
l.push("---", "Simulação estatística com dados públicos (Cepea CC BY-NC 4.0, IBGE, Banco Central). Não é recomendação de investimento.");
mkdirSync(new URL("semanal/", DATA), { recursive: true });
writeFileSync(new URL("semanal/relatorio.md", DATA), l.join("\n") + "\n");
console.log(l.join("\n"));
