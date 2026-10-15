import type { Metadata } from "next";
import { AdminMaster } from "@/components/AdminMaster";

export const metadata: Metadata = { title: "Admin · Bússola do Ciclo Pecuário", robots: { index: false, follow: false } };

export default function Admin() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl text-zinc-50">Chave master</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Ligada: o chat funciona para todos com a sua chave do OpenRouter. Desligada: cada pessoa precisa colocar a própria chave, e todos recebem um
        aviso com o passo a passo.
      </p>
      <AdminMaster />
    </main>
  );
}
