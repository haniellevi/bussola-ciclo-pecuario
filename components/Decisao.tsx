"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { numero, reais } from "@/lib/formato";
import { entradaDoPainel } from "@/lib/entrada";
import type { Painel } from "@/lib/painel";
import { custoArroba, descreverEstagio, estagio, NOME_ESTAGIO, relacaoTroca, veredito, type Estagio, type Perfil, type Selo } from "@/lib/veredito";

export const PERFIS: { id: Perfil; nome: string; quem: string }[] = [
  { id: "cria", nome: "Cria", quem: "Tenho vacas e vendo bezerros" },
  { id: "engorda", nome: "Recria / Engorda", quem: "Compro bezerro ou boi magro e vendo boi gordo" },
  { id: "iniciante", nome: "Iniciante", quem: "Estou pensando em começar" },
];

export const CHAVE_PERFIL = "bussola:perfil";

const COR_SELO: Record<Selo, string> = {
  melhor: "border-capim/60 bg-capim/10 text-capim",
  bom: "border-sol/60 bg-sol/10 text-sol",
  aguarde: "border-alerta/60 bg-alerta/10 text-alerta",
};

const lerPerfil = (): Perfil => {
  try {
    const v = localStorage.getItem(CHAVE_PERFIL);
    if (v === "cria" || v === "engorda" || v === "iniciante") return v;
  } catch {}
  return "iniciante";
};

function Campo({ rotulo, valor, children }: { rotulo: string; valor: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-zinc-400">
        <span>{rotulo}</span>
        <span className="tabular-nums text-zinc-100">{valor}</span>
      </span>
      {children}
    </label>
  );
}

const deslizar = "mt-2 w-full accent-[var(--color-sol)]";

