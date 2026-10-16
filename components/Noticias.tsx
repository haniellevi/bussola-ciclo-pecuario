import type { Painel } from "@/lib/painel";

// Selo curto no topo de cada notícia: para onde ela puxa o preço da arroba.
const DIRECAO = {
  sobe: { texto: "↑ Alta", titulo: "Puxa a arroba para cima", cor: "bg-capim/12 text-capim" },
  cai: { texto: "↓ Baixa", titulo: "Puxa a arroba para baixo", cor: "bg-alerta/12 text-alerta" },
  neutro: { texto: "→ Neutra", titulo: "Neutra para o preço", cor: "bg-superficie-2 text-texto-2" },
} as const;

// "2026-10-15" → "quarta, 15 de outubro" (meio-dia evita virar o dia pelo fuso)
const diaPorExtenso = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace("-feira", "");

const VARIAVEL: Record<string, string> = {
  femeas: "Vacas no abate",
  oferta: "Oferta de boi",
  exportacao: "Exportação",
  demanda: "Consumo",
  custos: "Custos",
  clima: "Clima",
  juros: "Juros e dólar",
  politica: "Leis e sanidade",
  mercado: "Preço do dia",
  outro: "Outros",
};

export function Noticias({ noticias }: { noticias: NonNullable<Painel["noticias"]> }) {
  const t = noticias.termometro;
  const variaveis = Object.entries(t.porVariavel).sort((a, b) => b[1].n - a[1].n);
  // Agrupa por dia, mais novo primeiro, para dar respiro entre blocos de notícias
  const dias = [...new Set(noticias.itens.map((n) => n.data))].sort().reverse();
  return (
    <div className="space-y-6">
      {noticias.classificadas && t.relevantes > 0 && (
        <section className="space-y-2.5 rounded-3xl bg-superficie p-5">
          <p className="text-xs font-medium text-texto-3">Saldo da semana</p>
          <p className={`text-2xl font-semibold ${t.saldo > 0.15 ? "text-capim" : t.saldo < -0.15 ? "text-alerta" : "text-texto"}`}>
            {t.saldo > 0.15 ? "De alta" : t.saldo < -0.15 ? "De baixa" : "Equilibrado"} para a arroba
          </p>
          <p className="text-sm text-texto-2">
            {t.relevantes} {t.relevantes === 1 ? "notícia fala" : "notícias falam"} das causas do preço.
          </p>
          <ul className="flex flex-wrap gap-2 pt-1 text-xs">
            {variaveis.map(([v, x]) => (
              <li key={v} className="rounded-full bg-superficie-2 px-3 py-1.5 text-texto-2">
                {VARIAVEL[v] ?? v} · {x.n} {x.saldo > 0 ? "↑" : x.saldo < 0 ? "↓" : "→"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {dias.map((dia) => (
        <section key={dia} className="space-y-3">
          <h3 className="pt-2 text-sm font-semibold text-texto-3 first-letter:uppercase">{diaPorExtenso(dia)}</h3>
          <ul className="grid gap-3 lg:grid-cols-2">
            {noticias.itens
              .filter((n) => n.data === dia)
              .map((n) => (
                <li key={n.link}>
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col gap-2.5 rounded-2xl bg-superficie p-4 transition-shadow hover:shadow-md"
                  >
                    {n.classe && (
                      <span className="flex items-center gap-2 text-xs">
                        <span title={DIRECAO[n.classe.direcao].titulo} className={`rounded-full px-2.5 py-1 font-semibold ${DIRECAO[n.classe.direcao].cor}`}>
                          {DIRECAO[n.classe.direcao].texto}
                        </span>
                        <span className="text-texto-3">{VARIAVEL[n.classe.variavel] ?? n.classe.variavel}</span>
                      </span>
                    )}
                    <span className="text-base leading-snug font-semibold text-texto group-hover:text-tinta">{n.titulo}</span>
                    {n.resumo && <span className="line-clamp-2 text-sm text-texto-3">{n.resumo}</span>}
                    <span className="mt-auto flex items-center justify-between border-t border-superficie-2 pt-2.5 text-xs">
                      <span className="text-texto-3">{n.fonte}</span>
                      <span className="font-medium text-tinta">Ler na fonte ↗</span>
                    </span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="max-w-3xl text-xs leading-relaxed text-texto-3">
        {noticias.classificadas
          ? "A leitura de cada notícia (alta, baixa ou neutra) é automática e pode errar. "
          : "A leitura automática (alta ou baixa) ainda não está ligada. "}
        As notícias ainda não mudam o cálculo do preço: guardamos o saldo de toda semana e ele só entra na conta se, depois de uns 6 meses,
        provar que melhora a previsão.
      </p>
    </div>
  );
}
