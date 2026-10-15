// Interruptor da chave master (a chave do dono, que paga o chat de todos).
// Ligada: quem não tem chave própria usa a do servidor. Desligada: cada pessoa precisa da sua.
// O estado fica num arquivo do Vercel Blob (BLOB_READ_WRITE_TOKEN); sem o token (rodando local), fica na memória.
import { head, put } from "@vercel/blob";

const ARQUIVO = "bussola-master.json";
let memoria = true;

export const temArmazenamento = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function masterLigada(): Promise<boolean> {
  if (!temArmazenamento()) return memoria;
  try {
    const meta = await head(ARQUIVO);
    const r = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    return (await r.json()).ligada !== false;
  } catch {
    return true; // arquivo ainda não existe = nunca foi desligada
  }
}

export async function gravarMaster(ligada: boolean) {
  memoria = ligada;
  if (!temArmazenamento()) return;
  await put(ARQUIVO, JSON.stringify({ ligada, em: new Date().toISOString() }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}
