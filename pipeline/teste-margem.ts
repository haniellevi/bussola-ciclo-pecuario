// Confere a conta de margem: cada variável precisa mexer no resultado, e os casos de mão batem.
// Uso: node pipeline/teste-margem.ts
import { calcular, type Entradas } from "../lib/margem.ts";
import { distanciaKm, distanciaLocais, fretePorCabeca, localDaPraca } from "../lib/frete.ts";

const base: Entradas = {
  estrutura: "recria", compraCab: 3500, pesoCompra: 240, pesoVenda: 540, gmd: 0.75, custoDia: 6, rendimento: 52,
  vendaArroba: 380, mortalidade: 1.5, taxaDesmama: 75, custoMatrizAno: 900, valorMatriz: 3500, vendaBezerro: 3500, descarte: 20, valorDescarte: 3000,
  vendaCab: 4200, diasRevenda: 20, quebra: 1, frete: 60, juros: 13.65,
};
let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.error("FALHOU:", m); } };

// Caso de mão: 300 kg a 0,75 = 400 dias; 540×52%/15 = 18,72@ × 380 = 7113,6
const r = calcular(base);
ok(r.dias === 400, `dias ${r.dias}`);
ok(Math.abs(r.receita - 18.72 * 380) < 0.01, `receita ${r.receita}`);
ok(Math.abs(r.partes.operacao - 2400) < 0.01, "operação");
const soma = r.receita - r.partes.compra - r.partes.frete - r.partes.operacao - r.partes.juros - r.partes.perdas;
ok(Math.abs(soma - r.margem) < 0.01, "margem = receita − partes");
// Cria de mão: 75% × 3500 + 20% × 3000 = 3225 entram; repõe 20% × 3500 = 700, morrem 1,5% × 3500 = 52,5,
// custo 900, juros 13,65% sobre (3500 + 450) = 539,175 → sobra 1033,325 por matriz
{
  const c = calcular({ ...base, estrutura: "cria" });
  ok(Math.abs(c.receita - 3225) < 0.01, `cria receita ${c.receita}`);
  ok(Math.abs(c.partes.compra - 700) < 0.01 && Math.abs(c.partes.perdas - 52.5) < 0.01, "cria reposição e mortes");
  ok(Math.abs(c.margem - 1033.325) < 0.01, `cria margem ${c.margem}`);
}
// No empate, a margem zera
for (const est of ["recria", "confinamento", "cria", "revenda"] as const) {
  const e = { ...base, estrutura: est };
  const b = calcular(e);
  const campo = est === "cria" ? "vendaBezerro" : est === "revenda" ? "vendaCab" : "vendaArroba";
  // juros dependem do capital, não do preço de venda: o empate vale
  ok(Math.abs(calcular({ ...e, [campo]: b.empateVenda }).margem) < 0.01, `empate ${est}`);
  // Toda variável usada pela estrutura muda o resultado
  const usadas: Record<string, (keyof Entradas)[]> = {
    recria: ["compraCab", "pesoCompra", "pesoVenda", "gmd", "custoDia", "rendimento", "vendaArroba", "mortalidade", "frete", "juros"],
    confinamento: ["compraCab", "pesoCompra", "pesoVenda", "gmd", "custoDia", "rendimento", "vendaArroba", "mortalidade", "frete", "juros"],
    cria: ["taxaDesmama", "custoMatrizAno", "valorMatriz", "vendaBezerro", "descarte", "valorDescarte", "mortalidade", "juros"],
    revenda: ["compraCab", "vendaCab", "diasRevenda", "quebra", "frete", "juros"],
  };
  for (const k of usadas[est]) ok(calcular({ ...e, [k]: (e[k] as number) * 1.2 }).margem !== b.margem, `${est}: ${k} não muda a margem`);
}
// Boi caro e bezerro caro: aperta; boi barato: não compensa; sinal certo
ok(calcular({ ...base, vendaArroba: 500 }).selo === "compensa", "boi alto compensa");
ok(calcular({ ...base, vendaArroba: 250 }).selo === "nao", "boi baixo não compensa");
ok(calcular({ ...base, compraCab: 2000 }).margem > r.margem, "bezerro barato melhora");
// Frete
ok(distanciaKm("SP", "SP") === 150, "dentro do estado");
const d = distanciaKm("SP", "MT");
ok(d > 1200 && d < 2200, `SP→MT ${d} km`);
ok(Math.abs(fretePorCabeca(1000, 10, 300, 24000) - 10000 / 80) < 0.01, "frete por cabeça");
// Cidade da fazenda: Alta Floresta (MT) fica longe de Cuiabá; até a praça MT Norte (Sinop) é bem mais perto
const altaFloresta = { uf: "MT", ponto: [-9.866, -56.086] as [number, number] };
const dSinop = distanciaLocais(altaFloresta, localDaPraca("MT Norte"));
ok(dSinop > 250 && dSinop < 400, `Alta Floresta→Sinop ${dSinop} km`);
ok(distanciaLocais(altaFloresta, { uf: "SP" }) > distanciaKm("MT", "SP"), "cidade longe da capital aumenta a viagem");
ok(distanciaLocais(altaFloresta, { uf: "MT" }) === 150, "mesmo estado sem cidade do outro lado");
ok(distanciaLocais({ uf: "SP", ponto: [-20.553, -48.57] }, localDaPraca("SP Barretos")) === 30, "mesma cidade: mínimo de 30 km");
console.log(falhas ? `${falhas} falha(s)` : "ok: conta de margem confere");
process.exitCode = falhas ? 1 : 0;
