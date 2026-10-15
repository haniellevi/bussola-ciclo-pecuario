// Distância e frete estimados entre estados. É estimativa: linha reta entre as capitais, com um ajuste para estrada.
// Coordenadas das capitais (fatos geográficos). O ajuste e o mínimo dentro do estado são hipóteses declaradas na tela.
const CAPITAIS: Record<string, [number, number]> = {
  AC: [-9.97, -67.81], AL: [-9.67, -35.74], AM: [-3.12, -60.02], AP: [0.03, -51.07], BA: [-12.97, -38.51],
  CE: [-3.73, -38.52], DF: [-15.79, -47.88], ES: [-20.32, -40.34], GO: [-16.68, -49.25], MA: [-2.53, -44.3],
  MG: [-19.92, -43.94], MS: [-20.47, -54.62], MT: [-15.6, -56.1], PA: [-1.46, -48.5], PB: [-7.12, -34.86],
  PE: [-8.05, -34.88], PI: [-5.09, -42.8], PR: [-25.43, -49.27], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RO: [-8.76, -63.9], RR: [2.82, -60.67], RS: [-30.03, -51.23], SC: [-27.6, -48.55], SE: [-10.91, -37.07],
  SP: [-23.55, -46.63], TO: [-10.18, -48.33],
};
export const UFS = Object.keys(CAPITAIS);
export const FATOR_ESTRADA = 1.3; // a estrada é mais comprida que a linha reta
export const KM_DENTRO_DO_ESTADO = 150;

export function distanciaKm(de: string, para: string): number {
  if (de === para) return KM_DENTRO_DO_ESTADO;
  const a = CAPITAIS[de], b = CAPITAIS[para];
  if (!a || !b) return NaN;
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * FATOR_ESTRADA);
}

// Frete por cabeça: viagem (km × R$/km) dividida pelos animais que cabem na carga.
export function fretePorCabeca(km: number, reaisPorKm: number, pesoAnimalKg: number, cargaKg: number) {
  const cabecas = Math.max(1, Math.floor(cargaKg / Math.max(1, pesoAnimalKg)));
  return (km * reaisPorKm) / cabecas;
}

// "SP Barretos" → "SP"
export const ufDaPraca = (praca: string) => praca.slice(0, 2);
