"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { reais } from "@/lib/formato";
import type { Painel } from "@/lib/painel";
import { descreverEstagio, veredito, type Perfil } from "@/lib/veredito";
import { entradaDoPainel } from "@/lib/entrada";
import { CHAVE_PERFIL } from "./Decisao";
import { GuiaChave } from "./GuiaChave";

type Msg = { de: "consultor" | "voce"; texto: string };
type Respostas = { estrutura?: string; capital?: string; experiencia?: string; atividade?: string; uf?: string };

const CHAVE_RESPOSTAS = "bussola:anamnese";
const CHAVE_OR = "bussola:openrouter";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const CAPITAL_TETO: Record<string, number> = { "Até R$ 100 mil": 100_000, "R$ 100 mil a 500 mil": 500_000, "R$ 500 mil a 2 milhões": 2_000_000, "Mais de R$ 2 milhões": 0 };

const PERGUNTAS: { campo: keyof Respostas; texto: string; opcoes: string[] }[] = [
  { campo: "estrutura", texto: "Como é a sua terra?", opcoes: ["Terra própria", "Pasto arrendado", "Confinamento", "Parceria ou integração", "Ainda não tenho"] },
  { campo: "capital", texto: "Quanto capital você tem para a pecuária, contando a reserva para 12 meses?", opcoes: Object.keys(CAPITAL_TETO) },
  { campo: "experiencia", texto: "Qual a sua experiência com gado?", opcoes: ["Nenhuma", "Intermediária", "Avançada"] },
  { campo: "atividade", texto: "O que você faz ou quer fazer?", opcoes: ["Cria (vacas e bezerros)", "Recria ou engorda", "Ainda não sei"] },
  { campo: "uf", texto: "Em que estado fica a criação?", opcoes: UFS },
];

const ler = <T,>(k: string, padrao: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
};
const gravar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const perfilDe = (r: Respostas): Perfil =>
  r.experiencia === "Nenhuma" || r.atividade === "Ainda não sei" ? "iniciante" : r.atividade?.startsWith("Cria") ? "cria" : "engorda";

function parecer(painel: Painel, r: Respostas): string {
  const perfil = perfilDe(r);
  const e = entradaDoPainel(painel);
  const v = veredito(perfil, e);
  const linhas = [`Perfil: ${perfil === "cria" ? "Cria" : perfil === "engorda" ? "Recria/Engorda" : "Iniciante"}. Veredito agora: ${v.titulo.toUpperCase()}.`, descreverEstagio(e), ...v.motivos];
  const teto = CAPITAL_TETO[r.capital ?? ""];
  if (teto) {
    const n = Math.floor(teto / painel.hoje.bezerro);
    linhas.push(`Conta do seu capital: ${reais(teto)} compram no máximo ${n} bezerros a ${reais(painel.hoje.bezerro)}, sem sobrar nada para pasto, sal, vacina e imprevistos. Planeje usar no máximo 60% na compra de animais.`);
  }
  if (r.estrutura === "Pasto arrendado") linhas.push("Arrendamento é custo fixo todo mês: com reposição cara, ele aperta a margem. Faça a conta do custo por arroba no simulador.");
  if (r.estrutura === "Confinamento") linhas.push("No confinamento, o que decide é o custo da arroba produzida contra o preço do boi. Use o simulador ao lado.");
  if (r.estrutura === "Ainda não tenho") linhas.push("Sem terra, parceria (boitel ou integração) reduz o capital necessário e o risco de começar.");
  const local = Object.entries(painel.pracas?.valores ?? {}).filter(([n, p]) => n.startsWith(`${r.uf} `) && p.vista);
  if (!local.length && r.uf) linhas.push(`Ainda não temos cotação de praça para ${r.uf} (a Scot cobre só alguns estados). Use a referência de SP, do Cepea, como base.`);
  if (local.length) linhas.push(`Boi gordo no seu estado (Scot): ${local.map(([n, p]) => `${n.slice(3)} ${reais(p.vista!)}`).join(", ")}.`);
  linhas.push(v.venda, "Isto é leitura estatística de dados públicos, não recomendação de investimento.");
  return linhas.join("\n\n");
}

