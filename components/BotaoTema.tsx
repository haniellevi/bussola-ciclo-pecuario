"use client";

import { useEffect, useState } from "react";
import { CHAVE_TEMA } from "@/lib/tema";

// Tema: automático (segue o aparelho), claro ou escuro. A escolha fica só neste navegador.
type Tema = "auto" | "claro" | "escuro";
const ORDEM: Tema[] = ["auto", "claro", "escuro"];
const NOME: Record<Tema, string> = { auto: "Automático", claro: "Claro", escuro: "Escuro" };
const COR_BARRA = { claro: "#f3f4f0", escuro: "#0d1210" };

function aplicar(t: Tema) {
  const html = document.documentElement;
  if (t === "auto") delete html.dataset.tema;
  else html.dataset.tema = t;
  // Cor da barra do navegador no celular
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.dataset.original ??= m.content;
    m.content = t === "auto" ? m.dataset.original : COR_BARRA[t];
  });
}

const ICONE: Record<Tema, React.ReactNode> = {
  auto: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>,
  claro: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  escuro: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
};

export function BotaoTema() {
  const [tema, setTema] = useState<Tema>("auto");

  // Há um botão no topo do celular e outro na barra do computador: os dois seguem a mesma escolha.
  useEffect(() => {
    const ler = () => {
      try {
        const t = localStorage.getItem(CHAVE_TEMA);
        setTema(t === "claro" || t === "escuro" ? t : "auto");
        if (t === "claro" || t === "escuro") aplicar(t);
      } catch {}
    };
    ler();
    window.addEventListener(CHAVE_TEMA, ler);
    return () => window.removeEventListener(CHAVE_TEMA, ler);
  }, []);

  const trocar = () => {
    const t = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
    setTema(t);
    aplicar(t);
    try {
      if (t === "auto") localStorage.removeItem(CHAVE_TEMA);
      else localStorage.setItem(CHAVE_TEMA, t);
    } catch {}
    window.dispatchEvent(new Event(CHAVE_TEMA));
  };

  return (
    <button
      type="button"
      onClick={trocar}
      aria-label={`Cores: ${NOME[tema]}. Toque para trocar.`}
      title="Trocar as cores: automático, claro ou escuro"
      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-superficie-2 px-3 text-xs font-medium text-texto-2 hover:text-texto"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {ICONE[tema]}
      </svg>
      {NOME[tema]}
    </button>
  );
}
