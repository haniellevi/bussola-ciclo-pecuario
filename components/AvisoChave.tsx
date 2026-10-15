"use client";

import { useEffect, useState } from "react";

// Faixa no topo para quem ainda não tem chave própria quando o dono desliga a chave master.
export function AvisoChave() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    let minha = false;
    try {
      minha = Boolean(JSON.parse(localStorage.getItem("bussola:openrouter") ?? "{}").chave);
    } catch {}
    if (minha) return;
    fetch("/api/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMostrar(Boolean(j.masterDesligada)))
      .catch(() => {});
  }, []);
  if (!mostrar) return null;
  return (
    <div role="alert" className="border-b border-sol/30 bg-sol/10 px-4 py-2.5 text-center text-sm text-sol">
      A chave compartilhada do chat foi desligada. Para conversar com a IA, configure a sua chave do OpenRouter.{" "}
      <a href="#consultor" className="font-semibold underline underline-offset-2">
        Ver o passo a passo
      </a>
    </div>
  );
}
