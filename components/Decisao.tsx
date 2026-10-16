"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cenarios } from "@/lib/cenarios";
import { distanciaKm, distanciaLocais, fretePorCabeca, localDaPraca, ufDaPraca, UFS, FATOR_ESTRADA, KM_DENTRO_DO_ESTADO, type Local } from "@/lib/frete";
import { numero, pct, reais } from "@/lib/formato";
import { calcular, custoArroba, NOME_ESTRUTURA, nomeParte, type Entradas, type Estrutura, type Partes, type Selo } from "@/lib/margem";
import type { CategoriaReposicao, Painel } from "@/lib/painel";
import { descreverEstagio } from "@/lib/veredito";
import { entradaDoPainel } from "@/lib/entrada";
import { EVENTO_HISTORICO, gravarHistorico, historicoCsv, lerHistorico, type Registro } from "@/lib/historico";

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
// Campos que não vêm dos dados: enquanto a pessoa não trocar nenhum, a conta é só exemplo e não dá veredito.
const EXEMPLO: Record<Estrutura, { campos: (keyof Entradas)[]; nomes: string }> = {
  recria: { campos: ["pesoVenda", "gmd", "custoDia", "rendimento", "mortalidade"], nomes: "ganho de peso, custo por dia, peso de venda, rendimento e perdas" },
  confinamento: { campos: ["pesoVenda", "gmd", "custoDia", "rendimento", "mortalidade"], nomes: "ganho de peso, custo por dia, peso de venda, rendimento e perdas" },
  cria: { campos: ["taxaDesmama", "custoMatrizAno", "valorMatriz", "descarte", "valorDescarte", "mortalidade"], nomes: "desmama, custo e valor da matriz, descarte e mortes" },
  revenda: { campos: ["compraCab", "vendaCab", "diasRevenda", "quebra"], nomes: "preço de compra e de venda, dias até vender e perda no transporte" },
};

function padrao(estrutura: Estrutura, p: Painel): Entradas {
  const base: Entradas = {
    estrutura, compraCab: p.hoje.bezerro, pesoCompra: 240, pesoVenda: 510, gmd: 0.6, custoDia: 4.5, rendimento: 52,
    vendaArroba: p.hoje.boi, mortalidade: 1.5, taxaDesmama: 70, custoMatrizAno: 1000, valorMatriz: Math.round(15 * p.hoje.boi),
    vendaBezerro: p.hoje.bezerro, descarte: 20, valorDescarte: Math.round(12 * p.hoje.boi),
    vendaCab: Math.round(18 * p.hoje.boi), diasRevenda: 7, quebra: 1, frete: 0, juros: p.selic.valor,
  };
  if (estrutura === "cria") return { ...base, mortalidade: 2 };
  if (estrutura === "confinamento")
    return { ...base, compraCab: Math.round(12.5 * p.hoje.boi), pesoCompra: 375, pesoVenda: 540, gmd: 1.5, custoDia: 18 };
  if (estrutura === "revenda") return { ...base, compraCab: Math.round(18 * p.hoje.boi), pesoCompra: 540, pesoVenda: 540 };
  return base;
}

function Num({ rotulo, valor, onChange, unidade, passo = 1, faixa, dica }: { rotulo: string; valor: number; onChange: (v: number) => void; unidade?: string; passo?: number; faixa?: [number, number]; dica?: string }) {
  return (
    <label className="block">
      <span className="block text-sm text-texto-2">{rotulo}</span>
      <span className="relative mt-1 block">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={passo}
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(0, +e.target.value))}
        className="h-11 w-full rounded-lg border border-linha bg-fundo pl-3 text-base tabular-nums text-texto"
        style={{ paddingRight: unidade ? `${unidade.length * 0.5 + 1.25}rem` : undefined }}
      />
      {unidade && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-texto-3">{unidade}</span>}
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
          className="mt-1 w-full accent-[var(--color-tinta)]"
        />
      )}
      {dica && <span className="mt-0.5 block text-xs text-texto-3">{dica}</span>}
    </label>
  );
}

// Campos que ficam atrás de "Mostrar mais": mudam pouco de um mês para outro.
const AVANCADOS: Record<Estrutura, { campos: (keyof Entradas)[]; nomes: string }> = {
  recria: { campos: ["pesoCompra", "pesoVenda", "rendimento", "mortalidade", "juros"], nomes: "Pesos, rendimento, perdas, juros e frete" },
  confinamento: { campos: ["pesoCompra", "pesoVenda", "rendimento", "mortalidade", "juros"], nomes: "Pesos, rendimento, perdas, juros e frete" },
  cria: { campos: ["valorMatriz", "descarte", "valorDescarte", "mortalidade", "juros"], nomes: "Valor da matriz, descarte, mortes e juros" },
  revenda: { campos: ["diasRevenda", "quebra", "juros"], nomes: "Dias até vender, perda no transporte, juros e frete" },
};

// Listas de lugares: 3 à vista, o resto com um toque (no celular cada linha ocupa espaço).
function ListaCurta<T>({ itens, linha }: { itens: T[]; linha: (x: T, i: number) => React.ReactNode }) {
  const [todos, setTodos] = useState(false);
  return (
    <>
      <ul className="mt-3 divide-y divide-linha text-sm">{(todos ? itens : itens.slice(0, 3)).map(linha)}</ul>
      {itens.length > 3 && (
        <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="mt-1 min-h-11 text-sm font-medium text-tinta">
          {todos ? "Mostrar menos" : `Ver mais ${itens.length - 3}`}
        </button>
      )}
    </>
  );
}

const usarCls = "h-11 shrink-0 rounded-lg border border-linha px-3 text-sm text-tinta hover:bg-tinta/10";

// O passo a passo: uma pergunta por tela. Só os números que mais mudam a conta; o resto fica em "Outros números".
type Passo = "tipo" | "local" | "animal" | "ganho" | "custo" | "venda" | "bezerro" | "desmama" | "matriz" | "compraRev" | "vendaRev";
const PASSOS: Record<Estrutura, Passo[]> = {
  recria: ["tipo", "local", "animal", "ganho", "custo", "venda"],
  confinamento: ["tipo", "local", "animal", "ganho", "custo", "venda"],
  cria: ["tipo", "local", "bezerro", "desmama", "matriz"],
  revenda: ["tipo", "local", "compraRev", "vendaRev"],
};
const NOME_CAMPO: Partial<Record<keyof Entradas, string>> = {
  pesoCompra: "peso na compra", pesoVenda: "peso de venda", rendimento: "rendimento", mortalidade: "perdas",
  valorMatriz: "valor da vaca", descarte: "descarte", valorDescarte: "valor da vaca de descarte", diasRevenda: "dias até vender", quebra: "perda no transporte",
};

