// Decide qual chave do OpenRouter paga a chamada: a da própria pessoa (cabeçalho, nunca gravada)
// ou a do servidor (chave master), esta com limite por visitante e interruptor do dono.
import { masterLigada } from "./master.ts";

const CHAVE_SERVIDOR = process.env.OPENROUTER_API_KEY?.trim() ?? "";
const LIMITE_POR_HORA = Number(process.env.CHAT_LIMITE_HORA ?? 20);
const usos = new Map<string, number[]>();

function dentroDoLimite(ip: string) {
  const agora = Date.now();
  const recentes = (usos.get(ip) ?? []).filter((t) => agora - t < 3_600_000);
  if (recentes.length >= LIMITE_POR_HORA) return false;
  usos.set(ip, [...recentes, agora]);
  return true;
}

export async function resolverChave(req: Request): Promise<{ chave: string; propria: boolean } | Response> {
  const propria = req.headers.get("x-openrouter-key")?.trim();
  if (!propria && !(await masterLigada()))
    return Response.json({ erro: "Configure a sua chave do OpenRouter na engrenagem do Consultor.", masterDesligada: true }, { status: 403 });
  const chave = propria || CHAVE_SERVIDOR;
  if (!chave) return Response.json({ erro: "Sem chave do OpenRouter." }, { status: 400 });
  if (!propria && !dentroDoLimite(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"))
    return Response.json({ erro: "Limite de perguntas por hora atingido. Tente mais tarde." }, { status: 429 });
  return { chave, propria: Boolean(propria) };
}
