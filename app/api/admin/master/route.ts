// Liga e desliga a chave master. Protegido pela senha ADMIN_SENHA (variável de ambiente, nunca no código).
import { createHash, timingSafeEqual } from "node:crypto";
import { gravarMaster, masterLigada, temArmazenamento } from "@/lib/master";

export const dynamic = "force-dynamic";

const hash = (s: string) => createHash("sha256").update(s).digest();
const tentativas = new Map<string, number[]>();

function bloqueado(ip: string) {
  const agora = Date.now();
  const recentes = (tentativas.get(ip) ?? []).filter((t) => agora - t < 600_000);
  tentativas.set(ip, [...recentes, agora]);
  return recentes.length >= 10;
}

export async function POST(req: Request) {
  const senhaCerta = process.env.ADMIN_SENHA?.trim();
  if (!senhaCerta) return Response.json({ erro: "ADMIN_SENHA não está configurada no servidor." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (bloqueado(ip)) return Response.json({ erro: "Muitas tentativas. Espere 10 minutos." }, { status: 429 });

  const { senha, acao } = (await req.json().catch(() => ({}))) as { senha?: string; acao?: string };
  if (typeof senha !== "string" || !timingSafeEqual(hash(senha), hash(senhaCerta))) return Response.json({ erro: "Senha errada." }, { status: 401 });
  tentativas.delete(ip);

  // Logo depois de gravar, o armazenamento pode demorar alguns segundos para mostrar o valor novo: devolvemos o que acabamos de gravar.
  const gravou = acao === "ligar" || acao === "desligar";
  if (gravou) await gravarMaster(acao === "ligar");
  return Response.json({
    ligada: gravou ? acao === "ligar" : await masterLigada(),
    chaveNoServidor: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    persistente: temArmazenamento(),
  });
}
