// Passo a passo para quem precisa da própria chave do OpenRouter (usado no aviso e no chat).
const PASSOS = [
  <>
    Entre em{" "}
    <a className="underline underline-offset-2 hover:text-sol" href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">
      openrouter.ai
    </a>{" "}
    e crie uma conta.
  </>,
  <>
    Em <strong className="text-zinc-200">Credits</strong>, adicione um valor pequeno para começar. O OpenRouter mostra o preço de cada modelo antes de você usar.
  </>,
  <>
    Abra{" "}
    <a className="underline underline-offset-2 hover:text-sol" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">
      openrouter.ai/settings/keys
    </a>
    , clique em <strong className="text-zinc-200">Create Key</strong> e copie a chave (começa com <code className="text-zinc-300">sk-or-</code>).
  </>,
  <>
    Aqui no Consultor, clique na <strong className="text-zinc-200">engrenagem</strong>, cole a chave e clique em <strong className="text-zinc-200">Salvar</strong>. Deixe o modelo
    vazio.
  </>,
];

export function GuiaChave() {
  return (
    <ol className="space-y-2 text-sm leading-relaxed text-zinc-300">
      {PASSOS.map((p, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sol/20 text-xs font-semibold text-sol">{i + 1}</span>
          <span>{p}</span>
        </li>
      ))}
      <li className="pl-8 text-xs text-zinc-500">A chave fica só no seu navegador. Nós não guardamos.</li>
    </ol>
  );
}
