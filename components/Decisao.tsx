"use client";

import { useEffect, useMemo, useState } from "react";
import { cenarios } from "@/lib/cenarios";
import { distanciaKm, fretePorCabeca, ufDaPraca, UFS, FATOR_ESTRADA, KM_DENTRO_DO_ESTADO } from "@/lib/frete";
import { numero, reais } from "@/lib/formato";
import { calcular, custoArroba, NOME_ESTRUTURA, NOME_PARTE, type Entradas, type Estrutura, type Partes, type Selo } from "@/lib/margem";
import type { CategoriaReposicao, Painel } from "@/lib/painel";
import { descreverEstagio } from "@/lib/veredito";
import { entradaDoPainel } from "@/lib/entrada";

// O Consultor grava aqui o perfil que a pessoa informou (usado só para lembrar a estrutura preferida).
export const CHAVE_PERFIL = "bussola:perfil";
const CHAVE_ESTADO = "bussola:calculadora";

const ESTRUTURAS: { id: Estrutura; quem: string }[] = [
  { id: "recria", quem: "Compro bezerro ou garrote, engordo no pasto e vendo boi gordo" },
  { id: "confinamento", quem: "Compro boi magro toda semana e termino no cocho" },
  { id: "cria", quem: "Tenho matrizes e vendo bezerro" },
  { id: "revenda", quem: "Compro boi gordo onde está mais barato e vendo onde paga mais" },
];

const ROTULO_SELO: Record<Selo, string> = { compensa: "Compensa", apertada: "Margem apertada", nao: "Não compensa" };
const COR_SELO: Record<Selo, string> = {
  compensa: "border-capim/60 bg-capim/10 text-capim",
  apertada: "border-sol/60 bg-sol/10 text-sol",
  nao: "border-alerta/60 bg-alerta/10 text-alerta",
};

// Valores de partida: preços vêm dos dados; o resto é exemplo para a pessoa trocar pelos da sua fazenda.
function padrao(estrutura: Estrutura, p: Painel): Entradas {
  const base: Entradas = {
    estrutura, compraCab: p.hoje.bezerro, pesoCompra: 240, pesoVenda: 510, gmd: 0.6, custoDia: 4.5, rendimento: 52,
    vendaArroba: p.hoje.boi, mortalidade: 1.5, taxaDesmama: 70, custoMatrizAno: 1000, valorMatriz: Math.round(p.hoje.bezerro),
    vendaBezerro: p.hoje.bezerro, vendaCab: Math.round(18 * p.hoje.boi), diasRevenda: 7, quebra: 1, frete: 0, juros: p.selic.valor,
  };
  if (estrutura === "confinamento")
    return { ...base, compraCab: Math.round(12.5 * p.hoje.boi), pesoCompra: 375, pesoVenda: 540, gmd: 1.5, custoDia: 18 };
  if (estrutura === "revenda") return { ...base, compraCab: Math.round(18 * p.hoje.boi), pesoCompra: 540, pesoVenda: 540 };
  return base;
}

function Num({ rotulo, valor, onChange, unidade, passo = 1, faixa, dica }: { rotulo: string; valor: number; onChange: (v: number) => void; unidade?: string; passo?: number; faixa?: [number, number]; dica?: string }) {
  return (
    <label className="block">
      <span className="block text-sm text-zinc-300">{rotulo}</span>
      <span className="relative mt-1 block">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={passo}
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(0, +e.target.value))}
        className="h-11 w-full rounded-lg border border-terra-700 bg-terra-950 pl-3 text-base tabular-nums text-zinc-50"
        style={{ paddingRight: unidade ? `${unidade.length * 0.5 + 1.25}rem` : undefined }}
      />
      {unidade && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400">{unidade}</span>}
      </span>
      {faixa && (
        <input
          type="range"
          aria-label={`${rotulo} (ajuste rápido)`}
          min={faixa[0]}
          max={faixa[1]}
          step={passo}
          value={Math.min(faixa[1], Math.max(faixa[0], valor))}
          onChange={(e) => onChange(+e.target.value)}
          className="mt-1 w-full accent-[var(--color-sol)]"
        />
      )}
      {dica && <span className="mt-0.5 block text-xs text-zinc-400">{dica}</span>}
    </label>
  );
}

const CATEGORIA_PADRAO: Record<Estrutura, CategoriaReposicao> = { recria: "bezerro", confinamento: "boiMagro", cria: "desmama", revenda: "boiMagro" };

const faixaDe = (v: number): [number, number] => [Math.round(v * 0.5), Math.round(v * 1.6)];

function lerChaveOr(): string {
  try {
    return JSON.parse(localStorage.getItem("bussola:openrouter") ?? "{}").chave ?? "";
  } catch {
    return "";
  }
}

