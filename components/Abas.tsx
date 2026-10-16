"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Aba = { id: string; rotulo: string; conteudo: React.ReactNode };

// Ícones de traço, mesmo peso do texto. Só enfeitam: o nome da aba vai sempre junto.
const ICONE: Record<string, React.ReactNode> = {
  hoje: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" /></>,
  previsao: <><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></>,
  noticias: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  conhecimento: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
  consultor: <><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" /></>,
};

// Abas com endereço (#conhecimento abre a aba certa). Todas as abas ficam montadas, só escondidas:
// assim a conversa do Consultor não se perde ao trocar de aba.
export function Abas({ abas, marca }: { abas: Aba[]; marca: React.ReactNode }) {
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
      {/* Celular: o nome do app fica no topo e as abas embaixo, perto do dedão. Computador: tudo numa barra no topo. */}
      <div className="mx-auto max-w-6xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:hidden">{marca}</div>
      <nav className="vidro fixed inset-x-0 bottom-0 z-20 border-t border-linha pb-[env(safe-area-inset-bottom)] sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:pb-0">
        <div className="mx-auto flex max-w-6xl items-center sm:gap-6 sm:px-6 sm:py-2.5">
          <div className="hidden sm:block">{marca}</div>
          <div role="tablist" aria-label="Seções do site" className="mx-auto flex w-full max-w-lg px-1 py-1 sm:mr-0 sm:ml-auto sm:w-auto sm:max-w-none sm:gap-1 sm:p-0">
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
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.6875rem] font-medium tracking-tight transition-colors sm:min-h-10 sm:flex-none sm:rounded-full sm:px-4 sm:text-sm ${
                  ativa === a.id ? "text-tinta sm:bg-superficie-2 sm:text-texto" : "text-texto-3 hover:text-texto"
                }`}
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 sm:hidden" fill="none" stroke="currentColor" strokeWidth={ativa === a.id ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                  {ICONE[a.id]}
                </svg>
                {a.rotulo}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {abas.map((a) => (
          <div key={a.id} role="tabpanel" id={`painel-${a.id}`} aria-labelledby={`aba-${a.id}`} hidden={ativa !== a.id} className="py-6 sm:py-12">
            {a.conteudo}
          </div>
        ))}
      </div>
    </>
  );
}
