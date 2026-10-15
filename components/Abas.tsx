"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Aba = { id: string; rotulo: string; conteudo: React.ReactNode };

// Abas com endereço (#conhecimento abre a aba certa). Todas as abas ficam montadas, só escondidas:
// assim a conversa do Consultor não se perde ao trocar de aba.
export function Abas({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const ir = useCallback(
    (id: string, rolar = true) => {
      if (!abas.some((a) => a.id === id)) return;
      setAtiva(id);
      if (rolar) window.scrollTo({ top: 0 });
    },
    [abas],
  );

  useEffect(() => {
    refs.current[ativa]?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [ativa]);

  useEffect(() => {
    const doEndereco = () => ir(location.hash.slice(1), false);
    doEndereco();
    window.addEventListener("hashchange", doEndereco);
    return () => window.removeEventListener("hashchange", doEndereco);
  }, [ir]);

  const escolher = (id: string) => {
    history.replaceState(null, "", `#${id}`);
    ir(id);
  };

  const teclado = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const alvo = abas[(i + d + abas.length) % abas.length].id;
    escolher(alvo);
    refs.current[alvo]?.focus();
  };

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-terra-800 bg-terra-950/90 backdrop-blur">
        <div role="tablist" aria-label="Seções do site" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {abas.map((a, i) => (
            <button
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={ativa === a.id}
              aria-controls={`painel-${a.id}`}
              tabIndex={ativa === a.id ? 0 : -1}
              onClick={() => escolher(a.id)}
              onKeyDown={(e) => teclado(e, i)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                ativa === a.id ? "border-sol text-sol" : "border-transparent text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {abas.map((a) => (
          <div key={a.id} role="tabpanel" id={`painel-${a.id}`} aria-labelledby={`aba-${a.id}`} hidden={ativa !== a.id} className="py-8 sm:py-12">
            {a.conteudo}
          </div>
        ))}
      </div>
    </>
  );
}