export function Decisao({ painel }: { painel: Painel }) {
  const [estrutura, setEstrutura] = useState<Estrutura>("recria");
  const [e, setE] = useState<Entradas>(() => padrao("recria", painel));
  const [ufFazenda, setUfFazenda] = useState("SP");
  const [ufCompra, setUfCompra] = useState("");
  const [pracaVenda, setPracaVenda] = useState("");
  const [rsKm, setRsKm] = useState(7);
  const [cargaKg, setCargaKg] = useState(24000);
  const [freteManual, setFreteManual] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<CategoriaReposicao>("bezerro");
  const [explicacao, setExplicacao] = useState<{ texto: string; para: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_ESTADO) ?? "{}");
      if (s.ufFazenda && UFS.includes(s.ufFazenda)) setUfFazenda(s.ufFazenda);
      if (["recria", "confinamento", "cria", "revenda"].includes(s.estrutura)) escolher(s.estrutura);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lembrar = (est: Estrutura, uf: string) => {
    try {
      localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ estrutura: est, ufFazenda: uf }));
    } catch {}
  };
  function escolher(est: Estrutura) {
    setEstrutura(est);
    setE(padrao(est, painel));
    setCategoria(CATEGORIA_PADRAO[est]);
    setFreteManual(null);
    setExplicacao(null);
    lembrar(est, ufFazenda);
  }
  const mudar = <K extends keyof Entradas>(k: K, v: Entradas[K]) => setE((x) => ({ ...x, [k]: v }));

  // Praças de boi gordo (Scot): média por estado
  const porUf = useMemo(() => {
    const g: Record<string, number[]> = {};
    for (const [n, p] of Object.entries(painel.pracas?.valores ?? {})) if (p.vista) (g[ufDaPraca(n)] ??= []).push(p.vista);
    return Object.fromEntries(Object.entries(g).map(([uf, v]) => [uf, v.reduce((a, b) => a + b, 0) / v.length]));
  }, [painel]);
  const ufsComPreco = Object.keys(porUf);
  const maisPerto = ufsComPreco.length ? [...ufsComPreco].sort((a, b) => distanciaKm(ufFazenda, a) - distanciaKm(ufFazenda, b))[0] : null;
  const ufPreco = porUf[ufFazenda] ? ufFazenda : maisPerto;
  // Reposição (Scot): preço por estado da categoria escolhida
  const rep = painel.reposicao;
  const cat = rep?.categorias[categoria];
  const ufsRep = Object.keys(cat?.ufs ?? {});
  const ufRep = cat ? (cat.ufs[ufFazenda] ? ufFazenda : [...ufsRep].sort((a, b) => distanciaKm(ufFazenda, a) - distanciaKm(ufFazenda, b))[0]) : null;
  const usaReposicao = estrutura !== "revenda" && Boolean(cat && ufRep);

  const ufVenda = pracaVenda ? ufDaPraca(pracaVenda) : ufFazenda;
  const kmCompra = ufCompra ? distanciaKm(ufCompra, ufFazenda) : 0;
  const kmVenda = distanciaKm(ufFazenda, ufVenda);
  const freteEstimado =
    estrutura === "cria"
      ? 0
      : estrutura === "revenda"
        ? Math.round(fretePorCabeca(distanciaKm(ufCompra || ufFazenda, ufVenda), rsKm, e.pesoVenda, cargaKg))
        : Math.round(fretePorCabeca(kmCompra, rsKm, e.pesoCompra, cargaKg) * (ufCompra ? 1 : 0) + fretePorCabeca(kmVenda, rsKm, e.pesoVenda, cargaKg));
  const entradas: Entradas = { ...e, estrutura, frete: estrutura === "cria" ? 0 : (freteManual ?? freteEstimado) };

  const r = calcular(entradas);
  const cen = cenarios(entradas, painel, r.dias);
  const snapshot = JSON.stringify(entradas);
  const desatualizada = explicacao && explicacao.para !== snapshot;

  // Uma frase pronta, calculada na hora, dizendo por que compensa ou não.
  const unidadeEmpate = estrutura === "cria" ? "por bezerro" : estrutura === "revenda" ? "por cabeça" : "por arroba";
  const precoAtual = estrutura === "cria" ? e.vendaBezerro : estrutura === "revenda" ? e.vendaCab : e.vendaArroba;
  const maior = Object.entries(r.partes).sort((a, b) => b[1] - a[1])[0] as [keyof Partes, number];
  const porque =
    r.selo === "nao"
      ? `Cada ${estrutura === "cria" ? "matriz perde" : "cabeça perde"} ${reais(-r.margem)}. Pesa mais ${NOME_PARTE[maior[0]]}: ${reais(maior[1])}, ${numero((maior[1] / Math.max(1, r.receita)) * 100, 0)}% do que entra. Para empatar, o preço de venda teria de ser ${reais(r.empateVenda)} ${unidadeEmpate} (hoje ${reais(precoAtual)})${Number.isFinite(r.tetoCompra) && estrutura !== "revenda" ? `, ou o animal ser comprado por no máximo ${reais(Math.max(0, r.tetoCompra))}` : ""}.`
      : r.selo === "apertada"
        ? `Sobram ${reais(r.margem)} por ${estrutura === "cria" ? "matriz" : "cabeça"} (${numero(r.retorno * 100, 1)}% sobre o dinheiro parado). Já descontados os juros, mas qualquer queda de preço zera a margem: o empate é ${reais(r.empateVenda)} ${unidadeEmpate}.`
        : `Sobram ${reais(r.margem)} por ${estrutura === "cria" ? "matriz" : "cabeça"}, ${numero(r.retorno * 100, 1)}% sobre o dinheiro parado, já descontados os juros. O preço de venda pode cair até ${reais(r.empateVenda)} ${unidadeEmpate} antes de zerar.`;

  // Onde vender (boi gordo, líquido de frete) — para quem engorda
  const arrobasCab = (e.pesoVenda * (e.rendimento / 100)) / 15;
  const vender = Object.entries(painel.pracas?.valores ?? {})
    .filter(([, p]) => p.vista)
    .map(([nome, p]) => {
      const fr = fretePorCabeca(distanciaKm(ufFazenda, ufDaPraca(nome)), rsKm, e.pesoVenda, cargaKg) / Math.max(1, arrobasCab);
      return { nome, bruto: p.vista!, frete: fr, liquido: p.vista! - fr };
    })
    .sort((a, b) => b.liquido - a.liquido);

  // Revenda: melhor par de estados (compra no mais barato, vende onde paga mais), líquido de frete e quebra
  const pares = useMemo(() => {
    const out: { de: string; para: string; compra: number; venda: number; frete: number; sobra: number }[] = [];
    const ufs = Object.keys(porUf);
    for (const de of ufs)
      for (const para of ufs) {
        if (de === para) continue;
        const compra = 18 * porUf[de], venda = 18 * porUf[para];
        const frete = fretePorCabeca(distanciaKm(de, para), rsKm, 540, cargaKg);
        out.push({ de, para, compra, venda, frete, sobra: venda * (1 - e.quebra / 100) - compra - frete });
      }
    return out.sort((a, b) => b.sobra - a.sobra).slice(0, 6);
  }, [porUf, rsKm, cargaKg, e.quebra]);

  const escolherPraca = (nome: string) => {
    setPracaVenda(nome);
    setExplicacao(null);
    const v = nome ? painel.pracas?.valores[nome]?.vista : null;
    if (!v) return;
    if (estrutura === "revenda") mudar("vendaCab", Math.round(18 * v));
    else mudar("vendaArroba", v);
  };

  const aplicarRegiao = () => {
    const v = ufPreco ? Math.round(porUf[ufPreco] * 10) / 10 : null;
    const animal = usaReposicao ? cat!.ufs[ufRep!].cab : null;
    setE((x) => {
      if (estrutura === "revenda") return v ? { ...x, compraCab: Math.round(18 * v) } : x;
      if (estrutura === "cria") return animal ? { ...x, vendaBezerro: animal } : x;
      return { ...x, ...(v ? { vendaArroba: v } : {}), ...(animal ? { compraCab: animal, pesoCompra: cat!.peso } : {}) };
    });
    setPracaVenda("");
    setExplicacao(null);
  };

  const escolherCategoria = (c: CategoriaReposicao) => {
    setCategoria(c);
    setExplicacao(null);
    const k = rep?.categorias[c];
    const uf = k ? (k.ufs[ufFazenda] ? ufFazenda : Object.keys(k.ufs).sort((a, b) => distanciaKm(ufFazenda, a) - distanciaKm(ufFazenda, b))[0]) : null;
    if (!k || !uf) return;
    if (estrutura === "cria") mudar("vendaBezerro", k.ufs[uf].cab);
    else setE((x) => ({ ...x, compraCab: k.ufs[uf].cab, pesoCompra: k.peso }));
  };

  // Onde comprar (recria/confinamento): preço do animal + frete até a fazenda. Cria: onde vender, preço − frete.
  const mercadoAnimal = cat
    ? Object.entries(cat.ufs)
        .map(([uf, v]) => {
          const fr = fretePorCabeca(distanciaKm(uf, ufFazenda), rsKm, cat.peso, cargaKg);
          return { uf, cab: v.cab, marcado: v.marcado, frete: fr, total: estrutura === "cria" ? v.cab - fr : v.cab + fr };
        })
        .sort((a, b) => (estrutura === "cria" ? b.total - a.total : a.total - b.total))
    : [];

  async function explicar() {
    setCarregando(true);
    setErro("");
    try {
      const chave = lerChaveOr();
      const resp = await fetch("/api/explicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(chave ? { "x-openrouter-key": chave } : {}) },
        body: JSON.stringify({ entradas }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j.erro ?? `Erro ${resp.status}`);
      setExplicacao({ texto: String(j.texto).replace(/R\$ /g, "R$\u00a0"), para: snapshot }); // "R$" não se separa do número
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const receita = Math.max(1, r.receita);
  const barras: { chave: keyof Partes; cor: string }[] = [
    { chave: "compra", cor: "bg-zinc-400" },
    { chave: "operacao", cor: "bg-sol" },
    { chave: "frete", cor: "bg-sky-400" },
    { chave: "juros", cor: "bg-violet-400" },
    { chave: "perdas", cor: "bg-alerta" },
  ];
  const barrasUsadas = barras.filter((b) => r.partes[b.chave] > 0);
  const custoTotal = Object.values(r.partes).reduce((a, b) => a + b, 0);
  const qtd = estrutura === "cria" ? "matriz/ano" : "cabeça";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
        <fieldset>
          <legend className="text-sm font-medium text-zinc-200">1. Como você trabalha?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ESTRUTURAS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={estrutura === s.id}
                onClick={() => escolher(s.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${estrutura === s.id ? "border-sol bg-sol/10" : "border-terra-700 bg-terra-900 hover:border-zinc-500"}`}
              >
                <span className="block font-medium text-zinc-50">{NOME_ESTRUTURA[s.id]}</span>
                <span className="mt-0.5 block text-xs text-zinc-400">{s.quem}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
          <h3 className="font-display text-lg text-zinc-50">2. Onde fica e para onde vai</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              Estado da sua fazenda
              <select
                value={ufFazenda}
                onChange={(ev) => {
                  setUfFazenda(ev.target.value);
                  lembrar(estrutura, ev.target.value);
                }}
                className="mt-1 h-11 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 text-base"
              >
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            {estrutura !== "cria" && (
              <label className="block text-sm text-zinc-300">
                {estrutura === "revenda" ? "Comprar em (estado)" : "Comprar animais de (estado)"}
                <select value={ufCompra} onChange={(ev) => setUfCompra(ev.target.value)} className="mt-1 h-11 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 text-base">
                  <option value="">{estrutura === "revenda" ? `No meu estado (${ufFazenda})` : "Do meu estado, sem frete de compra"}</option>
                  {UFS.filter((u) => estrutura === "revenda" || u !== ufFazenda).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            )}
            {estrutura !== "cria" && (
              <label className="block text-sm text-zinc-300 sm:col-span-2">
                {estrutura === "revenda" ? "Vender em" : "Vender o boi gordo em"}
                <select value={pracaVenda} onChange={(ev) => escolherPraca(ev.target.value)} className="mt-1 h-11 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 text-base">
                  <option value="">Na minha região ({ufFazenda})</option>
                  {vender.map((v) => (
                    <option key={v.nome} value={v.nome}>
                      {v.nome} — {reais(v.bruto)}/@
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {(ufPreco || usaReposicao) && (
            <div className="mt-4 rounded-xl border border-sol/40 bg-sol/5 p-3">
              {usaReposicao && (
                <label className="block text-sm text-zinc-300">
                  {estrutura === "cria" ? "Animal que você vende" : "Animal que você compra"}
                  <select value={categoria} onChange={(ev) => escolherCategoria(ev.target.value as CategoriaReposicao)} className="mt-1 h-11 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 text-base">
                    {(Object.keys(rep!.categorias) as CategoriaReposicao[]).map((c) => (
                      <option key={c} value={c}>
                        {rep!.categorias[c].nome} ({rep!.categorias[c].ref})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" onClick={aplicarRegiao} className="mt-3 h-11 w-full rounded-lg bg-sol px-4 text-base font-semibold text-terra-950 hover:brightness-110 sm:w-auto">
                Usar preços de {usaReposicao && ufRep !== ufPreco && estrutura !== "cria" ? `${ufRep} e ${ufPreco}` : usaReposicao ? ufRep : ufPreco}
              </button>
              <ul className="mt-2 space-y-0.5 text-sm text-zinc-300">
                {usaReposicao && (
                  <li>
                    {cat!.nome} em {ufRep}: <strong className="text-zinc-50">{reais(cat!.ufs[ufRep!].cab)}</strong> por cabeça ({reais(cat!.ufs[ufRep!].kg, 2)}/kg)
                    {ufRep !== ufFazenda && <span className="text-zinc-400"> · {ufFazenda} não tem cotação, usamos o estado mais perto</span>}
                  </li>
                )}
                {ufPreco && estrutura !== "cria" && (
                  <li>
                    Boi gordo em {ufPreco}: <strong className="text-zinc-50">{reais(porUf[ufPreco], 2)}/@</strong> à vista
                    {ufPreco !== ufFazenda && <span className="text-zinc-400"> · estado com cotação mais perto</span>}
                  </li>
                )}
              </ul>
              <p className="mt-1 text-xs text-zinc-400">
                Fonte: Scot Consultoria{rep ? ` (reposição de ${rep.data.split("-").reverse().join("/")}, via Notícias Agrícolas)` : ""}; boi gordo de {painel.pracas?.data.split("-").reverse().join("/")}. É o preço médio do estado; o seu negócio pode sair diferente.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
          <h3 className="font-display text-lg text-zinc-50">3. Os números do seu negócio</h3>
          <p className="mt-1 text-xs text-zinc-400">Preços de hoje vêm dos dados. O resto é só exemplo: troque pelos da sua fazenda, tudo muda o resultado na hora.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(estrutura === "recria" || estrutura === "confinamento") && (
              <>
                <Num rotulo="Preço pago por animal" unidade="R$/cabeça" passo={50} valor={e.compraCab} onChange={(v) => mudar("compraCab", v)} faixa={faixaDe(padrao(estrutura, painel).compraCab)} dica={estrutura === "recria" ? `Bezerro MS (Cepea): ${reais(painel.hoje.bezerro)}. Use o botão de região para o preço do seu estado.` : "Exemplo: 12,5 arrobas × preço da arroba. Use o botão de região para o preço do boi magro."} />
                <Num rotulo="Preço de venda do boi gordo" unidade="R$/@" passo={1} valor={e.vendaArroba} onChange={(v) => mudar("vendaArroba", v)} faixa={faixaDe(painel.hoje.boi)} dica={`Cepea hoje: ${reais(painel.hoje.boi, 2)}`} />
                <Num rotulo="Peso na compra" unidade="kg vivo" passo={5} valor={e.pesoCompra} onChange={(v) => mudar("pesoCompra", v)} />
                <Num rotulo="Peso na venda" unidade="kg vivo" passo={5} valor={e.pesoVenda} onChange={(v) => mudar("pesoVenda", v)} />
                <Num rotulo="Ganho de peso por dia" unidade="kg/dia" passo={0.05} valor={e.gmd} onChange={(v) => mudar("gmd", v)} faixa={[0.2, 2]} />
                <Num rotulo="Custo por animal por dia" unidade="R$/dia" passo={0.5} valor={e.custoDia} onChange={(v) => mudar("custoDia", v)} faixa={[2, 40]} dica="Comida, sal, mão de obra, vacina" />
                <Num rotulo="Rendimento de carcaça" unidade="%" passo={0.5} valor={e.rendimento} onChange={(v) => mudar("rendimento", v)} />
                <Num rotulo="Animais que se perdem" unidade="%" passo={0.5} valor={e.mortalidade} onChange={(v) => mudar("mortalidade", v)} />
              </>
            )}
            {estrutura === "cria" && (
              <>
                <Num rotulo="Preço do bezerro vendido" unidade="R$/cabeça" passo={50} valor={e.vendaBezerro} onChange={(v) => mudar("vendaBezerro", v)} faixa={faixaDe(painel.hoje.bezerro)} dica={`Bezerro MS (Cepea): ${reais(painel.hoje.bezerro)}`} />
                <Num rotulo="Bezerros desmamados por matriz" unidade="% ao ano" passo={1} valor={e.taxaDesmama} onChange={(v) => mudar("taxaDesmama", v)} faixa={[30, 100]} />
                <Num rotulo="Custo de manter uma matriz" unidade="R$/ano" passo={50} valor={e.custoMatrizAno} onChange={(v) => mudar("custoMatrizAno", v)} faixa={[300, 3000]} dica="Pasto, sal, vacina, mão de obra" />
                <Num rotulo="Valor da matriz" unidade="R$" passo={100} valor={e.valorMatriz} onChange={(v) => mudar("valorMatriz", v)} dica="Dinheiro parado na vaca" />
              </>
            )}
            {estrutura === "revenda" && (
              <>
                <Num rotulo="Preço de compra" unidade="R$/cabeça de 18@" passo={50} valor={e.compraCab} onChange={(v) => mudar("compraCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} />
                <Num rotulo="Preço de venda" unidade="R$/cabeça de 18@" passo={50} valor={e.vendaCab} onChange={(v) => mudar("vendaCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} />
                <Num rotulo="Dias até vender" unidade="dias" valor={e.diasRevenda} onChange={(v) => mudar("diasRevenda", v)} />
                <Num rotulo="Perda no transporte" unidade="%" passo={0.5} valor={e.quebra} onChange={(v) => mudar("quebra", v)} dica="Quebra de peso e mortes" />
              </>
            )}
            <Num rotulo="Custo do dinheiro" unidade="% ao ano" passo={0.5} valor={e.juros} onChange={(v) => mudar("juros", v)} dica={`Selic hoje: ${numero(painel.selic.valor)}% (Banco Central)`} />
          </div>

          {estrutura !== "cria" && (
            <div className="mt-5 border-t border-terra-700 pt-4">
              <p className="text-sm font-medium text-zinc-200">Frete (estimado pela distância)</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Num rotulo="Preço do frete" unidade="R$ por km rodado" passo={0.5} valor={rsKm} onChange={setRsKm} dica="Exemplo: pergunte ao seu transportador" />
                <Num rotulo="Carga do caminhão" unidade="kg" passo={500} valor={cargaKg} onChange={setCargaKg} dica="Exemplo: carreta boiadeira" />
              </div>
              {(
                <p className="mt-3 text-sm text-zinc-300">
                  Frete por cabeça: <strong className="text-zinc-50">{reais(entradas.frete)}</strong>
                  {freteManual == null ? " (estimado)" : " (digitado)"}
                  <span className="mt-1 block text-xs text-zinc-400">
                    {estrutura === "revenda" ? `Viagem: ${numero(distanciaKm(ufCompra || ufFazenda, ufVenda), 0)} km.` : `Compra: ${ufCompra ? `${numero(kmCompra, 0)} km` : "sem frete"} · Venda: ${numero(kmVenda, 0)} km.`} Distância em linha reta entre as capitais × {FATOR_ESTRADA} para a estrada; dentro do mesmo estado, {KM_DENTRO_DO_ESTADO} km. É estimativa.
                  </span>
                </p>
              )}
              {(
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div className="w-full max-w-60">
                    <Num rotulo="Ou digite o frete" unidade="R$/cabeça" passo={5} valor={freteManual ?? freteEstimado} onChange={setFreteManual} />
                  </div>
                  {freteManual != null && (
                    <button type="button" onClick={() => setFreteManual(null)} className="mb-2 text-sm text-sol underline underline-offset-4">
                      Voltar ao estimado
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <article className="rounded-2xl border border-terra-700 bg-terra-900 p-4 sm:p-5" aria-live="polite">
          <p className="text-xs uppercase tracking-wider text-zinc-400">
            Resultado · {NOME_ESTRUTURA[estrutura]} · por {qtd}
          </p>
          <p className={`mt-2 inline-block rounded-full border px-4 py-1.5 font-display text-xl font-bold ${COR_SELO[r.selo]}`}>{ROTULO_SELO[r.selo]}</p>
          <dl className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-3 overflow-hidden rounded-xl border border-terra-700 bg-terra-700 text-center">
            {[
              { t: estrutura === "cria" ? "Sobra por matriz/ano" : "Sobra por cabeça", v: reais(r.margem), cor: r.margem >= 0 ? "text-capim" : "text-alerta" },
              { t: "Por mês", v: reais(r.margemMes), cor: r.margemMes >= 0 ? "text-capim" : "text-alerta" },
              { t: estrutura === "cria" ? "Prazo" : "Dias no negócio", v: numero(r.dias, 0), cor: "text-zinc-50" },
            ].map((x, i) => (
              <div key={x.t} className={`bg-terra-900 p-3 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
                <dt className="text-xs text-zinc-400">{x.t}</dt>
                <dd className={`mt-1 whitespace-nowrap font-display font-bold tabular-nums ${i === 0 ? "text-2xl sm:text-xl" : "text-lg sm:text-xl"} ${x.cor}`}>{x.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-xl border-2 border-sol/50 bg-sol/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-sol">{r.selo === "nao" ? "Por que não compensa" : r.selo === "apertada" ? "Por que está apertado" : "Por que compensa"}</p>
            <p className="mt-1 text-base leading-relaxed text-zinc-50">{porque}</p>
          </div>

          <div className="mt-4">
            <p className="text-sm text-zinc-300">
              Para cada {reais(receita)} que entram, {reais(custoTotal)} saem:
            </p>
            <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-terra-950" role="img" aria-label="Divisão dos custos">
              {barrasUsadas.map((b) => (
                <div key={b.chave} className={b.cor} style={{ width: `${Math.min(100, (r.partes[b.chave] / Math.max(receita, custoTotal)) * 100)}%` }} title={`${NOME_PARTE[b.chave]}: ${reais(r.partes[b.chave])}`} />
              ))}
            </div>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-zinc-300 sm:grid-cols-2">
              {barrasUsadas.map((b) => (
                <li key={b.chave} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${b.cor}`} aria-hidden />
                  <span className="flex-1 whitespace-nowrap">{b.chave === "compra" ? "Animal" : b.chave === "operacao" ? "Custo diário" : b.chave === "frete" ? "Frete" : b.chave === "juros" ? "Juros" : "Perdas"}</span>
                  <span className="tabular-nums text-zinc-50">{reais(r.partes[b.chave])}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-terra-700 bg-terra-900 p-4 sm:p-5">
          <h3 className="font-display text-lg text-zinc-50">E se o preço de venda mudar?</h3>
          <p className="mt-1 text-sm text-zinc-300">{descreverEstagio(entradaDoPainel(painel))}</p>
          {cen ? (
            <>
              <p className="mt-3 text-xs text-zinc-400">Previsão registrada para {cen.semanas} semanas, faixa de 80% (perto do prazo da operação). O seu preço de venda é movido na mesma proporção.</p>
              <ul className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { t: "Preço no mínimo", x: cen.pior },
                  { t: "Esperado", x: cen.esperado },
                  { t: "Preço no máximo", x: cen.melhor },
                ].map(({ t, x }) => (
                  <li key={t} className="flex flex-col justify-between rounded-lg bg-terra-950 px-1.5 py-2">
                    <span className="block text-xs text-zinc-400">{t}</span>
                    <span className={`mt-0.5 block whitespace-nowrap font-display text-sm font-bold tabular-nums sm:text-base ${x.margem >= 0 ? "text-capim" : "text-alerta"}`}>{reais(x.margem)}</span>
                  </li>
                ))}
              </ul>
              {cen.pior.margem < 0 && r.margem >= 0 && <p className="mt-2 text-sm text-sol">Atenção: se o preço cair ao mínimo da faixa, a conta fica negativa. Vender parte antes ou travar preço na B3 reduz esse risco.</p>}
              {cen.melhor.margem < 0 && <p className="mt-2 text-sm text-alerta">Mesmo com o preço no máximo da faixa, a conta não fecha. O problema está no custo ou no preço pago, não no ciclo.</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Na revenda o preço de venda é o que você combina na hora, por isso não usamos a previsão do modelo.</p>
          )}
        </article>

        <article className="rounded-2xl border border-terra-700 bg-terra-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg text-zinc-50">Explicação da IA</h3>
            <button type="button" onClick={explicar} disabled={carregando} className="h-11 rounded-lg border border-sol/60 px-4 text-sm font-semibold text-sol hover:bg-sol/10 disabled:opacity-50">
              {carregando ? "Pensando…" : explicacao ? "Atualizar explicação" : "Explicar com IA"}
            </button>
          </div>
          {erro && <p className="mt-2 text-sm text-alerta">{erro}</p>}
          {explicacao ? (
            <>
              {desatualizada && <p className="mt-2 text-sm text-sol">Você mudou os números. Clique em &quot;Atualizar explicação&quot;.</p>}
              <p className={`mt-2 whitespace-pre-line text-base leading-relaxed ${desatualizada ? "text-zinc-400" : "text-zinc-50"}`}>{explicacao.texto}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">A conta acima é instantânea. A explicação em texto (IA) só é gerada quando você clica, para não gastar créditos a cada toque.</p>
          )}
        </article>
      </div>

      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">

        {estrutura === "revenda" ? (
          <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-zinc-50">Onde comprar e onde vender</h3>
            <p className="mt-1 text-sm text-zinc-300">Melhores pares de estados para boi gordo de 18@, depois do frete e da perda de {numero(e.quebra, 1)}%. Preço à vista da Scot, média dos estados.</p>
            <ul className="mt-3 divide-y divide-terra-700 text-sm">
              {pares.map((p) => (
                <li key={`${p.de}${p.para}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-28 font-medium text-zinc-50">
                    {p.de} → {p.para}
                  </span>
                  <span className="basis-full text-zinc-300 sm:basis-auto sm:flex-1">
                    compra {reais(p.compra)} · vende {reais(p.venda)} · frete {reais(p.frete)}
                  </span>
                  <span className={`font-display font-bold tabular-nums ${p.sobra >= 0 ? "text-capim" : "text-alerta"}`}>{reais(p.sobra)}/cab</span>
                  <button type="button" onClick={() => {
                    setUfCompra(p.de);
                    setPracaVenda(Object.keys(painel.pracas?.valores ?? {}).find((n) => ufDaPraca(n) === p.para) ?? "");
                    setFreteManual(null);
                    setExplicacao(null);
                    setE((x) => ({ ...x, compraCab: Math.round(p.compra), vendaCab: Math.round(p.venda) }));
                  }} className="h-11 rounded-lg border border-terra-700 px-4 text-sm text-sol hover:bg-sol/10">
                    Usar na conta
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : estrutura !== "cria" ? (
          <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-zinc-50">Onde vender o boi gordo</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Praças da Scot, já descontado o frete saindo de {ufFazenda} (carga de {numero(cargaKg / 1000, 1)} t, {reais(rsKm, 2)}/km). Veja se a diferença de preço paga a viagem.
            </p>
            <ul className="mt-3 divide-y divide-terra-700 text-sm">
              {vender.slice(0, 6).map((v, i) => (
                <li key={v.nome} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="w-5 text-zinc-400">{i + 1}.</span>
                  <span className="min-w-36 flex-1 font-medium text-zinc-50">{v.nome}</span>
                  <span className="text-zinc-300">
                    {reais(v.bruto)} − frete {reais(v.frete, 2)}/@
                  </span>
                  <span className="font-display font-bold tabular-nums text-capim">{reais(v.liquido, 2)}/@</span>
                  <button type="button" onClick={() => { setPracaVenda(v.nome); mudar("vendaArroba", v.bruto); }} className="h-11 rounded-lg border border-terra-700 px-4 text-sm text-sol hover:bg-sol/10">
                    Usar na conta
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {estrutura !== "revenda" && cat && mercadoAnimal.length > 0 && (
          <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-zinc-50">{estrutura === "cria" ? `Onde vender o ${cat.nome.toLowerCase()}` : `Onde comprar o ${cat.nome.toLowerCase()}`}</h3>
            <p className="mt-1 text-sm text-zinc-300">
              {cat.nome} Nelore ({cat.ref}), preço médio de cada estado {estrutura === "cria" ? "menos" : "mais"} o frete {estrutura === "cria" ? "saindo de" : "até"} {ufFazenda}. Como quem enche o caminhão onde compensa mais.
            </p>
            <ul className="mt-3 divide-y divide-terra-700 text-sm">
              {mercadoAnimal.slice(0, 6).map((m, i) => (
                <li key={m.uf} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="w-5 text-zinc-400">{i + 1}.</span>
                  <span className="min-w-12 flex-1 font-medium text-zinc-50">
                    {m.uf}
                    {m.marcado ? "*" : ""}
                  </span>
                  <span className="text-zinc-300">
                    {reais(m.cab)} {estrutura === "cria" ? "−" : "+"} frete {reais(m.frete)}
                  </span>
                  <span className="font-display font-bold tabular-nums text-capim">{reais(m.total)}/cab</span>
                  <button
                    type="button"
                    onClick={() => {
                      setExplicacao(null);
                      if (estrutura === "cria") mudar("vendaBezerro", Math.round(m.total));
                      else {
                        setUfCompra(m.uf === ufFazenda ? "" : m.uf);
                        setE((x) => ({ ...x, compraCab: m.cab, pesoCompra: cat.peso }));
                      }
                    }}
                    className="h-11 rounded-lg border border-terra-700 px-4 text-sm text-sol hover:bg-sol/10"
                  >
                    Usar na conta
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-400">
              Scot Consultoria, {rep!.data.split("-").reverse().join("/")}, via Notícias Agrícolas. {mercadoAnimal.some((m) => m.marcado) ? "A fonte marca RS e SC com * sem explicar o motivo. " : ""}Frete estimado pela distância, como na conta acima.
              {estrutura === "cria" ? " Na conta, o preço líquido (já sem o frete) entra como preço de venda." : ""}
            </p>
          </section>
        )}

        {(estrutura === "recria" || estrutura === "confinamento") && (
          <section className="rounded-2xl border border-terra-700 bg-terra-900/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-zinc-50">Quanto custa produzir 1 arroba?</h3>
            <p className="mt-2 text-base text-zinc-300">
              Com o custo e o ganho de peso acima, cada arroba produzida custa <strong className={custoArroba(e.custoDia, e.gmd) < e.vendaArroba ? "text-capim" : "text-alerta"}>{reais(custoArroba(e.custoDia, e.gmd))}</strong>
              {custoArroba(e.custoDia, e.gmd) < e.vendaArroba ? ", abaixo do preço do boi." : ", acima do preço do boi."}
              <span className="mt-1 block text-xs text-zinc-400">Conta: custo diário ÷ (ganho diário ÷ 15 kg). Só conta comida e operação; o animal comprado, o frete e os juros entram na margem acima.</span>
            </p>
          </section>
        )}
      
      </div>

    </div>
  );
}