// Campo grande de uma pergunta só: número em destaque, régua para ajuste rápido e uma linha de ajuda.
function Grande({ rotulo, valor, onChange, unidade, passo = 1, faixa, dica }: { rotulo: string; valor: number; onChange: (v: number) => void; unidade: string; passo?: number; faixa?: [number, number]; dica?: string }) {
  return (
    <div>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          aria-label={rotulo}
          min={0}
          step={passo}
          value={Number.isFinite(valor) ? valor : ""}
          onChange={(ev) => onChange(ev.target.value === "" ? 0 : Math.max(0, +ev.target.value))}
          className="h-16 w-full rounded-2xl border border-linha bg-fundo pl-4 font-display text-3xl font-semibold tabular-nums text-texto"
          style={{ paddingRight: `${unidade.length * 0.5 + 1.5}rem` }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-texto-3">{unidade}</span>
      </span>
      {faixa && (
        <input type="range" aria-label={`${rotulo} (ajuste rápido)`} min={faixa[0]} max={faixa[1]} step={passo} value={Math.min(faixa[1], Math.max(faixa[0], valor))} onChange={(ev) => onChange(+ev.target.value)} className="mt-3 w-full accent-[var(--color-tinta)]" />
      )}
      {dica && <p className="mt-2 text-sm text-texto-3">{dica}</p>}
    </div>
  );
}

// Linha de uma lista que abre com um toque (como nos Ajustes do celular).
function Item({ titulo, resumo, children }: { titulo: string; resumo?: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-texto">{titulo}</span>
          {resumo && <span className="block truncate text-sm text-texto-3">{resumo}</span>}
        </span>
        <Seta className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

function Seta({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-texto-4 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const CATEGORIA_PADRAO: Record<Estrutura, CategoriaReposicao> = { recria: "bezerro", confinamento: "boiMagro", cria: "desmama", revenda: "boiMagro" };

const faixaDe = (v: number): [number, number] => [Math.round(v * 0.5), Math.round(v * 1.6)];

// O que fica salvo no navegador. Números digitados ficam como estão; preços vindos dos dados não são guardados:
// guardamos a escolha (região, animal, praça) e o preço é refeito com o dado do dia.
type SalvoEstrutura = {
  digitados: Partial<Entradas>;
  regiao: boolean; // clicou em "Usar preços de ..."
  categoriaEscolhida: boolean; // trocou o animal
  categoria: CategoriaReposicao;
  pracaVenda: string;
  ufCompra: string;
  freteManual: number | null;
  meus: boolean;
};
type Salvo = { estrutura?: Estrutura; ufFazenda?: string; cidade?: string; rsKm?: number; cargaKg?: number; por?: Partial<Record<Estrutura, SalvoEstrutura>> };
const ESTRUTURAS_ID: Estrutura[] = ["recria", "confinamento", "cria", "revenda"];
const lerSalvo = (): Salvo => {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_ESTADO) ?? "{}");
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
};
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
type Municipios = Record<string, [string, number, number][]>;

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
  const [meus, setMeus] = useState(false); // a pessoa já pôs os números dela?
  const [cidade, setCidade] = useState("");
  const [municipios, setMunicipios] = useState<Municipios | null>(null);
  const [digitados, setDigitados] = useState<Partial<Entradas>>({});
  const [regiao, setRegiao] = useState(false);
  const [categoriaEscolhida, setCategoriaEscolhida] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [passo, setPasso] = useState(0);
  const [ufEntrada, setUfEntrada] = useState("");
  const [mexeu, setMexeu] = useState(false); // só move a tela depois que a pessoa tocou em algo
  const [aberto, setAberto] = useState(false); // a calculadora só abre se a pessoa quiser
  const [historico, setHistorico] = useState<Registro[]>([]);
  const [guardado, setGuardado] = useState<{ para: string; id: string; decisao: string } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const pergunta = useRef<HTMLHeadingElement>(null);
  const alteradosAvancados =
    AVANCADOS[estrutura].campos.filter((k) => k in digitados).length +
    (estrutura !== "cria" ? Number(freteManual != null) + Number(rsKm !== 7) + Number(cargaKg !== 24000) : 0);

  // Lista de municípios (coordenadas) só para o frete; carrega à parte para não pesar a página.
  useEffect(() => {
    fetch("/municipios.json")
      .then((r) => r.json())
      .then((j) => setMunicipios(j.ufs))
      .catch(() => {});
  }, []);

  // Preço do animal (reposição) e do boi gordo no estado da fazenda ou no mais perto que tem cotação.
  const ufMaisPerto = (uf: string, ufs: string[]) => (ufs.includes(uf) ? uf : [...ufs].sort((a, b) => distanciaKm(uf, a) - distanciaKm(uf, b))[0]);
  const mediaBoiUf = (uf: string) => {
    const v = Object.entries(painel.pracas?.valores ?? {}).filter(([n, p]) => ufDaPraca(n) === uf && p.vista).map(([, p]) => p.vista!);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  // Monta a conta: exemplo + preços das escolhas (com o dado de hoje) + o que a pessoa digitou.
  function montar(est: Estrutura, uf: string, s?: SalvoEstrutura): Entradas {
    let x = padrao(est, painel);
    if (!s) return x;
    const c = painel.reposicao?.categorias[s.categoria];
    if (c && (s.regiao || s.categoriaEscolhida) && est !== "revenda") {
      const u = ufMaisPerto(uf, Object.keys(c.ufs));
      if (u) x = est === "cria" ? { ...x, vendaBezerro: c.ufs[u].cab } : { ...x, compraCab: c.ufs[u].cab, pesoCompra: c.peso };
    }
    if (s.regiao && est !== "cria") {
      const ufsBoi = [...new Set(Object.keys(painel.pracas?.valores ?? {}).map(ufDaPraca))];
      const b = mediaBoiUf(ufMaisPerto(uf, ufsBoi) ?? "");
      if (b) x = est === "revenda" ? { ...x, compraCab: Math.round(18 * b) } : { ...x, vendaArroba: Math.round(b * 10) / 10 };
    }
    const vp = s.pracaVenda ? painel.pracas?.valores[s.pracaVenda]?.vista : null;
    if (vp) x = est === "revenda" ? { ...x, vendaCab: Math.round(18 * vp) } : { ...x, vendaArroba: vp };
    return { ...x, ...s.digitados, estrutura: est };
  }

  function aplicar(est: Estrutura, uf: string, s?: SalvoEstrutura) {
    setEstrutura(est);
    setE(montar(est, uf, s));
    setDigitados(s?.digitados ?? {});
    setRegiao(s?.regiao ?? false);
    setCategoriaEscolhida(s?.categoriaEscolhida ?? false);
    setCategoria(s?.categoria ?? CATEGORIA_PADRAO[est]);
    setPracaVenda(s?.pracaVenda ?? "");
    setUfCompra(s?.ufCompra ?? "");
    setFreteManual(s?.freteManual ?? null);
    setMeus(s?.meus ?? false);
    setExplicacao(null);
  }

  // Ao abrir: volta ao que a pessoa deixou da última vez.
  useEffect(() => {
    const s = lerSalvo();
    const uf = s.ufFazenda && UFS.includes(s.ufFazenda) ? s.ufFazenda : "SP";
    setUfFazenda(uf);
    if (typeof s.cidade === "string") setCidade(s.cidade);
    if (typeof s.rsKm === "number") setRsKm(s.rsKm);
    if (typeof s.cargaKg === "number") setCargaKg(s.cargaKg);
    const est = s.estrutura && ESTRUTURAS_ID.includes(s.estrutura) ? s.estrutura : "recria";
    aplicar(est, uf, s.por?.[est]);
    if (s.por?.[est]?.meus) {
      setPasso(PASSOS[est].length); // já respondeu antes: abre no resultado
      setAberto(true);
    }
    setCarregou(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grava a cada mudança (depois de carregar, para não apagar o que estava salvo).
  useEffect(() => {
    if (!carregou) return;
    const s = lerSalvo();
    const atual: SalvoEstrutura = { digitados, regiao, categoriaEscolhida, categoria, pracaVenda, ufCompra, freteManual, meus };
    try {
      localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ ...s, estrutura, ufFazenda, cidade, rsKm, cargaKg, por: { ...s.por, [estrutura]: atual } }));
    } catch {}
  }, [carregou, estrutura, ufFazenda, cidade, rsKm, cargaKg, digitados, regiao, categoriaEscolhida, categoria, pracaVenda, ufCompra, freteManual, meus]);

  useEffect(() => {
    const ler = () => setHistorico(lerHistorico());
    ler();
    window.addEventListener(EVENTO_HISTORICO, ler);
    return () => window.removeEventListener(EVENTO_HISTORICO, ler);
  }, []);

  // A cada pergunta: leva a tela para o começo do cartão e o foco para a pergunta.
  useEffect(() => {
    if (!mexeu) return;
    const t = topo.current;
    if (t && t.getBoundingClientRect().top < 0) t.scrollIntoView({ block: "start" });
    pergunta.current?.focus({ preventScroll: true });
  }, [passo, mexeu]);

  const escolher = (est: Estrutura) => aplicar(est, ufFazenda, lerSalvo().por?.[est]);
  const voltarAoExemplo = () => {
    const s = lerSalvo();
    if (s.por) delete s.por[estrutura];
    try {
      localStorage.setItem(CHAVE_ESTADO, JSON.stringify(s));
    } catch {}
    aplicar(estrutura, ufFazenda);
  };

  const mudar = <K extends keyof Entradas>(k: K, v: Entradas[K]) => setE((x) => ({ ...x, [k]: v }));
  // Digitado pela pessoa (ou escolhido numa lista): fica salvo como está. Se for campo de exemplo, a conta passa a ser dela.
  const digitar = <K extends keyof Entradas>(k: K, v: Entradas[K], daLista = false) => {
    mudar(k, v);
    setDigitados((d) => ({ ...d, [k]: v }));
    if (!daLista && EXEMPLO[estrutura].campos.includes(k)) setMeus(true);
  };
  // Preço refeito por uma escolha (região, animal, praça): deixa de valer o número digitado antes.
  const esquecer = (...ks: (keyof Entradas)[]) =>
    setDigitados((d) => {
      const n = { ...d };
      for (const k of ks) delete n[k];
      return n;
    });

  // Cidade da fazenda: com ela o frete sai da cidade, não da capital.
  const achada = cidade && municipios ? municipios[ufFazenda]?.find((m) => semAcento(m[0]) === semAcento(cidade)) : undefined;
  const fazenda: Local = { uf: ufFazenda, ponto: achada ? [achada[1], achada[2]] : undefined };

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

  const localVenda: Local = pracaVenda ? localDaPraca(pracaVenda) : { uf: ufFazenda };
  const kmCompra = ufCompra ? distanciaLocais({ uf: ufCompra }, fazenda) : 0;
  const kmVenda = distanciaLocais(fazenda, localVenda);
  const kmRevenda = distanciaLocais(ufCompra ? { uf: ufCompra } : fazenda, localVenda);
  const freteEstimado =
    estrutura === "cria"
      ? 0
      : estrutura === "revenda"
        ? Math.round(fretePorCabeca(kmRevenda, rsKm, e.pesoVenda, cargaKg))
        : Math.round(fretePorCabeca(kmCompra, rsKm, e.pesoCompra, cargaKg) * (ufCompra ? 1 : 0) + fretePorCabeca(kmVenda, rsKm, e.pesoVenda, cargaKg));
  const entradas: Entradas = { ...e, estrutura, frete: estrutura === "cria" ? 0 : (freteManual ?? freteEstimado) };

  const r = calcular(entradas);
  const cen = cenarios(entradas, painel, r.dias);
  const dentroNoTeste = cen ? painel.acerto.teste.itens.find((t) => t.alvo === (estrutura === "cria" ? "bezerro" : "boi") && t.semanas === cen.semanas)?.dentroDaFaixa80 : undefined;
  const snapshot = JSON.stringify(entradas);
  const desatualizada = explicacao && explicacao.para !== snapshot;

  // Uma frase pronta, calculada na hora, dizendo por que compensa ou não.
  const unidadeEmpate = estrutura === "cria" ? "por bezerro" : estrutura === "revenda" ? "por cabeça" : "por arroba";
  const precoAtual = estrutura === "cria" ? e.vendaBezerro : estrutura === "revenda" ? e.vendaCab : e.vendaArroba;
  const maior = Object.entries(r.partes).sort((a, b) => b[1] - a[1])[0] as [keyof Partes, number];
  // Duas ou três linhas curtas em vez de um parágrafo: o que precisa mudar para empatar e o que mais pesa.
  const empate = `${reais(r.empateVenda)} ${unidadeEmpate}`;
  const maiorNome = nomeParte(estrutura, maior[0]).replace(/^(o|a|os|as) /, "");
  const motivos: { t: string; v: string }[] = [
    r.selo === "nao"
      ? { t: "Para empatar", v: `vender a ${empate} (hoje ${reais(precoAtual)})${Number.isFinite(r.tetoCompra) && estrutura !== "revenda" && estrutura !== "cria" ? `, ou pagar até ${reais(Math.max(0, r.tetoCompra))} no animal` : ""}` }
      : { t: "O preço pode cair até", v: `${empate} (hoje ${reais(precoAtual)})` },
    ...(r.selo !== "nao" ? [{ t: "Rende", v: `${numero(r.retorno * 100, 1)}% sobre o dinheiro, já com juros` }] : []),
    { t: "Maior custo", v: `${maiorNome[0].toUpperCase()}${maiorNome.slice(1)}: ${reais(maior[1])}` },
  ];

  // Onde vender (boi gordo, líquido de frete) — para quem engorda
  const arrobasCab = (e.pesoVenda * (e.rendimento / 100)) / 15;
  const vender = Object.entries(painel.pracas?.valores ?? {})
    .filter(([, p]) => p.vista)
    .map(([nome, p]) => {
      const fr = fretePorCabeca(distanciaLocais(fazenda, localDaPraca(nome)), rsKm, e.pesoVenda, cargaKg) / Math.max(1, arrobasCab);
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
    esquecer("vendaCab", "vendaArroba");
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
    esquecer("compraCab", "pesoCompra", "vendaArroba", "vendaBezerro");
    setRegiao(true);
    setPracaVenda("");
    setExplicacao(null);
  };

  const escolherCategoria = (c: CategoriaReposicao) => {
    setCategoria(c);
    setExplicacao(null);
    const k = rep?.categorias[c];
    const uf = k ? (k.ufs[ufFazenda] ? ufFazenda : Object.keys(k.ufs).sort((a, b) => distanciaKm(ufFazenda, a) - distanciaKm(ufFazenda, b))[0]) : null;
    if (!k || !uf) return;
    esquecer("compraCab", "pesoCompra", "vendaBezerro");
    setCategoriaEscolhida(true);
    if (estrutura === "cria") mudar("vendaBezerro", k.ufs[uf].cab);
    else setE((x) => ({ ...x, compraCab: k.ufs[uf].cab, pesoCompra: k.peso }));
  };

  // Onde comprar (recria/confinamento): preço do animal + frete até a fazenda. Cria: onde vender, preço − frete.
  const mercadoAnimal = cat
    ? Object.entries(cat.ufs)
        .map(([uf, v]) => {
          const fr = fretePorCabeca(distanciaLocais({ uf }, fazenda), rsKm, cat.peso, cargaKg);
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
    { chave: "compra", cor: "bg-texto-3" },
    { chave: "operacao", cor: "bg-sol" },
    { chave: "frete", cor: "bg-sky-400" },
    { chave: "juros", cor: "bg-violet-400" },
    { chave: "perdas", cor: "bg-alerta" },
  ];
  const barrasUsadas = barras.filter((b) => r.partes[b.chave] > 0);
  const custoTotal = Object.values(r.partes).reduce((a, b) => a + b, 0);
  const qtd = estrutura === "cria" ? "matriz/ano" : "cabeça";

  const lista = PASSOS[estrutura];
  const total = lista.length;
  const noResultado = passo >= total;
  const atual = lista[Math.min(passo, total - 1)];
  const dataRep = rep ? rep.data.split("-").reverse().join("/") : "";
  const dataPracas = painel.pracas?.data.split("-").reverse().join("/") ?? "";

  // Ir para uma pergunta (ou o resultado). Entrar na pergunta do lugar guarda o estado de agora para saber se mudou.
  function ir(n: number) {
    if (PASSOS[estrutura][n] === "local") setUfEntrada(ufFazenda);
    setPasso(n);
    setMexeu(true);
  }
  function continuar() {
    if (atual === "local" && (!regiao || ufFazenda !== ufEntrada)) aplicarRegiao();
    if (passo + 1 >= total) setMeus(true);
    ir(passo + 1);
  }

  // Resposta curta de cada pergunta, para a lista "Suas respostas".
  const resposta: Record<Passo, string> = {
    tipo: NOME_ESTRUTURA[estrutura],
    local: achada ? `${achada[0]}, ${ufFazenda}` : ufFazenda,
    animal: `${cat?.nome ?? "Animal"}: ${reais(e.compraCab)}`,
    ganho: `${numero(e.gmd, 2)} kg por dia`,
    custo: `${reais(e.custoDia, 2)} por dia`,
    venda: `${reais(e.vendaArroba, 2)}/@${pracaVenda ? ` em ${pracaVenda}` : ""}`,
    bezerro: `${cat?.nome ?? "Bezerro"}: ${reais(e.vendaBezerro)}`,
    desmama: `${numero(e.taxaDesmama, 0)} de cada 100 vacas`,
    matriz: `${reais(e.custoMatrizAno)} por ano`,
    compraRev: `${reais(e.compraCab)}${ufCompra ? ` em ${ufCompra}` : ""}`,
    vendaRev: `${reais(e.vendaCab)}${pracaVenda ? ` em ${pracaVenda}` : ""}`,
  };
  const TITULO: Record<Passo, string> = {
    tipo: "Como você trabalha?",
    local: "Onde fica a sua fazenda?",
    animal: estrutura === "confinamento" ? "Quanto você paga no animal?" : "Quanto você paga no bezerro?",
    ganho: "Quanto ele engorda por dia?",
    custo: "Quanto custa cada animal por dia?",
    venda: "Por quanto você vende a arroba?",
    bezerro: "Quanto você recebe pelo bezerro?",
    desmama: "De cada 100 vacas, quantos bezerros você desmama por ano?",
    matriz: "Quanto custa manter uma vaca por ano?",
    compraRev: "Quanto você paga no boi gordo?",
    vendaRev: "Por quanto você vende?",
  };
  // Campos de exemplo que a pessoa nunca viu nem mudou (ficam em "Outros números").
  const exemploEscondido = EXEMPLO[estrutura].campos.filter((k) => AVANCADOS[estrutura].campos.includes(k) && !(k in digitados)).map((k) => NOME_CAMPO[k]);

  const margemTexto = `${r.margem >= 0 ? reais(r.margem) : `−${reais(-r.margem)}`} por ${estrutura === "cria" ? "vaca/ano" : "cabeça"}`;
  function registrar(decisao: string) {
    const reg: Registro = {
      id: Date.now().toString(36),
      data: new Date().toLocaleDateString("sv-SE"), // AAAA-MM-DD no fuso do aparelho
      titulo: `${NOME_ESTRUTURA[estrutura]} em ${resposta.local}`,
      veredito: `${ROTULO_SELO[r.selo]}, ${margemTexto}`,
      decisao,
      detalhe: lista.slice(2).map((p) => resposta[p]).join(" · "),
    };
    gravarHistorico([reg, ...lerHistorico()]);
    setGuardado({ para: snapshot, id: reg.id, decisao });
  }
  function desfazer() {
    if (!guardado) return;
    gravarHistorico(lerHistorico().filter((x) => x.id !== guardado.id));
    setGuardado(null);
  }
  function baixar() {
    const url = URL.createObjectURL(new Blob(["\ufeff" + historicoCsv(historico)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "minhas-decisoes-bussola.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const escolhaAnimal = usaReposicao && (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(rep!.categorias) as CategoriaReposicao[]).map((c) => (
        <button key={c} type="button" aria-pressed={categoria === c} onClick={() => escolherCategoria(c)} className={`min-h-11 rounded-full border px-4 text-sm ${categoria === c ? "border-tinta bg-tinta/10 text-tinta" : "border-linha text-texto-2"}`}>
          {rep!.categorias[c].nome}
        </button>
      ))}
    </div>
  );
  const notaAnimal = usaReposicao ? `Média em ${ufRep} hoje: ${reais(cat!.ufs[ufRep!].cab)} (${cat!.ref}). Fonte: Scot, ${dataRep}.` : undefined;
  const escolhaPraca = (
    <label className="block text-sm text-texto-2">
      Onde você vende?
      <select value={pracaVenda} onChange={(ev) => escolherPraca(ev.target.value)} className="mt-1 h-12 w-full rounded-xl border border-linha bg-fundo px-3 text-base text-texto">
        <option value="">Na minha região ({ufFazenda})</option>
        {vender.map((v) => (
          <option key={v.nome} value={v.nome}>
            {v.nome}: {reais(v.bruto)}/@
          </option>
        ))}
      </select>
    </label>
  );

  if (!aberto)
    return (
      <div className="rounded-3xl border border-tinta/30 bg-tinta/5 p-6 sm:p-8">
        <h2 className="font-display text-2xl text-texto sm:text-3xl">Vale a pena comprar agora?</h2>
        <p className="mt-2 text-base text-texto-2">Responda até 6 perguntas rápidas e veja se a conta fecha para você.</p>
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setMexeu(true);
          }}
          className="mt-5 h-12 w-full rounded-xl bg-tinta px-6 text-base font-semibold text-sobre-tinta hover:brightness-110 sm:w-auto"
        >
          Fazer a conta
        </button>
        {historico.length > 0 && (
          <p className="mt-3 text-sm text-texto-3">
            Você tem {historico.length} {historico.length === 1 ? "conta guardada" : "contas guardadas"}. Elas aparecem na onda do ciclo.
          </p>
        )}
      </div>
    );

  return (
    <div ref={topo} className="mx-auto max-w-xl scroll-mt-24">
      {!noResultado ? (
        <div className="rounded-3xl border border-linha bg-superficie p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {lista.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? "bg-tinta" : "bg-superficie-2"}`} />
              ))}
            </div>
            <span className="text-xs text-texto-3">
              {passo + 1} de {total}
            </span>
          </div>

          <h3 ref={pergunta} tabIndex={-1} className="mt-6 font-display text-2xl leading-snug text-texto outline-none sm:text-3xl">
            {TITULO[atual]}
          </h3>

          <div className="mt-5 space-y-4">
            {atual === "tipo" &&
              ESTRUTURAS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    escolher(s.id);
                    setPasso(1);
                    setUfEntrada(ufFazenda);
                    setMexeu(true);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${estrutura === s.id ? "border-tinta bg-tinta/5" : "border-linha hover:border-texto-4"}`}
                >
                  <span className="flex-1">
                    <span className="block text-lg font-medium text-texto">{NOME_ESTRUTURA[s.id]}</span>
                    <span className="mt-0.5 block text-sm text-texto-3">{s.quem}</span>
                  </span>
                  <Seta />
                </button>
              ))}

            {atual === "local" && (
              <>
                <label className="block text-sm text-texto-2">
                  Estado
                  <select
                    value={ufFazenda}
                    onChange={(ev) => {
                      setUfFazenda(ev.target.value);
                      setCidade("");
                    }}
                    className="mt-1 h-12 w-full rounded-xl border border-linha bg-fundo px-3 text-lg text-texto"
                  >
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-texto-2">
                  Cidade (se quiser, para o frete ficar mais certo)
                  <input
                    list="cidades-fazenda"
                    value={cidade}
                    onChange={(ev) => setCidade(ev.target.value)}
                    placeholder="Comece a digitar"
                    autoComplete="off"
                    className="mt-1 h-12 w-full rounded-xl border border-linha bg-fundo px-3 text-lg text-texto"
                  />
                  <datalist id="cidades-fazenda">
                    {municipios?.[ufFazenda]?.map((m) => <option key={m[0]} value={m[0]} />)}
                  </datalist>
                  {cidade.trim() && municipios && !achada && <span className="mt-1 block text-xs text-sol">Não achei essa cidade em {ufFazenda}. O frete conta da capital.</span>}
                </label>
                <p className="text-sm text-texto-3">Vamos usar os preços de hoje do seu estado.</p>
              </>
            )}

            {atual === "animal" && (
              <>
                {escolhaAnimal}
                <Grande rotulo={TITULO.animal} unidade="R$ por cabeça" passo={50} valor={e.compraCab} onChange={(v) => digitar("compraCab", v)} faixa={faixaDe(padrao(estrutura, painel).compraCab)} dica={notaAnimal} />
              </>
            )}
            {atual === "ganho" && (
              <Grande rotulo={TITULO.ganho} unidade="kg por dia" passo={0.05} valor={e.gmd} onChange={(v) => digitar("gmd", v)} faixa={[0.2, 2]} dica={`Já preenchido com um exemplo (${numero(padrao(estrutura, painel).gmd, 2)} kg). Troque pelo da sua fazenda.`} />
            )}
            {atual === "custo" && (
              <Grande rotulo={TITULO.custo} unidade="R$ por dia" passo={0.5} valor={e.custoDia} onChange={(v) => digitar("custoDia", v)} faixa={[2, 40]} dica="Some comida, sal, vacina e mão de obra. O valor que aparece é só um exemplo." />
            )}
            {atual === "venda" && (
              <>
                {escolhaPraca}
                <Grande rotulo={TITULO.venda} unidade="R$ por arroba" passo={1} valor={e.vendaArroba} onChange={(v) => digitar("vendaArroba", v)} faixa={faixaDe(painel.hoje.boi)} dica={`Preço à vista da Scot (${dataPracas}). Cepea SP hoje: ${reais(painel.hoje.boi, 2)}.`} />
              </>
            )}
            {atual === "bezerro" && (
              <>
                {escolhaAnimal}
                <Grande rotulo={TITULO.bezerro} unidade="R$ por cabeça" passo={50} valor={e.vendaBezerro} onChange={(v) => digitar("vendaBezerro", v)} faixa={faixaDe(painel.hoje.bezerro)} dica={notaAnimal} />
              </>
            )}
            {atual === "desmama" && (
              <Grande rotulo={TITULO.desmama} unidade="bezerros" passo={1} valor={e.taxaDesmama} onChange={(v) => digitar("taxaDesmama", v)} faixa={[30, 100]} dica="Já preenchido com um exemplo. Troque pelo da sua fazenda." />
            )}
            {atual === "matriz" && (
              <Grande rotulo={TITULO.matriz} unidade="R$ por ano" passo={50} valor={e.custoMatrizAno} onChange={(v) => digitar("custoMatrizAno", v)} faixa={[300, 3000]} dica="Pasto, sal, vacina e mão de obra de uma vaca. O valor que aparece é só um exemplo." />
            )}
            {atual === "compraRev" && (
              <>
                <label className="block text-sm text-texto-2">
                  Onde você compra?
                  <select value={ufCompra} onChange={(ev) => setUfCompra(ev.target.value)} className="mt-1 h-12 w-full rounded-xl border border-linha bg-fundo px-3 text-base text-texto">
                    <option value="">No meu estado ({ufFazenda})</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <Grande rotulo={TITULO.compraRev} unidade="R$ por cabeça de 18@" passo={50} valor={e.compraCab} onChange={(v) => digitar("compraCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} dica={`Boi de 18 arrobas. Média da Scot no estado (${dataPracas}).`} />
              </>
            )}
            {atual === "vendaRev" && (
              <>
                {escolhaPraca}
                <Grande rotulo={TITULO.vendaRev} unidade="R$ por cabeça de 18@" passo={50} valor={e.vendaCab} onChange={(v) => digitar("vendaCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} />
              </>
            )}
          </div>

          {atual !== "tipo" && (
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => ir(passo - 1)} className="h-12 rounded-xl border border-linha px-5 text-base text-texto-2">
                Voltar
              </button>
              <button type="button" onClick={continuar} className="h-12 flex-1 rounded-xl bg-tinta px-5 text-base font-semibold text-sobre-tinta hover:brightness-110">
                {passo + 1 >= total ? "Ver resultado" : "Continuar"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <article className={`rounded-3xl border-2 p-5 sm:p-7 ${COR_SELO[r.selo]}`} aria-live="polite">
            <p className="text-sm text-texto-3">
              {NOME_ESTRUTURA[estrutura]} · {resposta.local}
            </p>
            <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">{ROTULO_SELO[r.selo]}</p>
            <p className="mt-3 text-texto">
              <span className={`font-display text-4xl font-bold tabular-nums ${r.margem >= 0 ? "text-capim" : "text-alerta"}`}>{r.margem >= 0 ? reais(r.margem) : `−${reais(-r.margem)}`}</span>
              <span className="ml-2 text-base text-texto-2">{r.margem >= 0 ? "sobram" : "faltam"} por {estrutura === "cria" ? "vaca no ano" : "cabeça"}</span>
            </p>
            <dl className="mt-4 space-y-2 text-texto">
              {motivos.map((m) => (
                <div key={m.t}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-texto-3">{m.t}</dt>
                  <dd className="text-base">{m.v}</dd>
                </div>
              ))}
            </dl>
            {exemploEscondido.length > 0 && <p className="mt-3 text-xs text-texto-3">Usamos exemplo para {exemploEscondido.join(", ")}. Ajuste em &quot;Outros números&quot;.</p>}
          </article>

          <div className="rounded-3xl border border-linha bg-superficie p-5">
            {guardado && guardado.para === snapshot ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex-1 text-texto">
                  <span className="text-capim">✓</span> Guardado: <strong>{guardado.decisao}</strong>. Aparece na onda do ciclo e em &quot;Minhas decisões&quot;.
                </p>
                <button type="button" onClick={desfazer} className="min-h-11 text-sm text-tinta">
                  Desfazer
                </button>
              </div>
            ) : (
              <>
                <p className="font-medium text-texto">O que você vai fazer?</p>
                <p className="text-sm text-texto-3">Um toque guarda esta conta no seu histórico, só neste aparelho.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Vou comprar", "Vou esperar", "Só simulando"].map((op) => (
                    <button key={op} type="button" onClick={() => registrar(op)} className="min-h-11 rounded-full border border-linha px-4 text-sm text-texto hover:border-tinta hover:text-tinta">
                      {op}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="divide-y divide-linha overflow-hidden rounded-3xl border border-linha bg-superficie">
            <Item titulo="Suas respostas" resumo="Toque para mudar">
              <ul className="divide-y divide-linha">
                {lista.map((p, i) => (
                  <li key={p} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-texto-3">{TITULO[p]}</span>
                      <span className="block text-texto">{resposta[p]}</span>
                    </span>
                    <button type="button" onClick={() => ir(i)} className={usarCls}>
                      Mudar
                    </button>
                  </li>
                ))}
              </ul>
            </Item>

            <Item titulo="Para onde vai o dinheiro" resumo={`Entram ${reais(receita)}, saem ${reais(custoTotal)}`}>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-fundo" role="img" aria-label="Divisão dos custos">
                {barrasUsadas.map((b) => (
                  <div key={b.chave} className={b.cor} style={{ width: `${Math.min(100, (r.partes[b.chave] / Math.max(receita, custoTotal)) * 100)}%` }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-texto-2">
                {barrasUsadas.map((b) => (
                  <li key={b.chave} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${b.cor}`} aria-hidden />
                    <span className="flex-1">{b.chave === "compra" ? (estrutura === "cria" ? "Reposição das vacas" : "Animal comprado") : b.chave === "operacao" ? (estrutura === "cria" ? "Custo das vacas" : "Custo diário") : b.chave === "frete" ? "Frete" : b.chave === "juros" ? "Juros" : estrutura === "cria" ? "Mortes" : "Perdas"}</span>
                    <span className="tabular-nums text-texto">{reais(r.partes[b.chave])}</span>
                  </li>
                ))}
              </ul>
              {(estrutura === "recria" || estrutura === "confinamento") && (
                <p className="mt-3 text-sm text-texto-2">
                  Cada arroba que você produz custa <strong className={custoArroba(e.custoDia, e.gmd) < e.vendaArroba ? "text-capim" : "text-alerta"}>{reais(custoArroba(e.custoDia, e.gmd))}</strong> (só comida e operação).
                </p>
              )}
            </Item>

            {cen && (
              <Item titulo="E se o preço cair?" resumo={`No pior caso: ${reais(cen.pior.margem)}`}>
                <p className="text-sm text-texto-2">{descreverEstagio(entradaDoPainel(painel))}</p>
                <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { t: "Preço no mínimo", x: cen.pior },
                    { t: "Esperado", x: cen.esperado },
                    { t: "Preço no máximo", x: cen.melhor },
                  ].map(({ t, x }) => (
                    <li key={t} className="flex flex-col justify-between rounded-xl bg-fundo px-1.5 py-2">
                      <span className="block text-xs text-texto-3">{t}</span>
                      <span className={`mt-0.5 block whitespace-nowrap font-display text-sm font-bold tabular-nums sm:text-base ${x.margem >= 0 ? "text-capim" : "text-alerta"}`}>{reais(x.margem)}</span>
                    </li>
                  ))}
                </ul>
                {cen.pior.margem < 0 && r.margem >= 0 && <p className="mt-2 text-sm text-sol">Se o preço cair ao mínimo da faixa, a conta fica negativa. Vender parte antes ou travar preço na B3 reduz esse risco.</p>}
                {cen.melhor.margem < 0 && <p className="mt-2 text-sm text-alerta">Mesmo com o preço no máximo, a conta não fecha. O problema está no custo ou no preço pago, não no ciclo.</p>}
                <p className="mt-2 text-xs text-texto-3">
                  Previsão de {cen.semanas} semanas{dentroNoTeste != null && `; no teste, o preço real ficou dentro da faixa em ${pct(dentroNoTeste)} das vezes`}.
                </p>
              </Item>
            )}

            {estrutura === "revenda" ? (
              <Item titulo="Onde comprar e vender" resumo={pares[0] ? `Melhor: ${pares[0].de} → ${pares[0].para}` : ""}>
                <p className="text-sm text-texto-3">Pares de estados para boi de 18@, já tirando frete e perda de {numero(e.quebra, 1)}%. Scot, {dataPracas}.</p>
                <ListaCurta
                  itens={pares}
                  linha={(p) => (
                    <li key={`${p.de}${p.para}`} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="font-medium text-texto">
                            {p.de} → {p.para}
                          </span>
                          <span className={`whitespace-nowrap font-display font-bold tabular-nums ${p.sobra >= 0 ? "text-capim" : "text-alerta"}`}>{reais(p.sobra)}/cab</span>
                        </span>
                        <span className="block text-xs text-texto-3">
                          compra {reais(p.compra)} · vende {reais(p.venda)} · frete {reais(p.frete)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Usar ${p.de} para ${p.para} na conta`}
                        onClick={() => {
                          setUfCompra(p.de);
                          setPracaVenda(Object.keys(painel.pracas?.valores ?? {}).find((n) => ufDaPraca(n) === p.para) ?? "");
                          setFreteManual(null);
                          setExplicacao(null);
                          digitar("compraCab", Math.round(p.compra), true);
                          digitar("vendaCab", Math.round(p.venda), true);
                        }}
                        className={usarCls}
                      >
                        Usar
                      </button>
                    </li>
                  )}
                />
              </Item>
            ) : estrutura !== "cria" ? (
              <Item titulo="Onde vender o boi gordo" resumo={vender[0] ? `Melhor: ${vender[0].nome}` : ""}>
                <p className="text-sm text-texto-3">Preço da Scot ({dataPracas}) já tirando o frete saindo de {achada ? achada[0] : ufFazenda}.</p>
                <ListaCurta
                  itens={vender.slice(0, 6)}
                  linha={(v, i) => (
                    <li key={v.nome} className="flex items-center gap-3 py-2.5">
                      <span className="w-4 shrink-0 text-texto-3">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="font-medium text-texto">{v.nome}</span>
                          <span className="whitespace-nowrap font-display font-bold tabular-nums text-capim">{reais(v.liquido, 2)}/@</span>
                        </span>
                        <span className="block text-xs text-texto-3">
                          {reais(v.bruto)} − frete {reais(v.frete, 2)}/@
                        </span>
                      </span>
                      <button type="button" aria-label={`Usar ${v.nome} na conta`} onClick={() => escolherPraca(v.nome)} className={usarCls}>
                        Usar
                      </button>
                    </li>
                  )}
                />
              </Item>
            ) : null}

            {estrutura !== "revenda" && cat && mercadoAnimal.length > 0 && (
              <Item titulo={estrutura === "cria" ? `Onde vender o ${cat.nome.toLowerCase()}` : `Onde comprar o ${cat.nome.toLowerCase()}`} resumo={`Melhor: ${mercadoAnimal[0].uf}`}>
                <p className="text-sm text-texto-3">
                  {cat.nome} Nelore ({cat.ref}), média de cada estado {estrutura === "cria" ? "menos" : "mais"} o frete. Scot, {dataRep}.
                  {mercadoAnimal.some((m) => m.marcado) ? " A fonte marca RS e SC com * sem explicar." : ""}
                </p>
                <ListaCurta
                  itens={mercadoAnimal.slice(0, 6)}
                  linha={(m, i) => (
                    <li key={m.uf} className="flex items-center gap-3 py-2.5">
                      <span className="w-4 shrink-0 text-texto-3">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="font-medium text-texto">
                            {m.uf}
                            {m.marcado ? "*" : ""}
                          </span>
                          <span className="whitespace-nowrap font-display font-bold tabular-nums text-capim">{reais(m.total)}/cab</span>
                        </span>
                        <span className="block text-xs text-texto-3">
                          {reais(m.cab)} {estrutura === "cria" ? "−" : "+"} frete {reais(m.frete)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Usar ${m.uf} na conta`}
                        onClick={() => {
                          setExplicacao(null);
                          if (estrutura === "cria") digitar("vendaBezerro", Math.round(m.total), true);
                          else {
                            setUfCompra(m.uf === ufFazenda ? "" : m.uf);
                            digitar("compraCab", m.cab, true);
                            digitar("pesoCompra", cat.peso, true);
                          }
                        }}
                        className={usarCls}
                      >
                        Usar
                      </button>
                    </li>
                  )}
                />
              </Item>
            )}

            <Item titulo="Outros números" resumo={alteradosAvancados > 0 ? `${alteradosAvancados} ${alteradosAvancados === 1 ? "mudado" : "mudados"} por você` : AVANCADOS[estrutura].nomes}>
              <div className="grid gap-4 sm:grid-cols-2">
                {(estrutura === "recria" || estrutura === "confinamento") && (
                  <>
                    <Num rotulo="Peso na compra" unidade="kg vivo" passo={5} valor={e.pesoCompra} onChange={(v) => digitar("pesoCompra", v)} />
                    <Num rotulo="Peso na venda" unidade="kg vivo" passo={5} valor={e.pesoVenda} onChange={(v) => digitar("pesoVenda", v)} />
                    <Num rotulo="Rendimento de carcaça" unidade="%" passo={0.5} valor={e.rendimento} onChange={(v) => digitar("rendimento", v)} />
                    <Num rotulo="Animais que se perdem" unidade="%" passo={0.5} valor={e.mortalidade} onChange={(v) => digitar("mortalidade", v)} />
                    <label className="block text-sm text-texto-2">
                      Comprar animais de
                      <select value={ufCompra} onChange={(ev) => setUfCompra(ev.target.value)} className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base text-texto">
                        <option value="">Meu estado (sem frete)</option>
                        {UFS.filter((u) => u !== ufFazenda).map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {estrutura === "cria" && (
                  <>
                    <Num rotulo="Valor da vaca" unidade="R$" passo={100} valor={e.valorMatriz} onChange={(v) => digitar("valorMatriz", v)} dica="Exemplo: 15 @ ao preço do boi. É o dinheiro parado na vaca e o custo de repor." />
                    <Num rotulo="Vacas descartadas por ano" unidade="% das vacas" passo={1} valor={e.descarte} onChange={(v) => digitar("descarte", v)} faixa={[0, 40]} />
                    <Num rotulo="Valor da vaca de descarte" unidade="R$/cabeça" passo={50} valor={e.valorDescarte} onChange={(v) => digitar("valorDescarte", v)} dica="Exemplo: 12 @ ao preço do boi." />
                    <Num rotulo="Vacas que morrem" unidade="% ao ano" passo={0.5} valor={e.mortalidade} onChange={(v) => digitar("mortalidade", v)} />
                  </>
                )}
                {estrutura === "revenda" && (
                  <>
                    <Num rotulo="Dias até vender" unidade="dias" valor={e.diasRevenda} onChange={(v) => digitar("diasRevenda", v)} />
                    <Num rotulo="Perda no transporte" unidade="%" passo={0.5} valor={e.quebra} onChange={(v) => digitar("quebra", v)} dica="Quebra de peso e mortes" />
                  </>
                )}
                <Num rotulo="Custo do dinheiro" unidade="% ao ano" passo={0.5} valor={e.juros} onChange={(v) => digitar("juros", v)} dica={`Selic hoje: ${numero(painel.selic.valor)}% (Banco Central)`} />
              </div>
              {estrutura !== "cria" && (
                <div className="mt-5 border-t border-linha pt-4">
                  <p className="text-sm text-texto-2">
                    Frete por cabeça: <strong className="text-texto">{reais(entradas.frete)}</strong> {freteManual == null ? "(estimado pela distância)" : "(digitado)"}
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Num rotulo="Preço do frete" unidade="R$ por km" passo={0.5} valor={rsKm} onChange={setRsKm} dica="Exemplo: pergunte ao seu transportador" />
                    <Num rotulo="Carga do caminhão" unidade="kg" passo={500} valor={cargaKg} onChange={setCargaKg} dica="Exemplo: carreta boiadeira" />
                    <Num rotulo="Ou digite o frete" unidade="R$/cabeça" passo={5} valor={freteManual ?? freteEstimado} onChange={setFreteManual} />
                  </div>
                  {freteManual != null && (
                    <button type="button" onClick={() => setFreteManual(null)} className="mt-2 min-h-11 text-sm text-tinta">
                      Voltar ao estimado
                    </button>
                  )}
                  <p className="mt-2 text-xs text-texto-3">
                    {estrutura === "revenda" ? `Viagem: ${numero(kmRevenda, 0)} km.` : `Compra: ${ufCompra ? `${numero(kmCompra, 0)} km` : "sem frete"} · Venda: ${numero(kmVenda, 0)} km.`} Linha reta × {FATOR_ESTRADA}; sem cidade, {KM_DENTRO_DO_ESTADO} km no mesmo estado. É estimativa.
                  </p>
                </div>
              )}
            </Item>

            {historico.length > 0 && (
              <Item titulo="Minhas decisões" resumo={`${historico.length} ${historico.length === 1 ? "conta guardada" : "contas guardadas"}`}>
                <ul className="divide-y divide-linha">
                  {historico.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-texto-3">
                          {h.data.split("-").reverse().join("/")} · {h.decisao}
                        </span>
                        <span className="block text-texto">{h.titulo}</span>
                        <span className="block text-sm text-texto-2">{h.veredito}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Apagar a conta de ${h.data.split("-").reverse().join("/")}`}
                        onClick={() => gravarHistorico(lerHistorico().filter((x) => x.id !== h.id))}
                        className="min-h-11 shrink-0 px-2 text-sm text-texto-3 hover:text-alerta"
                      >
                        Apagar
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={baixar} className={`mt-2 ${usarCls}`}>
                  Baixar planilha
                </button>
                <p className="mt-2 text-xs text-texto-3">Fica só neste aparelho. Se trocar de celular ou limpar o navegador, perde. Baixe a planilha para guardar.</p>
              </Item>
            )}

            <Item titulo="Explicar com IA" resumo={explicacao ? (desatualizada ? "Desatualizada" : "Pronta") : "Um texto sobre a sua conta"}>
              {explicacao ? (
                <>
                  {desatualizada && <p className="mb-2 text-sm text-sol">Você mudou os números. Peça de novo.</p>}
                  <p className={`whitespace-pre-line text-base leading-relaxed ${desatualizada ? "text-texto-3" : "text-texto"}`}>{explicacao.texto}</p>
                </>
              ) : (
                <p className="text-sm text-texto-3">A IA lê a sua conta e explica em palavras simples. Só roda quando você toca, para não gastar à toa.</p>
              )}
              {erro && <p className="mt-2 text-sm text-alerta">{erro}</p>}
              <button type="button" onClick={explicar} disabled={carregando} className="mt-3 h-11 rounded-xl bg-tinta px-5 text-sm font-semibold text-sobre-tinta disabled:opacity-50">
                {carregando ? "Pensando…" : explicacao ? "Explicar de novo" : "Explicar com IA"}
              </button>
            </Item>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => ir(1)} className="h-12 flex-1 rounded-xl border border-linha px-5 text-base text-texto-2">
              Refazer as perguntas
            </button>
            <button
              type="button"
              onClick={() => {
                voltarAoExemplo();
                ir(0);
              }}
              className="h-12 rounded-xl px-4 text-sm text-texto-3"
            >
              Começar do zero
            </button>
          </div>
          <p className="text-xs text-texto-3">O que você respondeu fica salvo só neste aparelho.</p>
        </div>
      )}
    </div>
  );
}
