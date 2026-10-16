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

export const KM_MINIMO = 30; // mesmo na cidade vizinha, o caminhão roda um pouco

export type Ponto = [number, number];
// Um lugar: cidade (com coordenadas) ou só o estado (vale a capital).
export type Local = { uf: string; ponto?: Ponto };

// Cidade de referência de cada praça da Scot. A Scot não informa a cidade: a escolha é nossa (a cidade mais conhecida
// da região) e as coordenadas vêm da lista de municípios (public/municipios.json).
export const PRACA_CIDADE: Record<string, [string, number, number]> = {
  "SP Barretos": ["Barretos", -20.553, -48.57],
  "SP Araçatuba": ["Araçatuba", -21.208, -50.44],
  "MG Triângulo": ["Uberlândia", -18.914, -48.275],
  "MG B.Horizonte": ["Belo Horizonte", -19.91, -43.927],
  "MG Norte": ["Montes Claros", -16.728, -43.858],
  "MG Sul": ["Varginha", -21.556, -45.436],
  "GO Goiânia": ["Goiânia", -16.686, -49.264],
  "GO Reg. Sul": ["Rio Verde", -17.792, -50.919],
  "MS Dourados": ["Dourados", -22.223, -54.812],
  "MS C. Grande": ["Campo Grande", -20.449, -54.63],
  "MS Três Lagoas": ["Três Lagoas", -20.785, -51.701],
  "BA Sul": ["Itapetinga", -15.248, -40.248],
  "BA Oeste": ["Barreiras", -12.144, -44.997],
  "MT Norte": ["Sinop", -11.86, -55.509],
  "MT Sudoeste": ["Cáceres", -16.076, -57.682],
  "MT Sudeste": ["Rondonópolis", -16.467, -54.637],
  "PR Noroeste": ["Umuarama", -23.766, -53.32],
  "MA Oeste": ["Imperatriz", -5.518, -47.478],
  "PA Marabá": ["Marabá", -5.381, -49.133],
  "PA Redenção": ["Redenção", -8.025, -50.032],
  "PA Paragominas": ["Paragominas", -3.002, -47.353],
  "RO Sudeste": ["Vilhena", -12.75, -60.149],
  "TO Sul": ["Gurupi", -11.728, -49.068],
  "TO Norte": ["Araguaína", -7.192, -48.204],
};

const kmEntre = (a: Ponto, b: Ponto) => {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * FATOR_ESTRADA);
};

// Entre duas cidades: linha reta × ajuste de estrada. Lado sem cidade usa a capital;
// no mesmo estado, se um dos lados não tem cidade, vale o padrão de dentro do estado.
export function distanciaLocais(de: Local, para: Local): number {
  if (de.uf === para.uf && (!de.ponto || !para.ponto)) return KM_DENTRO_DO_ESTADO;
  const a = de.ponto ?? CAPITAIS[de.uf], b = para.ponto ?? CAPITAIS[para.uf];
  if (!a || !b) return NaN;
  return Math.max(KM_MINIMO, kmEntre(a, b));
}

export const distanciaKm = (de: string, para: string) => distanciaLocais({ uf: de }, { uf: para });

// Frete por cabeça: viagem (km × R$/km) dividida pelos animais que cabem na carga.
export function fretePorCabeca(km: number, reaisPorKm: number, pesoAnimalKg: number, cargaKg: number) {
  const cabecas = Math.max(1, Math.floor(cargaKg / Math.max(1, pesoAnimalKg)));
  return (km * reaisPorKm) / cabecas;
}

// "SP Barretos" → "SP"
export const ufDaPraca = (praca: string) => praca.slice(0, 2);
export const localDaPraca = (praca: string): Local => {
  const c = PRACA_CIDADE[praca];
  return { uf: ufDaPraca(praca), ponto: c ? [c[1], c[2]] : undefined };
};
