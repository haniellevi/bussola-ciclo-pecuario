// Repassa a conversa para o OpenRouter com a chave do próprio usuário.
// A chave chega no cabeçalho, é usada só nesta chamada e nunca é gravada nem registrada.
import { painel } from "@/lib/painel";

const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const MODELO_PADRAO = process.env.MODELO_AGENTE ?? "";

type Mensagem = { role: "user" | "assistant"; content: string };

function contexto() {
  const p = painel;
  const prev = (p.previsao?.itens ?? [])
    .map((i) => `${i.alvo} em ${i.semanas} semanas: R$ ${i.previsto.toFixed(0)} (faixa ${i.minimo.toFixed(0)}–${i.maximo.toFixed(0)})`)
    .join("; ");
  return [
    `Dados de ${p.hoje.data}: boi gordo Cepea R$ ${p.hoje.boi}/@, bezerro MS R$ ${p.hoje.bezerro}/cabeça.`,
    `Relação de troca: 1 boi de 18@ compra ${p.troca.atual.toFixed(2)} bezerros (normal 10 anos: ${p.troca.mediana.toFixed(2)}; 25% piores abaixo de ${p.troca.p25.toFixed(2)}).`,
    `Ciclo: preço ${p.fase.sobe ? "subindo" : "caindo"} há ${p.fase.meses} meses desde o ${p.fase.desde?.tipo} de ${p.fase.desde?.mes}. Subidas anteriores duraram ${p.fase.duracaoSubidas.join(", ")} meses; quedas ${p.fase.duracaoQuedas.join(", ")} meses.`,
    `Boi em valores de hoje está em ${((p.fase.realVsPicoAnterior ?? 0) * 100).toFixed(0)}% do último pico.`,
    `Fêmeas no abate (média 12 meses): ${((p.fase.femeas ?? 0) * 100).toFixed(1)}% (média 10 anos ${(p.fase.femeasMedia10 * 100).toFixed(1)}%). No teste, esse dado não previu bem a fase; é só contexto.`,
    `Previsão registrada (${p.previsao?.semana}): ${prev}.`,
  ].join("\n");
}

const SISTEMA = `Você é o Consultor da Bússola do Ciclo Pecuário. Fala português do Brasil, simples, para quem não é técnico. Respostas curtas.
Regras:
- Use só os números do bloco DADOS abaixo ou os que o usuário der. Nunca invente número, porcentagem de risco ou data de pico.
- Quando não souber, diga que não sabe.
- Sempre ligue o conselho ao perfil do usuário (estrutura, capital, experiência, região) e ao momento do ciclo.
- Mostre a conta quando usar um número.
- Não é recomendação de investimento; é leitura estatística de dados públicos. Diga isso quando a pessoa pedir uma decisão de compra ou venda.
- Custo da arroba produzida = custo diário ÷ (ganho diário em kg ÷ 15).`;

export async function POST(req: Request) {
  const chave = req.headers.get("x-openrouter-key")?.trim();
  if (!chave) return Response.json({ erro: "Sem chave do OpenRouter." }, { status: 400 });
  const { mensagens, perfil, modelo } = (await req.json()) as { mensagens: Mensagem[]; perfil?: string; modelo?: string };
  const nomeModelo = (modelo || MODELO_PADRAO).trim();
  if (!nomeModelo) return Response.json({ erro: "Informe o modelo (ex.: empresa/modelo) nas configurações do chat." }, { status: 400 });
  if (!Array.isArray(mensagens) || mensagens.length > 40) return Response.json({ erro: "Conversa inválida." }, { status: 400 });

  const r = await fetch(URL_OPENROUTER, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "X-Title": "Bussola do Ciclo Pecuario" },
    body: JSON.stringify({
      model: nomeModelo,
      messages: [
        { role: "system", content: `${SISTEMA}\n\nDADOS:\n${contexto()}\n\nPERFIL DO USUÁRIO:\n${perfil || "não informado"}` },
        ...mensagens.slice(-20).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
      ],
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);

  if (!r) return Response.json({ erro: "O OpenRouter não respondeu." }, { status: 502 });
  const corpo = await r.json().catch(() => null);
  if (r.status === 401) return Response.json({ erro: "Chave do OpenRouter inválida. Confira na engrenagem." }, { status: 401 });
  if (!r.ok) return Response.json({ erro: corpo?.error?.message ?? `OpenRouter recusou (${r.status}).` }, { status: 502 });
  const texto = corpo?.choices?.[0]?.message?.content;
  if (!texto) return Response.json({ erro: "Resposta vazia do modelo." }, { status: 502 });
  return Response.json({ texto });
}
