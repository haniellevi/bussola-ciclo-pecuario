"use client";

import { useState } from "react";

type Estado = { ligada: boolean; chaveNoServidor: boolean; persistente: boolean };

export function AdminMaster() {
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const chamar = async (acao: "status" | "ligar" | "desligar") => {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/master", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha, acao }) });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.erro ?? "Não deu certo.");
        if (r.status === 401) setEstado(null);
      } else setEstado(j);
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  if (!estado)
    return (
      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          chamar("status");
        }}
      >
        <label className="block text-sm text-zinc-300">
          Senha de administrador
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-terra-700 bg-terra-950 px-3 py-2"
          />
        </label>
        <button disabled={carregando || !senha} className="rounded-lg bg-sol px-4 py-2 text-sm font-semibold text-terra-950 disabled:opacity-50">
          Entrar
        </button>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      </form>
    );

  return (
    <div className="mt-8 space-y-4">
      <div className={`rounded-2xl border p-5 ${estado.ligada ? "border-capim/40 bg-capim/5" : "border-alerta/40 bg-alerta/5"}`}>
        <p className="text-xs text-zinc-500">Agora</p>
        <p className={`font-display text-2xl ${estado.ligada ? "text-capim" : "text-alerta"}`}>{estado.ligada ? "Master LIGADA" : "Master DESLIGADA"}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {estado.ligada ? "Quem não tem chave própria usa a sua (limite de 20 perguntas por hora por pessoa)." : "Todos precisam da própria chave. Quem não tem vê o aviso."}
        </p>
      </div>
      <button
        disabled={carregando}
        onClick={() => chamar(estado.ligada ? "desligar" : "ligar")}
        className={`w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 ${estado.ligada ? "bg-alerta text-terra-950" : "bg-capim text-terra-950"}`}
      >
        {estado.ligada ? "Desligar a chave master" : "Ligar a chave master"}
      </button>
      {!estado.chaveNoServidor && <p className="text-sm text-sol">Atenção: o servidor ainda não tem OPENROUTER_API_KEY. Ligada ou não, o chat compartilhado não funciona.</p>}
      {!estado.persistente && <p className="text-sm text-sol">Atenção: sem armazenamento (Vercel Blob), o estado vale só até o servidor reiniciar.</p>}
      <p className="text-xs text-zinc-500">A mudança chega aos visitantes em até 1 minuto.</p>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
    </div>
  );
}