export function Decisao({ painel }: { painel: Painel }) {
  const [perfil, setPerfil] = useState<Perfil>("iniciante");
  const [boi, setBoi] = useState(painel.hoje.boi);
  const [bezerro, setBezerro] = useState(painel.hoje.bezerro);
  const [praca, setPraca] = useState("");
  const [custoDia, setCustoDia] = useState(18);
  const [gmd, setGmd] = useState(1.4);
  const [faseSim, setFaseSim] = useState<Estagio | "">("");

  useEffect(() => {
    setPerfil(lerPerfil());
    const ouvir = () => setPerfil(lerPerfil());
    window.addEventListener("bussola:perfil", ouvir);
    return () => window.removeEventListener("bussola:perfil", ouvir);
  }, []);

  const escolher = (p: Perfil) => {
    setPerfil(p);
    try {
      localStorage.setItem(CHAVE_PERFIL, p);
    } catch {}
  };

  const escolherPraca = (nome: string) => {
    setPraca(nome);
    const v = nome && painel.pracas?.valores[nome]?.vista;
    setBoi(v || painel.hoje.boi);
  };

  const entrada = entradaDoPainel(painel, boi, bezerro);
  const faseReal = estagio(entrada);
  const v = veredito(perfil, entrada, faseSim || undefined);
  const rt = relacaoTroca(boi, bezerro);
  const alterado = Math.abs(boi - painel.hoje.boi) > 0.5 || Math.abs(bezerro - painel.hoje.bezerro) > 5;
  // Melhor caso possível nos controles (boi no máximo, bezerro no mínimo): se nem ele muda o selo, o preço não decide nesta fase.
  const melhorCaso = veredito(perfil, entradaDoPainel(painel, Math.round(painel.hoje.boi * 1.4), Math.round(painel.hoje.bezerro * 0.6)), faseSim || undefined);
  const precoNaoDecide = melhorCaso.selo === v.selo && v.selo === "aguarde";
  const ca = custoArroba(custoDia, gmd);
  const pracas = Object.entries(painel.pracas?.valores ?? {}).filter(([, p]) => p.vista);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div role="tablist" aria-label="Seu perfil" className="grid grid-cols-3 gap-1 rounded-xl bg-terra-900 p-1">
          {PERFIS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={perfil === p.id}
              onClick={() => escolher(p.id)}
              className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                perfil === p.id ? "bg-terra-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{PERFIS.find((p) => p.id === perfil)!.quem}</p>

        <AnimatePresence mode="wait">
          <motion.article
            key={`${perfil}-${v.selo}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-4 rounded-2xl border border-terra-700 bg-terra-900 p-5"
            aria-live="polite"
          >
            <p className="text-xs uppercase tracking-wider text-zinc-500">Veredito de compra{alterado ? " (com os seus preços)" : ""}{faseSim ? ` · simulando: ${NOME_ESTAGIO[faseSim]}` : ""}</p>
            <p className={`mt-2 inline-block rounded-full border px-4 py-1.5 font-display text-xl font-semibold ${COR_SELO[v.selo]}`}>{v.titulo}</p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-300">
              <li className="text-zinc-400">{faseSim ? `Cenário: e se o ciclo estivesse em ${NOME_ESTAGIO[faseSim]}? (hoje está em ${NOME_ESTAGIO[faseReal]}.)` : descreverEstagio(entrada)}</li>
              {v.motivos.map((m) => (
                <li key={m} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                  {m}
                </li>
              ))}
            </ul>
            {v.pontos && (
              <p className="mt-4 rounded-lg bg-terra-950 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                Conta dos pontos: fase do ciclo <strong className="text-zinc-200">{v.pontos.ciclo > 0 ? "+" : ""}{v.pontos.ciclo}</strong>
                {perfil === "engorda" && <> + relação de troca <strong className="text-zinc-200">{v.pontos.troca > 0 ? "+" : ""}{v.pontos.troca}</strong></>} = <strong className="text-zinc-200">{v.pontos.total > 0 ? "+" : ""}{v.pontos.total}</strong>.
                {" "}1 ponto vira &quot;Bom para comprar&quot; e 2 viram &quot;Melhor momento&quot;.
              </p>
            )}
            {perfil === "iniciante" && <p className="mt-3 text-xs text-zinc-500">O Iniciante recebe o pior selo entre Cria e Engorda: por cautela, só compra quando os dois estão bons.</p>}
            {precoNaoDecide && (
              <p className="mt-3 rounded-lg border border-sol/30 bg-sol/10 px-3 py-2 text-sm text-sol">
                Nesta fase do ciclo, nenhum preço do boi ou do bezerro muda o veredito: o que pesa é o momento do ciclo. Para ver o veredito reagir, simule outra fase ao lado.
              </p>
            )}
            <p className="mt-4 border-t border-terra-700 pt-4 text-sm leading-relaxed text-zinc-300">{v.venda}</p>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border border-terra-700 bg-terra-900/60 p-5">
        <h3 className="font-display text-lg text-zinc-100">Simule com os seus preços</h3>
        <p className="mt-1 text-xs text-zinc-500">Mexa nos preços e na fase do ciclo: o veredito reage na hora.</p>
        <div className="mt-4 space-y-5">
          <label className="block">
            <span className="text-xs text-zinc-400">E se o ciclo estivesse em outra fase?</span>
            <select value={faseSim} onChange={(e) => setFaseSim(e.target.value as Estagio | "")} className="mt-2 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 py-2 text-sm">
              <option value="">Fase de hoje ({NOME_ESTAGIO[faseReal]})</option>
              {(Object.keys(NOME_ESTAGIO) as Estagio[]).map((e) => (
                <option key={e} value={e}>
                  Simular: {NOME_ESTAGIO[e]}
                </option>
              ))}
            </select>
          </label>
          {pracas.length > 0 && (
            <label className="block">
              <span className="text-xs text-zinc-400">Sua praça (boi gordo à vista, Scot {painel.pracas!.data.split("-").reverse().join("/")}; só {new Set(pracas.map(([n]) => n.slice(0, 2))).size} estados: {[...new Set(pracas.map(([n]) => n.slice(0, 2)))].join(", ")})</span>
              <select
                value={praca}
                onChange={(e) => escolherPraca(e.target.value)}
                className="mt-2 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 py-2 text-sm"
              >
                <option value="">Referência Cepea (SP)</option>
                {pracas.map(([nome, p]) => (
                  <option key={nome} value={nome}>
                    {nome} — {reais(p.vista!)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Campo rotulo="Boi gordo (R$/@)" valor={reais(boi)}>
            <input type="range" min={Math.round(painel.hoje.boi * 0.6)} max={Math.round(painel.hoje.boi * 1.4)} step={1} value={boi} onChange={(e) => setBoi(+e.target.value)} className={deslizar} />
          </Campo>
          <Campo rotulo="Bezerro (R$/cabeça)" valor={reais(bezerro)}>
            <input type="range" min={Math.round(painel.hoje.bezerro * 0.6)} max={Math.round(painel.hoje.bezerro * 1.4)} step={10} value={bezerro} onChange={(e) => setBezerro(+e.target.value)} className={deslizar} />
          </Campo>
          <p className="rounded-lg bg-terra-950 px-3 py-2 text-sm text-zinc-300">
            1 boi de 18@ compra <strong className="text-zinc-50">{numero(rt)}</strong> bezerros
            <span className="block text-xs text-zinc-500">Normal dos últimos 10 anos: {numero(painel.troca.mediana)}</span>
          </p>
          {alterado && (
            <button
              onClick={() => {
                setBoi(painel.hoje.boi);
                setBezerro(painel.hoje.bezerro);
                setPraca("");
              }}
              className="text-xs text-sol underline underline-offset-4"
            >
              Voltar aos preços de hoje
            </button>
          )}

          <div className="border-t border-terra-700 pt-4">
            <p className="text-sm font-medium text-zinc-200">Quanto custa produzir 1 arroba?</p>
            <p className="mt-1 text-xs text-zinc-500">Os valores iniciais são só um exemplo. Troque pelos da sua fazenda.</p>
            <div className="mt-3 space-y-4">
              <Campo rotulo="Custo por animal por dia (comida + operação)" valor={reais(custoDia, 2)}>
                <input type="range" min={3} max={40} step={0.5} value={custoDia} onChange={(e) => setCustoDia(+e.target.value)} className={deslizar} />
              </Campo>
              <Campo rotulo="Ganho de peso por dia" valor={`${numero(gmd, 2)} kg`}>
                <input type="range" min={0.2} max={2} step={0.05} value={gmd} onChange={(e) => setGmd(+e.target.value)} className={deslizar} />
              </Campo>
              <p className="text-sm text-zinc-300">
                Cada arroba produzida custa <strong className={ca < boi ? "text-capim" : "text-alerta"}>{reais(ca)}</strong>
                {ca < boi ? " — abaixo do preço do boi." : " — acima do preço do boi: engordar não compensa."}
                <span className="block text-xs text-zinc-500">Conta: custo diário ÷ (ganho diário ÷ 15 kg). Só conta comida e operação: o bezerro comprado, o pasto e os juros ficam de fora.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
