import { dataBr } from "@/lib/formato";
import type { Painel } from "@/lib/painel";

const DIRECAO = {
  sobe: { texto: "puxa a arroba para cima", cor: "border-capim/50 text-capim" },
  cai: { texto: "puxa a arroba para baixo", cor: "border-alerta/50 text-alerta" },
  neutro: { texto: "neutra para o preço", cor: "border-linha text-texto-3" },
} as const;

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
  return (
    <div className="space-y-5">
      {noticias.classificadas && t.relevantes > 0 && (
        <div className="rounded-2xl border border-linha bg-superficie/60 p-5">
          <p className="text-sm text-texto-2">
            Das {t.relevantes} notícias desta semana que falam das causas do preço, o saldo é{" "}
            <strong className={t.saldo > 0.15 ? "text-capim" : t.saldo < -0.15 ? "text-alerta" : "text-texto"}>
              {t.saldo > 0.15 ? "de alta" : t.saldo < -0.15 ? "de baixa" : "equilibrado"}
            </strong>{" "}
            para a arroba.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {variaveis.map(([v, x]) => (
              <li key={v} className="rounded-full border border-linha px-3 py-1 text-texto-3">
                {VARIAVEL[v] ?? v}: {x.n} {x.saldo > 0 ? "↑" : x.saldo < 0 ? "↓" : "→"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="divide-y divide-linha rounded-2xl border border-linha">
        {noticias.itens.map((n) => (
          <li key={n.link} className="px-4 py-3">
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm text-texto-2 hover:text-tinta">
              {n.titulo}
            </a>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-3">
              <span>
                {n.fonte}, {dataBr(n.data)}
              </span>
              {n.classe && (
                <>
                  <span className={`rounded-full border px-2 py-0.5 ${DIRECAO[n.classe.direcao].cor}`}>{DIRECAO[n.classe.direcao].texto}</span>
                  <span>{VARIAVEL[n.classe.variavel] ?? n.classe.variavel}</span>
                </>
              )}
            </p>
            {n.resumo && <p className="mt-1 line-clamp-2 text-xs text-texto-3">{n.resumo}</p>}
          </li>
        ))}
      </ul>
      <p className="max-w-3xl text-xs leading-relaxed text-texto-3">
        {noticias.classificadas
          ? "A leitura de cada notícia é feita por IA e pode errar. "
          : "A leitura automática (alta ou baixa) liga quando a chave do OpenRouter estiver configurada. "}
        As notícias ainda não mudam o cálculo: guardamos o saldo de toda semana e ele só entra no modelo se, depois de uns 6 meses, provar
        que melhora a previsão.
      </p>
    </div>
  );
}
