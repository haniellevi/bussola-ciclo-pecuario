// Explicação da margem. O cálculo é feito aqui, no servidor, com as mesmas contas da tela.
// O que mais aperta e se o ciclo pesa são contas no código; o modelo do chat (Luna) só escreve o texto curto com os números.
import { cenarios } from "@/lib/cenarios";
import { resolverChave } from "@/lib/chave";
import { aperto, calcular, NOME_ESTRUTURA, nomeParte, type Entradas } from "@/lib/margem";
import { painel } from "@/lib/painel";

export const dynamic = "force-dynamic";

const CAMPOS: (keyof Entradas)[] = [
  "compraCab", "pesoCompra", "pesoVenda", "gmd", "custoDia", "rendimento", "vendaArroba", "mortalidade", "taxaDesmama",
  "custoMatrizAno", "valorMatriz", "vendaBezerro", "descarte", "valorDescarte", "vendaCab", "diasRevenda", "quebra", "frete", "juros",
];
const ESTRUTURAS = ["recria", "confinamento", "cria", "revenda"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });


export async function POST(req: Request) {
  const k = await resolverChave(req);
  if (k instanceof Response) return k;
  const corpo = (await req.json().catch(() => null)) as { entradas?: Record<string, unknown> } | null;
  const b = corpo?.entradas;
  if (!b || !ESTRUTURAS.includes(String(b.estrutura))) return Response.json({ erro: "Entrada inválida." }, { status: 400 });
  const e = { estrutura: b.estrutura } as Entradas;
  for (const c of CAMPOS) {
    const v = Number(b[c]);
    if (!Number.isFinite(v) || v < 0 || v > 1e7) return Response.json({ erro: `Valor inválido em ${c}.` }, { status: 400 });
    (e as Record<string, unknown>)[c] = v;
  }
  const r = calcular(e);
  const cen = cenarios(e, painel, r.dias);

  const estado = {
    estrutura: NOME_ESTRUTURA[e.estrutura],
    resultado: r.selo === "compensa" ? "compensa" : r.selo === "apertada" ? "margem apertada" : "não compensa",
    conta: e.estrutura === "cria" ? "por matriz no ano" : "por cabeça",
    margem_reais: Math.round(r.margem),
    retorno_sobre_capital_pct: +(r.retorno * 100).toFixed(1),
    receita: Math.round(r.receita),
    custos: Object.fromEntries(Object.entries(r.partes).map(([n, v]) => [nomeParte(e.estrutura, n as keyof typeof r.partes), Math.round(v)])),
    dias: r.dias,
    preco_de_empate: Math.round(r.empateVenda),
    margem_se_preco_cair_ao_minimo_da_previsao: cen ? Math.round(cen.pior.margem) : null,
    ciclo: `preço do boi ${painel.fase.sobe ? "subindo" : "caindo"} há ${painel.fase.meses} meses`,
  };

  // O ciclo pesa se, com o preço no mínimo da previsão, a margem fica negativa ou perde mais da metade.
  const cicloPesa = cen ? cen.pior.margem < 0 || cen.pior.margem < r.margem / 2 : null;

  // Cria: conta por matriz no ano, sem animal comprado (a reposição de matrizes já está nos custos).
  const unidade = e.estrutura === "cria" ? "por matriz no ano" : "por cabeça";

  // O que mais aperta: conta exata (lib/margem.ts), sem IA.
  const ap = aperto(e, r);
  const reaisArroba = (v: number) => `${brl(v)} por arroba`;
  const apertoTexto = !ap
    ? null
    : ap.tipo === "compra"
      ? `o preço do animal comprado: você paga ${reaisArroba(ap.pagoArroba)} no animal e vende a ${reaisArroba(ap.vendaArroba)}`
      : ap.tipo === "engorda"
        ? `a engorda: cada arroba que o animal ganha custa ${reaisArroba(ap.custoArroba)} (custo diário ÷ ganho de peso) e é vendida a ${reaisArroba(ap.vendaArroba)}`
        : ap.tipo === "venda"
          ? `o preço: a venda não cobre o que foi pago na compra`
          : `${nomeParte(e.estrutura, ap.parte)}, ${brl(-ap.valor)} ${unidade}`;

  const rotulo = r.selo === "compensa" ? "Compensa" : r.selo === "apertada" ? "Margem apertada" : "Não compensa";
  const mudanca =
    e.estrutura === "cria"
      ? `bezerro vendido por pelo menos ${brl(r.empateVenda)} por cabeça; não fale em preço máximo de compra`
      : e.estrutura === "revenda"
        ? `venda por pelo menos ${brl(r.empateVenda)} por cabeça, ou compra por no máximo ${brl(r.tetoCompra)} por cabeça`
        : `preço de venda de empate ${brl(r.empateVenda)} por arroba, ou o animal comprado por no máximo ${brl(r.tetoCompra)} por cabeça`;
  const luna = process.env.MODELO_AGENTE?.trim();
  if (!luna) return Response.json({ erro: "Modelo do chat não configurado." }, { status: 503 });
  const t = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k.chave}`, "Content-Type": "application/json", "X-Title": "Bussola do Ciclo Pecuario" },
    body: JSON.stringify({
      model: luna,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "Você explica, em português do Brasil simples, o resultado de uma conta de pecuária para quem não é técnico. Use só os números do bloco DADOS, sem inventar nada. " +
            `Em no máximo 5 linhas: (1) comece exatamente com "${rotulo}:" e diga quanto sobra ou falta ${unidade}; (2) numa frase só, diga o maior gasto exatamente como em "Maior gasto" e, se "O que mais aperta" vier preenchido e for outra coisa, ligue os dois sem se contradizer ("O maior gasto é ..., mas o que mais aperta a conta é ..."); (3) diga o que precisaria mudar (${mudanca}); (4) diga se o ciclo é risco para este caso. ` +
            "Nunca cite nomes de modelos, IA, sistemas ou de onde veio cada leitura: fale só da conta. " +
            "Nunca diga para não comprar de forma absoluta: quem compra todo dia precisa decidir onde e a que preço. Não é recomendação de investimento.",
        },
        {
          role: "user",
          content: `DADOS: ${JSON.stringify(estado)}\nMaior gasto: ${nomeParte(e.estrutura, r.principal)}, ${brl(r.partes[r.principal])} ${unidade}\nO que mais aperta: ${apertoTexto ?? "(vazio)"}\nCiclo pesa no resultado: ${cicloPesa == null ? "n/d" : cicloPesa ? "sim" : "não"}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!t) return Response.json({ erro: "A IA não respondeu. Tente de novo." }, { status: 502 });
  const j = await t.json().catch(() => null);
  if (t.status === 401) return Response.json({ erro: k.propria ? "Chave do OpenRouter inválida. Confira na engrenagem." : "A chave do OpenRouter do servidor é inválida." }, { status: 401 });
  const texto = j?.choices?.[0]?.message?.content;
  if (!t.ok || !texto) return Response.json({ erro: j?.error?.message ?? "A IA não respondeu. Tente de novo." }, { status: 502 });
  return Response.json({ texto, aperto: ap?.tipo ?? null, cicloPesa });
}