export function ChatConsultor({ painel }: { painel: Painel }) {
  const [resp, setResp] = useState<Respostas>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [config, setConfig] = useState({ chave: "", modelo: "" });
  const [servidor, setServidor] = useState({ servidor: false, masterDesligada: false, modelo: "" });
  const [abrirConfig, setAbrirConfig] = useState(false);
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // Basta colar a chave: o modelo vem do servidor (MODELO_AGENTE) se o campo ficar vazio.
  const iaLigada = (config.chave && (config.modelo || servidor.modelo)) || servidor.servidor;
  const precisaChave = servidor.masterDesligada && !config.chave;
  const passo = PERGUNTAS.findIndex((p) => !resp[p.campo]);
  const pronto = passo === -1;

  useEffect(() => {
    const r = ler<Respostas>(CHAVE_RESPOSTAS, {});
    setResp(r);
    setConfig(ler(CHAVE_OR, { chave: "", modelo: "" }));
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setServidor)
      .catch(() => {});
    const inicio: Msg[] = [{ de: "consultor", texto: "Olá! Sou o Consultor do Ciclo. Cinco perguntas rápidas e eu digo o que o momento do ciclo significa para você." }];
    if (PERGUNTAS.every((p) => r[p.campo])) inicio.push({ de: "consultor", texto: parecer(painel, r) });
    setMsgs(inicio);
  }, [painel]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, passo]);

  const responder = (valor: string) => {
    const p = PERGUNTAS[passo];
    const novo = { ...resp, [p.campo]: valor };
    setResp(novo);
    gravar(CHAVE_RESPOSTAS, novo);
    const adic: Msg[] = [{ de: "consultor", texto: p.texto }, { de: "voce", texto: valor }];
    if (PERGUNTAS.every((q) => novo[q.campo])) {
      try {
        localStorage.setItem(CHAVE_PERFIL, perfilDe(novo));
      } catch {}
      window.dispatchEvent(new Event("bussola:perfil"));
      adic.push({ de: "consultor", texto: parecer(painel, novo) });
    }
    setMsgs((m) => [...m, ...adic]);
  };

  const recomecar = () => {
    setResp({});
    gravar(CHAVE_RESPOSTAS, {});
    setMsgs([{ de: "consultor", texto: "Vamos de novo." }]);
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;
    setTexto("");
    const historico = [...msgs, { de: "voce" as const, texto: pergunta }];
    setMsgs(historico);
    if (!iaLigada) {
      setMsgs((m) => [...m, { de: "consultor", texto: precisaChave ? "A chave compartilhada está desligada. Siga o passo a passo acima para colocar a sua chave." : "Para conversar livremente, cole sua chave do OpenRouter na engrenagem acima. Sem isso, eu respondo só pelo roteiro." }]);
      setAbrirConfig(true);
      return;
    }
    setPensando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(config.chave ? { "x-openrouter-key": config.chave } : {}) },
        body: JSON.stringify({
          modelo: config.modelo || servidor.modelo,
          perfil: Object.entries(resp).map(([k, v]) => `${k}: ${v}`).join("; "),
          mensagens: historico.slice(1).map((m) => ({ role: m.de === "voce" ? "user" : "assistant", content: m.texto })),
        }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, { de: "consultor", texto: j.texto ?? `Não consegui responder: ${j.erro}` }]);
    } catch {
      setMsgs((m) => [...m, { de: "consultor", texto: "Sem conexão com o servidor. Tente de novo." }]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="flex h-[36rem] flex-col rounded-2xl border border-terra-700 bg-terra-900">
      <header className="flex items-center justify-between border-b border-terra-700 px-4 py-3">
        <div>
          <p className="font-display text-lg text-zinc-100">Consultor do Ciclo</p>
          <p className="text-xs text-zinc-500">{iaLigada ? `IA ligada · ${config.modelo || servidor.modelo}` : "Roteiro com as regras do app"}</p>
        </div>
        <div className="flex gap-1">
          {pronto && (
            <button onClick={recomecar} className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-terra-800 hover:text-zinc-100">
              Refazer perguntas
            </button>
          )}
          <button
            onClick={() => setAbrirConfig((v) => !v)}
            aria-expanded={abrirConfig}
            aria-label="Configurar IA"
            className="rounded-lg px-2.5 py-1.5 text-zinc-400 hover:bg-terra-800 hover:text-zinc-100"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      {precisaChave && (
        <div role="alert" className="max-h-64 shrink-0 overflow-y-auto border-b border-sol/30 bg-sol/10 p-4">
          <p className="text-sm font-medium text-sol">A chave compartilhada foi desligada. Coloque a sua chave do OpenRouter para conversar com a IA.</p>
          <div className="mt-3">
            <GuiaChave />
          </div>
          <button onClick={() => setAbrirConfig(true)} className="mt-3 rounded-lg bg-sol px-3 py-1.5 text-xs font-semibold text-terra-950">
            Abrir a engrenagem
          </button>
        </div>
      )}

      <AnimatePresence>
        {abrirConfig && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-terra-700 bg-terra-950/60"
            onSubmit={(e) => {
              e.preventDefault();
              gravar(CHAVE_OR, config);
              setAbrirConfig(false);
            }}
          >
            <div className="space-y-3 p-4 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-400">Chave do OpenRouter (fica só neste navegador)</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={config.chave}
                  onChange={(e) => setConfig({ ...config, chave: e.target.value })}
                  placeholder="sk-or-..."
                  className="mt-1 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">Modelo (pode deixar vazio)</span>
                <input
                  value={config.modelo}
                  onChange={(e) => setConfig({ ...config, modelo: e.target.value })}
                  placeholder={servidor.modelo || "empresa/modelo"}
                  className="mt-1 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 py-2"
                />
              </label>
              <button className="rounded-lg bg-sol px-4 py-2 text-sm font-semibold text-terra-950">Salvar</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, k) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.de === "voce" ? "ml-auto bg-sol/15 text-zinc-100" : "bg-terra-800 text-zinc-200"
            }`}
          >
            {m.texto}
          </motion.div>
        ))}
        {!pronto && passo >= 0 && (
          <div className="space-y-2">
            <div className="max-w-[88%] rounded-2xl bg-terra-800 px-4 py-2.5 text-sm text-zinc-200">{PERGUNTAS[passo].texto}</div>
            {PERGUNTAS[passo].campo === "uf" ? (
              <select
                defaultValue=""
                onChange={(e) => e.target.value && responder(e.target.value)}
                aria-label="Estado"
                className="rounded-lg border border-terra-700 bg-terra-950 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Escolha o estado
                </option>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {PERGUNTAS[passo].opcoes.map((o) => (
                  <button
                    key={o}
                    onClick={() => responder(o)}
                    className="rounded-full border border-terra-700 px-3.5 py-1.5 text-sm text-zinc-200 transition-colors hover:border-sol hover:text-sol"
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {pensando && <p className="text-xs text-zinc-500">Consultor pensando…</p>}
        <div ref={fim} />
      </div>

      {pronto && (
        <form onSubmit={enviar} className="flex gap-2 border-t border-terra-700 p-3">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte sobre o seu caso…"
            aria-label="Sua pergunta"
            className="min-w-0 flex-1 rounded-lg border border-terra-700 bg-terra-950 px-3 py-2 text-sm"
          />
          <button disabled={pensando} className="rounded-lg bg-sol px-4 py-2 text-sm font-semibold text-terra-950 disabled:opacity-50">
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
