"use client";

import { useEffect, useMemo, useState } from "react";
import { cenarios } from "@/lib/cenarios";
import { distanciaKm, distanciaLocais, fretePorCabeca, localDaPraca, ufDaPraca, UFS, FATOR_ESTRADA, KM_DENTRO_DO_ESTADO, type Local } from "@/lib/frete";
import { numero, pct, reais } from "@/lib/formato";
import { calcular, custoArroba, NOME_ESTRUTURA, nomeParte, type Entradas, type Estrutura, type Partes, type Selo } from "@/lib/margem";
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
  const porque =
    r.selo === "nao"
      ? `Cada ${estrutura === "cria" ? "matriz perde" : "cabeça perde"} ${reais(-r.margem)}. Pesa mais ${nomeParte(estrutura, maior[0])}: ${reais(maior[1])}, ${numero((maior[1] / Math.max(1, r.receita)) * 100, 0)}% do que entra. Para empatar, o preço de venda teria de ser ${reais(r.empateVenda)} ${unidadeEmpate} (hoje ${reais(precoAtual)})${Number.isFinite(r.tetoCompra) && estrutura !== "revenda" ? `, ou o animal ser comprado por no máximo ${reais(Math.max(0, r.tetoCompra))}` : ""}.`
      : r.selo === "apertada"
        ? `Sobram ${reais(r.margem)} por ${estrutura === "cria" ? "matriz" : "cabeça"} (${numero(r.retorno * 100, 1)}% sobre o dinheiro parado). Já descontados os juros, mas qualquer queda de preço zera a margem: o empate é ${reais(r.empateVenda)} ${unidadeEmpate}.`
        : `Sobram ${reais(r.margem)} por ${estrutura === "cria" ? "matriz" : "cabeça"}, ${numero(r.retorno * 100, 1)}% sobre o dinheiro parado, já descontados os juros. O preço de venda pode cair até ${reais(r.empateVenda)} ${unidadeEmpate} antes de zerar.`;

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
        <fieldset>
          <legend className="text-sm font-medium text-texto-2">1. Como você trabalha?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ESTRUTURAS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={estrutura === s.id}
                onClick={() => escolher(s.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${estrutura === s.id ? "border-tinta bg-tinta/10" : "border-linha bg-superficie hover:border-texto-4"}`}
              >
                <span className="block font-medium text-texto">{NOME_ESTRUTURA[s.id]}</span>
                <span className="mt-0.5 block text-xs text-texto-3">{s.quem}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
          <h3 className="font-display text-lg text-texto">2. Onde fica e para onde vai</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-texto-2">
              Estado da sua fazenda
              <select
                value={ufFazenda}
                onChange={(ev) => {
                  setUfFazenda(ev.target.value);
                  setCidade("");
                }}
                className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base"
              >
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-texto-2">
              Cidade da fazenda (opcional)
              <input
                list="cidades-fazenda"
                value={cidade}
                onChange={(ev) => setCidade(ev.target.value)}
                placeholder="Comece a digitar"
                autoComplete="off"
                className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base text-texto"
              />
              <datalist id="cidades-fazenda">
                {municipios?.[ufFazenda]?.map((m) => <option key={m[0]} value={m[0]} />)}
              </datalist>
              {cidade.trim() && municipios && !achada && <span className="mt-1 block text-xs text-sol">Não achei essa cidade em {ufFazenda}. O frete usa a capital do estado.</span>}
              {achada && <span className="mt-1 block text-xs text-texto-3">O frete sai de {achada[0]}.</span>}
            </label>
            {estrutura !== "cria" && (
              <label className="block text-sm text-texto-2">
                {estrutura === "revenda" ? "Comprar em (estado)" : "Comprar animais de (estado)"}
                <select value={ufCompra} onChange={(ev) => setUfCompra(ev.target.value)} className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base">
                  <option value="">{estrutura === "revenda" ? `No meu estado (${ufFazenda})` : "Meu estado (sem frete)"}</option>
                  {UFS.filter((u) => estrutura === "revenda" || u !== ufFazenda).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            )}
            {estrutura !== "cria" && (
              <label className="block text-sm text-texto-2 sm:col-span-2">
                {estrutura === "revenda" ? "Vender em" : "Vender o boi gordo em"}
                <select value={pracaVenda} onChange={(ev) => escolherPraca(ev.target.value)} className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base">
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
            <div className="mt-4 rounded-xl border border-tinta/40 bg-tinta/5 p-3">
              {usaReposicao && (
                <label className="block text-sm text-texto-2">
                  {estrutura === "cria" ? "Animal que você vende" : "Animal que você compra"}
                  <select value={categoria} onChange={(ev) => escolherCategoria(ev.target.value as CategoriaReposicao)} className="mt-1 h-11 w-full rounded-lg border border-linha bg-fundo px-3 text-base">
                    {(Object.keys(rep!.categorias) as CategoriaReposicao[]).map((c) => (
                      <option key={c} value={c}>
                        {rep!.categorias[c].nome} ({rep!.categorias[c].ref})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" onClick={aplicarRegiao} className="mt-3 h-11 w-full rounded-lg bg-tinta px-4 text-base font-semibold text-sobre-tinta hover:brightness-110 sm:w-auto">
                Usar preços de {usaReposicao && ufRep !== ufPreco && estrutura !== "cria" ? `${ufRep} e ${ufPreco}` : usaReposicao ? ufRep : ufPreco}
              </button>
              <ul className="mt-2 space-y-0.5 text-sm text-texto-2">
                {usaReposicao && (
                  <li>
                    {cat!.nome} em {ufRep}: <strong className="text-texto">{reais(cat!.ufs[ufRep!].cab)}</strong> por cabeça ({reais(cat!.ufs[ufRep!].kg, 2)}/kg)
                    {ufRep !== ufFazenda && <span className="text-texto-3"> · {ufFazenda} não tem cotação, usamos o estado mais perto</span>}
                  </li>
                )}
                {ufPreco && estrutura !== "cria" && (
                  <li>
                    Boi gordo em {ufPreco}: <strong className="text-texto">{reais(porUf[ufPreco], 2)}/@</strong> à vista
                    {ufPreco !== ufFazenda && <span className="text-texto-3"> · estado com cotação mais perto</span>}
                  </li>
                )}
              </ul>
              <p className="mt-1 text-xs text-texto-3">
                Fonte: Scot Consultoria{rep ? ` (reposição de ${rep.data.split("-").reverse().join("/")}, via Notícias Agrícolas)` : ""}; boi gordo de {painel.pracas?.data.split("-").reverse().join("/")}. É o preço médio do estado; o seu negócio pode sair diferente.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
          <h3 className="font-display text-lg text-texto">3. Os números do seu negócio</h3>
          <p className="mt-1 text-xs text-texto-3">
            Preços de hoje vêm dos dados. O resto é só exemplo: troque pelos da sua fazenda, tudo muda o resultado na hora. O que você digitar fica salvo neste aparelho.
          </p>
          {(Object.keys(digitados).length > 0 || meus || regiao || categoriaEscolhida) && (
            <button type="button" onClick={voltarAoExemplo} className="mt-2 min-h-11 text-sm text-tinta underline underline-offset-4">
              Apagar meus números e voltar ao exemplo
            </button>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(estrutura === "recria" || estrutura === "confinamento") && (
              <>
                <Num rotulo="Preço pago por animal" unidade="R$/cabeça" passo={50} valor={e.compraCab} onChange={(v) => digitar("compraCab", v)} faixa={faixaDe(padrao(estrutura, painel).compraCab)} dica={estrutura === "recria" ? `Bezerro MS (Cepea): ${reais(painel.hoje.bezerro)}. Use o botão de região para o preço do seu estado.` : "Exemplo: 12,5 arrobas × preço da arroba. Use o botão de região para o preço do boi magro."} />
                <Num rotulo="Preço de venda do boi gordo" unidade="R$/@" passo={1} valor={e.vendaArroba} onChange={(v) => digitar("vendaArroba", v)} faixa={faixaDe(painel.hoje.boi)} dica={`Cepea hoje: ${reais(painel.hoje.boi, 2)}`} />
                <Num rotulo="Ganho de peso por dia" unidade="kg/dia" passo={0.05} valor={e.gmd} onChange={(v) => digitar("gmd", v)} faixa={[0.2, 2]} />
                <Num rotulo="Custo por animal por dia" unidade="R$/dia" passo={0.5} valor={e.custoDia} onChange={(v) => digitar("custoDia", v)} faixa={[2, 40]} dica="Comida, sal, mão de obra, vacina" />
              </>
            )}
            {estrutura === "cria" && (
              <>
                <Num rotulo="Preço do bezerro vendido" unidade="R$/cabeça" passo={50} valor={e.vendaBezerro} onChange={(v) => digitar("vendaBezerro", v)} faixa={faixaDe(painel.hoje.bezerro)} dica={`Bezerro MS (Cepea): ${reais(painel.hoje.bezerro)}`} />
                <Num rotulo="Bezerros desmamados por matriz" unidade="% ao ano" passo={1} valor={e.taxaDesmama} onChange={(v) => digitar("taxaDesmama", v)} faixa={[30, 100]} />
                <Num rotulo="Custo de manter uma matriz" unidade="R$/ano" passo={50} valor={e.custoMatrizAno} onChange={(v) => digitar("custoMatrizAno", v)} faixa={[300, 3000]} dica="Pasto, sal, vacina, mão de obra" />
              </>
            )}
            {estrutura === "revenda" && (
              <>
                <Num rotulo="Preço de compra" unidade="R$/cabeça de 18@" passo={50} valor={e.compraCab} onChange={(v) => digitar("compraCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} />
                <Num rotulo="Preço de venda" unidade="R$/cabeça de 18@" passo={50} valor={e.vendaCab} onChange={(v) => digitar("vendaCab", v)} faixa={faixaDe(Math.round(18 * painel.hoje.boi))} />
              </>
            )}
          </div>

          {/* Números que mudam pouco ficam guardados atrás de um toque: a conta usa todos, aberto ou fechado. */}
          <details className="group mt-5 border-t border-linha pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-left [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-medium text-tinta">
                  <span className="group-open:hidden">Mostrar mais números</span>
                  <span className="hidden group-open:inline">Mostrar menos</span>
                </span>
                <span className="block text-xs text-texto-3">
                  {AVANCADOS[estrutura].nomes}
                  {alteradosAvancados > 0 && ` · ${alteradosAvancados} ${alteradosAvancados === 1 ? "mudado" : "mudados"} por você`}
                </span>
              </span>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-texto-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(estrutura === "recria" || estrutura === "confinamento") && (
                <>
                  <Num rotulo="Peso na compra" unidade="kg vivo" passo={5} valor={e.pesoCompra} onChange={(v) => digitar("pesoCompra", v)} />
                  <Num rotulo="Peso na venda" unidade="kg vivo" passo={5} valor={e.pesoVenda} onChange={(v) => digitar("pesoVenda", v)} />
                  <Num rotulo="Rendimento de carcaça" unidade="%" passo={0.5} valor={e.rendimento} onChange={(v) => digitar("rendimento", v)} />
                  <Num rotulo="Animais que se perdem" unidade="%" passo={0.5} valor={e.mortalidade} onChange={(v) => digitar("mortalidade", v)} />
                </>
              )}
              {estrutura === "cria" && (
                <>
                  <Num rotulo="Valor da matriz" unidade="R$" passo={100} valor={e.valorMatriz} onChange={(v) => digitar("valorMatriz", v)} dica={`Exemplo: 15 @ ao preço do boi. É o dinheiro parado na vaca e o custo de repor uma matriz.`} />
                  <Num rotulo="Vacas descartadas por ano" unidade="% das matrizes" passo={1} valor={e.descarte} onChange={(v) => digitar("descarte", v)} faixa={[0, 40]} dica="Vacas velhas ou vazias vendidas; cada uma é reposta por uma matriz nova" />
                  <Num rotulo="Valor da vaca de descarte" unidade="R$/cabeça" passo={50} valor={e.valorDescarte} onChange={(v) => digitar("valorDescarte", v)} dica={`Exemplo: vaca de 12 @ ao preço do boi (${reais(painel.hoje.boi, 2)}/@). A vaca costuma valer um pouco menos.`} />
                  <Num rotulo="Matrizes que morrem" unidade="% ao ano" passo={0.5} valor={e.mortalidade} onChange={(v) => digitar("mortalidade", v)} dica="Cada uma também é reposta" />
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
                <p className="text-sm font-medium text-texto-2">Frete (estimado pela distância)</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Num rotulo="Preço do frete" unidade="R$ por km rodado" passo={0.5} valor={rsKm} onChange={setRsKm} dica="Exemplo: pergunte ao seu transportador" />
                  <Num rotulo="Carga do caminhão" unidade="kg" passo={500} valor={cargaKg} onChange={setCargaKg} dica="Exemplo: carreta boiadeira" />
                </div>
                {(
                  <p className="mt-3 text-sm text-texto-2">
                    Frete por cabeça: <strong className="text-texto">{reais(entradas.frete)}</strong>
                    {freteManual == null ? " (estimado)" : " (digitado)"}
                    <span className="mt-1 block text-xs text-texto-3">
                      {estrutura === "revenda" ? `Viagem: ${numero(kmRevenda, 0)} km.` : `Compra: ${ufCompra ? `${numero(kmCompra, 0)} km` : "sem frete"} · Venda: ${numero(kmVenda, 0)} km.`} Distância em linha reta × {FATOR_ESTRADA} para a estrada, {achada ? `saindo de ${achada[0]}` : "saindo da capital (informe a cidade da fazenda para melhorar)"}; outro estado conta da capital, praça conta da cidade de referência. No mesmo estado sem cidade, {KM_DENTRO_DO_ESTADO} km. É estimativa.
                    </span>
                  </p>
                )}
                {(
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="w-full max-w-60">
                      <Num rotulo="Ou digite o frete" unidade="R$/cabeça" passo={5} valor={freteManual ?? freteEstimado} onChange={setFreteManual} />
                    </div>
                    {freteManual != null && (
                      <button type="button" onClick={() => setFreteManual(null)} className="mb-2 text-sm text-tinta underline underline-offset-4">
                        Voltar ao estimado
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </details>
        </section>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <article className="rounded-2xl border border-linha bg-superficie p-4 sm:p-5" aria-live="polite">
          <p className="text-xs uppercase tracking-wider text-texto-3">
            Resultado · {NOME_ESTRUTURA[estrutura]} · por {qtd}
          </p>
          <p className={`mt-2 inline-block rounded-full border px-4 py-1.5 font-display text-xl font-bold ${meus ? COR_SELO[r.selo] : "border-linha text-texto-2"}`}>{meus ? ROTULO_SELO[r.selo] : "Números de exemplo"}</p>
          <dl className="mt-4 grid grid-cols-2 gap-px sm:grid-cols-3 overflow-hidden rounded-xl border border-linha bg-linha text-center">
            {[
              { t: estrutura === "cria" ? "Sobra por matriz/ano" : "Sobra por cabeça", v: reais(r.margem), cor: !meus ? "text-texto" : r.margem >= 0 ? "text-capim" : "text-alerta" },
              { t: "Por mês", v: reais(r.margemMes), cor: !meus ? "text-texto" : r.margemMes >= 0 ? "text-capim" : "text-alerta" },
              { t: estrutura === "cria" ? "Prazo" : "Dias no negócio", v: numero(r.dias, 0), cor: "text-texto" },
            ].map((x, i) => (
              <div key={x.t} className={`bg-superficie p-3 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
                <dt className="text-xs text-texto-3">{x.t}</dt>
                <dd className={`mt-1 whitespace-nowrap font-display font-bold tabular-nums ${i === 0 ? "text-2xl sm:text-xl" : "text-lg sm:text-xl"} ${x.cor}`}>{x.v}</dd>
              </div>
            ))}
          </dl>

          {meus ? (
            <div className={`mt-4 rounded-xl border-2 ${COR_SELO[r.selo]} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wider">{r.selo === "nao" ? "Por que não compensa" : r.selo === "apertada" ? "Por que está apertado" : "Por que compensa"}</p>
              <p className="mt-1 text-base leading-relaxed text-texto">{porque}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border-2 border-linha bg-fundo p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-texto-2">Ainda não dá para dizer se compensa</p>
              <p className="mt-1 text-base leading-relaxed text-texto">
                Esta conta usa números de exemplo para {EXEMPLO[estrutura].nomes}. Troque pelos da sua fazenda no passo 3 e o veredito aparece aqui.
              </p>
              <button type="button" onClick={() => setMeus(true)} className="mt-3 min-h-11 w-full rounded-lg border border-linha px-4 text-sm text-texto-2 hover:border-tinta hover:text-tinta sm:w-auto">
                Estes números já são os meus
              </button>
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm text-texto-2">
              Para cada {reais(receita)} que entram, {reais(custoTotal)} saem:
            </p>
            <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-fundo" role="img" aria-label="Divisão dos custos">
              {barrasUsadas.map((b) => (
                <div key={b.chave} className={b.cor} style={{ width: `${Math.min(100, (r.partes[b.chave] / Math.max(receita, custoTotal)) * 100)}%` }} title={`${nomeParte(estrutura, b.chave)}: ${reais(r.partes[b.chave])}`} />
              ))}
            </div>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-texto-2 sm:grid-cols-2">
              {barrasUsadas.map((b) => (
                <li key={b.chave} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${b.cor}`} aria-hidden />
                  <span className="flex-1 whitespace-nowrap">{b.chave === "compra" ? (estrutura === "cria" ? "Reposição" : "Animal") : b.chave === "operacao" ? (estrutura === "cria" ? "Custo das matrizes" : "Custo diário") : b.chave === "frete" ? "Frete" : b.chave === "juros" ? "Juros" : estrutura === "cria" ? "Mortes" : "Perdas"}</span>
                  <span className="tabular-nums text-texto">{reais(r.partes[b.chave])}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-linha bg-superficie p-4 sm:p-5">
          <h3 className="font-display text-lg text-texto">E se o preço de venda mudar?</h3>
          <p className="mt-1 text-sm text-texto-2">{descreverEstagio(entradaDoPainel(painel))}</p>
          {cen ? (
            <>
              <p className="mt-3 text-xs text-texto-3">
                Previsão de {cen.semanas} semanas, com a faixa provável{dentroNoTeste != null && `; no teste, o preço real ficou dentro dela em ${pct(dentroNoTeste)} das vezes`}. Seu preço de venda muda na mesma proporção.
              </p>
              <ul className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { t: "Preço no mínimo", x: cen.pior },
                  { t: "Esperado", x: cen.esperado },
                  { t: "Preço no máximo", x: cen.melhor },
                ].map(({ t, x }) => (
                  <li key={t} className="flex flex-col justify-between rounded-lg bg-fundo px-1.5 py-2">
                    <span className="block text-xs text-texto-3">{t}</span>
                    <span className={`mt-0.5 block whitespace-nowrap font-display text-sm font-bold tabular-nums sm:text-base ${!meus ? "text-texto" : x.margem >= 0 ? "text-capim" : "text-alerta"}`}>{reais(x.margem)}</span>
                  </li>
                ))}
              </ul>
              {meus && cen.pior.margem < 0 && r.margem >= 0 && <p className="mt-2 text-sm text-sol">Atenção: se o preço cair ao mínimo da faixa, a conta fica negativa. Vender parte antes ou travar preço na B3 reduz esse risco.</p>}
              {meus && cen.melhor.margem < 0 && <p className="mt-2 text-sm text-alerta">Mesmo com o preço no máximo da faixa, a conta não fecha. O problema está no custo ou no preço pago, não no ciclo.</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-texto-3">Na revenda o preço de venda é o que você combina na hora, por isso não usamos a previsão do modelo.</p>
          )}
        </article>

        <article className="rounded-2xl border border-linha bg-superficie p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg text-texto">Explicação da IA</h3>
            <button type="button" onClick={explicar} disabled={carregando || !meus} className="h-11 rounded-lg border border-tinta/60 px-4 text-sm font-semibold text-tinta hover:bg-tinta/10 disabled:opacity-50">
              {carregando ? "Pensando…" : explicacao ? "Atualizar explicação" : "Explicar com IA"}
            </button>
          </div>
          {erro && <p className="mt-2 text-sm text-alerta">{erro}</p>}
          {explicacao ? (
            <>
              {desatualizada && <p className="mt-2 text-sm text-sol">Você mudou os números. Clique em &quot;Atualizar explicação&quot;.</p>}
              <p className={`mt-2 whitespace-pre-line text-base leading-relaxed ${desatualizada ? "text-texto-3" : "text-texto"}`}>{explicacao.texto}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-texto-3">{meus ? "A conta acima é instantânea. A explicação em texto (IA) só é gerada quando você clica, para não gastar créditos a cada toque." : "Troque os números de exemplo pelos seus para pedir a explicação."}</p>
          )}
        </article>
      </div>

      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">

        {estrutura === "revenda" ? (
          <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-texto">Onde comprar e onde vender</h3>
            <p className="mt-1 text-sm text-texto-2">Melhores pares de estados para boi gordo de 18@, depois do frete e da perda de {numero(e.quebra, 1)}%. Preço à vista da Scot, média dos estados.</p>
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
                  <button type="button" aria-label={`Usar ${p.de} para ${p.para} na conta`} onClick={() => {
                    setUfCompra(p.de);
                    setPracaVenda(Object.keys(painel.pracas?.valores ?? {}).find((n) => ufDaPraca(n) === p.para) ?? "");
                    setFreteManual(null);
                    setExplicacao(null);
                    digitar("compraCab", Math.round(p.compra), true);
                    digitar("vendaCab", Math.round(p.venda), true);
                  }} className={usarCls}>
                    Usar
                  </button>
                </li>
              )}
            />
          </section>
        ) : estrutura !== "cria" ? (
          <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-texto">Onde vender o boi gordo</h3>
            <p className="mt-1 text-sm text-texto-2">
              Praças da Scot, já descontado o frete saindo de {ufFazenda} (carga de {numero(cargaKg / 1000, 1)} t, {reais(rsKm, 2)}/km). Veja se a diferença de preço paga a viagem.
            </p>
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
          </section>
        ) : null}

        {estrutura !== "revenda" && cat && mercadoAnimal.length > 0 && (
          <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-texto">{estrutura === "cria" ? `Onde vender o ${cat.nome.toLowerCase()}` : `Onde comprar o ${cat.nome.toLowerCase()}`}</h3>
            <p className="mt-1 text-sm text-texto-2">
              {cat.nome} Nelore ({cat.ref}), preço médio de cada estado {estrutura === "cria" ? "menos" : "mais"} o frete {estrutura === "cria" ? "saindo de" : "até"} {ufFazenda}. Como quem enche o caminhão onde compensa mais.
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
            <p className="mt-3 text-xs text-texto-3">
              Scot Consultoria, {rep!.data.split("-").reverse().join("/")}, via Notícias Agrícolas. {mercadoAnimal.some((m) => m.marcado) ? "A fonte marca RS e SC com * sem explicar o motivo. " : ""}Frete estimado pela distância, como na conta acima.
              {estrutura === "cria" ? " Na conta, o preço líquido (já sem o frete) entra como preço de venda." : ""}
            </p>
          </section>
        )}

        {(estrutura === "recria" || estrutura === "confinamento") && (
          <section className="rounded-2xl border border-linha bg-superficie/60 p-4 sm:p-5">
            <h3 className="font-display text-lg text-texto">Quanto custa produzir 1 arroba?</h3>
            <p className="mt-2 text-base text-texto-2">
              Com o custo e o ganho de peso acima, cada arroba produzida custa <strong className={custoArroba(e.custoDia, e.gmd) < e.vendaArroba ? "text-capim" : "text-alerta"}>{reais(custoArroba(e.custoDia, e.gmd))}</strong>
              {custoArroba(e.custoDia, e.gmd) < e.vendaArroba ? ", abaixo do preço do boi." : ", acima do preço do boi."}
              <span className="mt-1 block text-xs text-texto-3">Conta: custo diário ÷ (ganho diário ÷ 15 kg). Só conta comida e operação; o animal comprado, o frete e os juros entram na margem acima.</span>
            </p>
          </section>
        )}
      
      </div>

    </div>
  );
}
