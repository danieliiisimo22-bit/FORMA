import type { Generator } from '../engine/types'
import { fract, smooth } from '../engine/math'

const { cos, sin, exp, hypot } = Math
const symmetry = ['free', 'mirror', 'horizontal', 'vertical', 'quadrants', 'radial', 'kaleido'] as const

export const chromatic: readonly Generator[] = [
  {
    id: 'ribbons', version: 1, family: 'Fluidos', name: 'Cintas de luz', palette: 'Neón coral', presetSeed: 635227, symmetry,
    description: 'Cintas curvas con bordes iluminados y sombras entre los pliegues.',
    parameters: [
      { label: 'Curva', description: 'Amplitud de los pliegues.', initial: 0.67, safe: [0.24, 0.88] },
      { label: 'Separación', description: 'Ancho de las cintas.', initial: 0.62, safe: [0.22, 0.87] },
      { label: 'Luz', description: 'Intensidad del borde iluminado.', initial: 0.49, safe: [0.16, 0.82] },
      { label: 'Dirección', description: 'Inclinación del conjunto de cintas.', initial: 0.51, safe: [0.12, 0.88] },
    ],
    glsl: `
      float u=y+(d-0.5)*x+(0.27+a*0.83)*sin(x*1.55+s+0.32*y)+0.17*cos(x*3.0-y*1.2+s*0.65);
      float f=fract(u*(2.15-b*0.95+k*0.7)+s*0.21);
      float face=smoothstep(0.0,0.45,f)*(1.0-0.15*f);
      float shade=0.18+0.25*(0.5+0.5*sin(x*1.9-y*1.2+s));
      float edge=smoothstep(0.86,0.995,f);
      return 0.025+face*(0.40+shade)+edge*c*0.23;
    `,
    sample(x, y, a, b, c, d, k, s) {
      const u = y + (d - 0.5) * x + (0.27 + a * 0.83) * sin(x * 1.55 + s + 0.32 * y) + 0.17 * cos(x * 3 - y * 1.2 + s * 0.65)
      const f = fract(u * (2.15 - b * 0.95 + k * 0.7) + s * 0.21)
      const face = smooth(0, 0.45, f) * (1 - 0.15 * f)
      const shade = 0.18 + 0.25 * (0.5 + 0.5 * sin(x * 1.9 - y * 1.2 + s))
      return 0.025 + face * (0.40 + shade) + smooth(0.86, 0.995, f) * c * 0.23
    },
  },
  {
    id: 'nacre', version: 1, family: 'Fluidos', name: 'Nácar', palette: 'Luz nacarada', presetSeed: 112042, symmetry,
    description: 'Reflejos pastel sobre ondas anchas, con brillos finos en las crestas.',
    parameters: [
      { label: 'Escala', description: 'Tamaño de las ondas.', initial: 0.43, safe: [0.12, 0.88] },
      { label: 'Ondulación', description: 'Curvatura lateral del relieve.', initial: 0.66, safe: [0.23, 0.86] },
      { label: 'Destello', description: 'Intensidad de los reflejos especulares.', initial: 0.52, safe: [0.12, 0.86] },
      { label: 'Inclinación', description: 'Dirección de las ondas.', initial: 0.63, safe: [0.14, 0.87] },
    ],
    glsl: `
      float u=(y+(d-0.5)*x)*(1.8+a*3.1)+b*2.3*sin(x*1.71+s)+0.42*cos(y*1.88-x*2.3+s*0.7);
      float wave=sin(u+0.34*sin(u*2.0));
      float specular=exp(-abs(wave)*(8.0+k*10.0))*smoothstep(-0.4,0.55,cos(u));
      return 0.47+wave*0.31+0.12*sin(x*1.7-y*0.83+s)+specular*(0.1+c*0.37);
    `,
    sample(x, y, a, b, c, d, k, s) {
      const u = (y + (d - 0.5) * x) * (1.8 + a * 3.1) + b * 2.3 * sin(x * 1.71 + s) + 0.42 * cos(y * 1.88 - x * 2.3 + s * 0.7)
      const wave = sin(u + 0.34 * sin(u * 2))
      const specular = exp(-Math.abs(wave) * (8 + k * 10)) * smooth(-0.4, 0.55, cos(u))
      return 0.47 + wave * 0.31 + 0.12 * sin(x * 1.7 - y * 0.83 + s) + specular * (0.1 + c * 0.37)
    },
  },
  {
    id: 'diffuse', version: 1, family: 'Gradientes', name: 'Difusión de color', palette: 'Fulgor', presetSeed: 739152, symmetry,
    presetTexture: { finish: 'film', amount: 0.37 },
    description: 'Campos suaves de color con bordes difusos y textura de película.',
    parameters: [
      { label: 'Apertura', description: 'Extensión del haz principal.', initial: 0.61, safe: [0.16, 0.86] },
      { label: 'Altura', description: 'Posición vertical de la luz.', initial: 0.55, safe: [0.13, 0.88] },
      { label: 'Dispersión', description: 'Peso de la luz secundaria.', initial: 0.47, safe: [0.14, 0.85] },
      { label: 'Caída', description: 'Oscurecimiento hacia los extremos.', initial: 0.55, safe: [0.12, 0.87] },
    ],
    glsl: `
      vec2 q=vec2((x-0.39*cos(s))*(1.35-a*0.92), (y+(b-0.5)*1.9+0.28*sin(s))*(1.45-d*0.68));
      float glow=exp(-dot(q,q));
      vec2 r=vec2((x+0.56*sin(s))*0.71,(y-0.61)*1.71);
      float halo=exp(-dot(r,r));
      return 0.025+glow*(0.84+0.18*k)+halo*c*(0.52-0.51*glow);
    `,
    sample(x, y, a, b, c, d, k, s) {
      const qx = (x - 0.39 * cos(s)) * (1.35 - a * 0.92)
      const qy = (y + (b - 0.5) * 1.9 + 0.28 * sin(s)) * (1.45 - d * 0.68)
      const main = exp(-qx * qx - qy * qy)
      const rx = (x + 0.56 * sin(s)) * 0.71
      const ry = (y - 0.61) * 1.71
      return 0.025 + main * (0.84 + 0.18 * k) + exp(-rx * rx - ry * ry) * c * (0.52 - 0.51 * main)
    },
  },
  {
    id: 'spectral', version: 1, family: 'Fluidos', name: 'Relieve espectral', palette: 'Prisma nocturno', presetSeed: 940158, symmetry,
    presetTexture: { finish: 'film', amount: 0.57 },
    description: 'Arcos luminosos con sombras profundas y grano de película.',
    parameters: [
      { label: 'Ritmo', description: 'Separación entre crestas.', initial: 0.56, safe: [0.18, 0.86] },
      { label: 'Curvatura', description: 'Abertura de los arcos.', initial: 0.62, safe: [0.16, 0.88] },
      { label: 'Nitidez', description: 'Anchura de las crestas iluminadas.', initial: 0.48, safe: [0.15, 0.86] },
      { label: 'Centro', description: 'Posición del centro de los arcos.', initial: 0.38, safe: [0.12, 0.88] },
    ],
    glsl: `
      vec2 q=vec2((x+0.68-d*1.56)*(0.69+b*0.53),y+0.65+0.31*sin(s));
      float u=length(q)*(5.6+a*7.2+k*2.6)+0.83*sin(x*1.6-y*0.9+s)+s*0.41;
      float wave=pow(max(0.0,0.5+0.5*cos(u)),1.6+c*3.8);
      float light=exp(-0.21*dot(q-vec2(0.48,0.37),q-vec2(0.48,0.37)));
      return 0.045+light*(0.82*wave+0.115*(0.5+0.5*sin(u+x*2.17)));
    `,
    sample(x, y, a, b, c, d, k, s) {
      const qx = (x + 0.68 - d * 1.56) * (0.69 + b * 0.53)
      const qy = y + 0.65 + 0.31 * sin(s)
      const u = hypot(qx, qy) * (5.6 + a * 7.2 + k * 2.6) + 0.83 * sin(x * 1.6 - y * 0.9 + s) + s * 0.41
      const wave = Math.max(0, 0.5 + 0.5 * cos(u)) ** (1.6 + c * 3.8)
      const light = exp(-0.21 * ((qx - 0.48) ** 2 + (qy - 0.37) ** 2))
      return 0.045 + light * (0.82 * wave + 0.115 * (0.5 + 0.5 * sin(u + x * 2.17)))
    },
  },
]
