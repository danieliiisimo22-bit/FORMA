import type { Generator, Parameter, SymmetryMode } from '../engine/types'
import { TAU, clamp, fbm, fract, hash, mix, mod, noise, smooth } from '../engine/math'
import { geometry } from './geometry'
import { chromatic } from './chromatic'

const { sin, cos, atan2, hypot, floor, abs, exp, min, max, pow } = Math
const all: readonly SymmetryMode[] = ['free', 'mirror', 'horizontal', 'vertical', 'quadrants', 'radial', 'kaleido']
const parameter = (label: string, description: string, initial: number, low = 0.19, high = 0.82): Parameter =>
  ({ label, description, initial, safe: [low, high] })
const define = (entry: Omit<Generator, 'version' | 'symmetry'> & { symmetry?: Generator['symmetry'] }): Generator =>
  ({ version: 1, symmetry: all, ...entry })

const silk = define({
  id: 'silk', family: 'Fluidos', name: 'Seda líquida', palette: 'Brasa', presetSeed: 482901,
  description: 'Corrientes de color con pliegues finos y reflejos de seda.',
  parameters: [
    parameter('Corriente', 'Amplitud de la corriente principal.', 0.57),
    parameter('Ondulación', 'Curvatura de los pliegues.', 0.61),
    parameter('Filamentos', 'Separación entre los filamentos.', 0.56),
    parameter('Dirección', 'Inclinación de la corriente.', 0.48),
  ],
  glsl: `
    y += (0.16 + a*0.55)*sin(x*(1.25+b*1.4)+s) + 0.17*cos(x*3.1-s*0.7);
    x += 0.24*sin(y*3.4 + s*0.5);
    float q = (y + 0.23*sin(x*2.8+y*3.9+s) + 0.16*sin(x*3.2-y*2.7-s))*1.2;
    float folds = cos(q*(7.2+k*8.0) + x*(1.12+d) + 1.1*sin(x*2.25+y*1.7));
    float body = exp(-pow(abs(y)*(1.30+0.74*b),2.0)-pow(abs(x)*0.42,4.0));
    float light = (0.39 + 0.52*pow(0.5+0.5*folds,1.58))*body;
    float lines = sin(q*(120.0+c*143.0) + x*13.0 + 7.0*sin(y*3.1+x));
    float satin = 0.5+0.5*sin(x*2.4-y*3.2+s);
    return 0.033 + light*(0.72+0.32*satin) + lines*(0.014+0.044*body) + 0.036*sin(q*26.0-x*3.0)*body;
  `,
  sample(x, y, a, b, c, d, k, s) {
    y += (0.16 + a * 0.55) * sin(x * (1.25 + b * 1.4) + s) + 0.17 * cos(x * 3.1 - s * 0.7)
    x += 0.24 * sin(y * 3.4 + s * 0.5)
    const q = (y + 0.23 * sin(x * 2.8 + y * 3.9 + s) + 0.16 * sin(x * 3.2 - y * 2.7 - s)) * 1.2
    const folds = cos(q * (7.2 + k * 8) + x * (1.12 + d) + 1.1 * sin(x * 2.25 + y * 1.7))
    const body = exp(-pow(abs(y) * (1.30 + 0.74 * b), 2) - pow(abs(x) * 0.42, 4))
    const light = (0.39 + 0.52 * pow(0.5 + 0.5 * folds, 1.58)) * body
    const lines = sin(q * (120 + c * 143) + x * 13 + 7 * sin(y * 3.1 + x))
    const satin = 0.5 + 0.5 * sin(x * 2.4 - y * 3.2 + s)
    return 0.033 + light * (0.72 + 0.32 * satin) + lines * (0.014 + 0.044 * body) + 0.036 * sin(q * 26 - x * 3) * body
  },
})

const atmosphere = define({
  id: 'atmosphere', family: 'Gradientes', name: 'Horizonte', palette: 'Violeta', presetSeed: 619821,
  description: 'Masas de luz que se mezclan como un cielo desenfocado.',
  parameters: [
    parameter('Apertura', 'Extensión de las fuentes de luz.', 0.49),
    parameter('Altura', 'Altura de la fuente principal.', 0.53),
    parameter('Desplazamiento', 'Separación de las masas cromáticas.', 0.63),
    parameter('Velo', 'Intensidad del campo atmosférico.', 0.39),
  ],
  glsl: `
    vec2 p=vec2(x,y);
    vec2 center=vec2(0.53*sin(s), b*1.6-0.8);
    vec2 q=(p-center)*vec2(0.61+a*0.71,1.03+a*0.9);
    float main=exp(-dot(q,q));
    q=(p+vec2(c*2.0-1.0,0.64))*vec2(0.69,1.64);
    float other=exp(-dot(q,q));
    float veil=fbm(p*(0.6+k*2.8)+s);
    return 0.06 + 0.61*main + 0.43*other - 0.28*main*other + (veil-0.49)*d*0.48;
  `,
  sample(x, y, a, b, c, d, k, s) {
    const main = exp(-pow((x - 0.53 * sin(s)) * (0.61 + a * 0.71), 2) - pow((y - b * 1.6 + 0.8) * (1.03 + a * 0.9), 2))
    const other = exp(-pow((x + c * 2 - 1) * 0.69, 2) - pow((y + 0.64) * 1.64, 2))
    const scale = 0.6 + k * 2.8
    return 0.06 + 0.61 * main + 0.43 * other - 0.28 * main * other + (fbm(x * scale + s, y * scale + s) - 0.49) * d * 0.48
  },
})

const iridescence = define({
  id: 'iridescence', family: 'Gradientes', name: 'Iridiscencia', palette: 'Prisma', presetSeed: 417723,
  description: 'Superficies cromáticas de interferencia, con transiciones perceptuales.',
  parameters: [
    parameter('Escala', 'Tamaño de las islas cromáticas.', 0.39),
    parameter('Distorsión', 'Curvatura del campo angular.', 0.57),
    parameter('Interferencia', 'Peso de la segunda onda.', 0.71),
    parameter('Centro', 'Desplazamiento del foco.', 0.58),
  ],
  glsl: `
    x+=d-0.5;
    float scale=0.75+a*2.6;
    float f=sin(x*scale+(0.4+b*2.0)*sin(y*1.93+s));
    float g=cos(y*scale+(0.4+b*2.0)*sin(x*1.57-s));
    float angular=cos(atan(y,x)*3.0-length(vec2(x,y))*(2.0+k*5.0)+s);
    return 0.50 + f*0.28 + g*0.19*c + angular*0.18;
  `,
  sample(x, y, a, b, c, d, k, s) {
    x += d - 0.5
    const scale = 0.75 + a * 2.6
    const f = sin(x * scale + (0.4 + b * 2) * sin(y * 1.93 + s))
    const g = cos(y * scale + (0.4 + b * 2) * sin(x * 1.57 - s))
    const angular = cos(atan2(y, x) * 3 - hypot(x, y) * (2 + k * 5) + s)
    return 0.50 + f * 0.28 + g * 0.19 * c + angular * 0.18
  },
})

const vortex = define({
  id: 'vortex', family: 'Fluidos', name: 'Vórtice', palette: 'Abisal', presetSeed: 701546,
  description: 'Un remolino advectivo de corrientes concéntricas.',
  parameters: [
    parameter('Giro', 'Rotación acumulada hacia el centro.', 0.55),
    parameter('Turbulencia', 'Irregularidad entre las corrientes.', 0.43),
    parameter('Desplazamiento', 'Posición del centro del remolino.', 0.63),
    parameter('Brillo', 'Peso de las crestas iluminadas.', 0.39),
  ],
  glsl: `
    x+=(c-0.5)*1.7;
    y-=0.2*sin(s);
    float r=length(vec2(x,y));
    float theta=atan(y,x)+(2.0+a*13.0)*exp(-r*1.02);
    vec2 q=vec2(cos(theta),sin(theta))*r;
    float n=fbm(q*(1.2+k*5.0)+s);
    float ripple=0.5+0.5*sin(r*16.0+theta*3.0+b*12.0*n);
    return 0.12 + 0.59*n + (0.14+0.42*d)*pow(ripple,2.5)*exp(-r*0.55);
  `,
  sample(x, y, a, b, c, d, k, s) {
    x += (c - 0.5) * 1.7
    y -= 0.2 * sin(s)
    const r = hypot(x, y)
    const theta = atan2(y, x) + (2 + a * 13) * exp(-r * 1.02)
    const n = fbm(cos(theta) * r * (1.2 + k * 5) + s, sin(theta) * r * (1.2 + k * 5) + s)
    const ripple = 0.5 + 0.5 * sin(r * 16 + theta * 3 + b * 12 * n)
    return 0.12 + 0.59 * n + (0.14 + 0.42 * d) * pow(ripple, 2.5) * exp(-r * 0.55)
  },
})

const modules = define({
  id: 'modules', family: 'Geometría', name: 'Módulos', palette: 'Bauhaus', presetSeed: 13674,
  description: 'Retículas gráficas de piezas, diagonales y cuartos de círculo.',
  parameters: [
    parameter('Escala', 'Cantidad de filas y columnas.', 0.45),
    parameter('Radio', 'Tamaño de los cuartos de círculo.', 0.47),
    parameter('Vacío', 'Presencia de módulos despejados.', 0.32),
    parameter('Borde', 'Separación entre piezas.', 0.19, 0.05, 0.43),
  ],
  glsl: `
    vec2 p=vec2(x,y)*(1.7+a*4.0+k*1.7)+vec2(0.26,0.51);
    vec2 cell=floor(p), f=fract(p);
    float h=hash(cell+floor(s*19.0));
    if(h<c*0.34) return 0.89;
    if(h<0.50) f.x=1.0-f.x;
    if(h>0.75) f.y=1.0-f.y;
    float arc=length(f);
    float shape=h>0.56 ? step(f.y,f.x) : step(arc,0.35+b*0.57);
    float edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));
    if(edge<d*0.09) return 0.89;
    return mix(0.10+h*0.36,0.58+h*0.36,shape);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 1.7 + a * 4 + k * 1.7
    const px = x * scale + 0.26
    const py = y * scale + 0.51
    const h = hash(floor(px) + floor(s * 19), floor(py) + floor(s * 19))
    if (h < c * 0.34) return 0.89
    let fx = fract(px)
    let fy = fract(py)
    if (h < 0.50) fx = 1 - fx
    if (h > 0.75) fy = 1 - fy
    const edge = min(fx, 1 - fx, fy, 1 - fy)
    if (edge < d * 0.09) return 0.89
    const shape = h > 0.56 ? fy <= fx : hypot(fx, fy) <= 0.35 + b * 0.57
    return (shape ? 0.58 : 0.10) + h * 0.36
  },
})

const arches = define({
  id: 'arches', family: 'Geometría', name: 'Arcadas', palette: 'Cal y óxido', presetSeed: 911934,
  description: 'Arquitecturas concéntricas con un ritmo de bandas y silencios.',
  parameters: [
    parameter('Repetición', 'Número de arcadas visibles.', 0.38),
    parameter('Grosor', 'Peso de la banda interior.', 0.54),
    parameter('Elevación', 'Altura de los centros de cada arco.', 0.40),
    parameter('Abertura', 'Proporción vertical de la arcada.', 0.35),
  ],
  glsl: `
    float scale=1.5+a*3.1;
    float xx=x*scale+(s-3.14)*0.08;
    float cell=floor(xx);
    float j=hash(vec2(cell,floor(s*10.0)));
    float yy=y+(j-0.5)*c*1.9;
    float dx=fract(xx)-0.5;
    float r=length(vec2(dx, max(yy,0.0)*(0.7+d*1.0)));
    float f=fract(r*(4.0+k*10.0));
    float show=step(r,0.45);
    return mix(0.94, mix(0.18+j*0.37,0.80,step(b*0.73,f)),show);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const xx = x * (1.5 + a * 3.1) + (s - 3.14) * 0.08
    const j = hash(floor(xx), floor(s * 10))
    const r = hypot(fract(xx) - 0.5, max(y + (j - 0.5) * c * 1.9, 0) * (0.7 + d))
    return r > 0.45 ? 0.94 : fract(r * (4 + k * 10)) >= b * 0.73 ? 0.80 : 0.18 + j * 0.37
  },
})

const kaleid = define({
  id: 'kaleid', family: 'Simetría', name: 'Rosetón', palette: 'Luz gótica', presetSeed: 28868,
  description: 'Una estructura radial de pétalos, anillos y vacíos.',
  parameters: [
    parameter('Pétalos', 'Cantidad de secciones de la roseta.', 0.50),
    parameter('Curvatura', 'Profundidad de los pétalos.', 0.61),
    parameter('Relieve', 'Peso de los anillos secundarios.', 0.38),
    parameter('Umbral', 'Tamaño del espacio exterior.', 0.49),
  ],
  glsl: `
    float r=length(vec2(x,y));
    float angle=atan(y,x);
    float petals=cos(angle*floor(4.0+a*13.0)+s*0.35);
    float f=r*(5.0+k*11.0)+petals*b*1.12;
    float rings=0.5+0.5*cos(f*2.0);
    float leaf=0.5+0.5*cos(angle*floor(4.0+a*13.0)+s*0.35-r*2.7);
    float envelope=1.0-smoothstep(0.42+d*0.33,0.63+d*0.33,r);
    return 0.05 + (0.21+0.46*pow(rings,1.5)+c*0.37*leaf)*envelope;
  `,
  sample(x, y, a, b, c, d, k, s) {
    const r = hypot(x, y)
    const angle = atan2(y, x)
    const count = floor(4 + a * 13)
    const phase = angle * count + s * 0.35
    const f = r * (5 + k * 11) + cos(phase) * b * 1.12
    const rings = 0.5 + 0.5 * cos(f * 2)
    const leaf = 0.5 + 0.5 * cos(phase - r * 2.7)
    const envelope = 1 - smooth(0.42 + d * 0.33, 0.63 + d * 0.33, r)
    return 0.05 + (0.21 + 0.46 * pow(rings, 1.5) + c * 0.37 * leaf) * envelope
  },
})

const moire = define({
  id: 'moire', family: 'Op Art', name: 'Interferencia', palette: 'Tinta índigo', presetSeed: 49054, intense: true,
  description: 'Dos campos de líneas estáticas crean batidos ópticos.',
  parameters: [
    parameter('Frecuencia', 'Separación de las líneas primarias.', 0.32),
    parameter('Desfase', 'Desfase relativo entre las ondas.', 0.56),
    parameter('Curvatura', 'Curvatura de ambos campos.', 0.48),
    parameter('Mezcla', 'Peso del batido sobre la línea.', 0.59),
  ],
  glsl: `
    float f=12.0+a*36.0+k*13.0;
    float p=x*f+y*y*(2.1+c*12.0)+s;
    float q=x*(f+b*7.3)+y*(0.45+b*4.1)+cos(y*2.6+s)*(1.0+c*4.0);
    float beat=0.5+0.5*cos(p-q);
    float micro=cos(p)*0.5+cos(q)*0.5;
    return 0.48 + beat*(0.16+d*0.24) - micro*(0.12+(1.0-d)*0.30);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const f = 12 + a * 36 + k * 13
    const p = x * f + y * y * (2.1 + c * 12) + s
    const q = x * (f + b * 7.3) + y * (0.45 + b * 4.1) + cos(y * 2.6 + s) * (1 + c * 4)
    const beat = 0.5 + 0.5 * cos(p - q)
    return 0.48 + beat * (0.16 + d * 0.24) - (cos(p) + cos(q)) * 0.5 * (0.12 + (1 - d) * 0.30)
  },
})

const cells = define({
  id: 'cells', family: 'Orgánicos', name: 'Voronoi', palette: 'Liquen', presetSeed: 79194,
  description: 'Membranas celulares por distancia a puntos vecinos.',
  parameters: [
    parameter('Densidad', 'Número de células visibles.', 0.51),
    parameter('Dispersión', 'Posición irregular de los centros.', 0.75),
    parameter('Membrana', 'Anchura del borde celular.', 0.53),
    parameter('Relieve', 'Gradiente entre centro y borde.', 0.62),
  ],
  glsl: `
    vec2 p=vec2(x,y)*(1.45+a*3.7+k*2.2)+s;
    vec2 g=floor(p), f=fract(p);
    float first=10.0, second=10.0, id=0.0;
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 cell=vec2(float(i),float(j));
      vec2 v=cell+0.5+(vec2(hash(g+cell),hash(g+cell+21.7))-0.5)*b-f;
      float dist=dot(v,v);
      if(dist<first){second=first;first=dist;id=hash(g+cell+11.0);}
      else if(dist<second){second=dist;}
    }
    float edge=smoothstep(0.006,0.03+c*0.13,sqrt(second)-sqrt(first));
    return mix(0.13,0.47+id*0.40-d*sqrt(first)*0.37,edge);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 1.45 + a * 3.7 + k * 2.2
    const px = x * scale + s
    const py = y * scale + s
    const gx = floor(px)
    const gy = floor(py)
    let first = 10
    let second = 10
    let id = 0
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const vx = i + 0.5 + (hash(gx + i, gy + j) - 0.5) * b - fract(px)
        const vy = j + 0.5 + (hash(gx + i + 21.7, gy + j + 21.7) - 0.5) * b - fract(py)
        const dist = vx * vx + vy * vy
        if (dist < first) {
          second = first
          first = dist
          id = hash(gx + i + 11, gy + j + 11)
        } else if (dist < second) {
          second = dist
        }
      }
    }
    const edge = smooth(0.006, 0.03 + c * 0.13, Math.sqrt(second) - Math.sqrt(first))
    return mix(0.13, 0.47 + id * 0.40 - d * Math.sqrt(first) * 0.37, edge)
  },
})

const terrain = define({
  id: 'terrain', family: 'Orgánicos', name: 'Topografía', palette: 'Glaciar', presetSeed: 876353,
  description: 'Curvas de nivel sobre un terreno de ruido multiescala.',
  parameters: [
    parameter('Escala', 'Tamaño de las formaciones.', 0.50),
    parameter('Erosión', 'Distorsión del campo de altura.', 0.51),
    parameter('Curvas', 'Distancia entre curvas de nivel.', 0.50),
    parameter('Trazo', 'Grosor de las curvas de nivel.', 0.46),
  ],
  glsl: `
    vec2 p=vec2(x,y)*(0.72+a*2.7)+s;
    float bend=fbm(p*0.72);
    float n=fbm(p+vec2(bend*b*3.6,bend*-b*2.8));
    n=clamp(n*0.75+0.23*exp(-dot(vec2(x,y),vec2(x,y))*0.39),0.0,1.0);
    float v=fract(n*(7.0+c*18.0+k*12.0));
    float ink=1.0-smoothstep(d*0.19,d*0.19+0.045,min(v,1.0-v));
    return 0.24+n*0.67-ink*0.32;
  `,
  sample(x, y, a, b, c, d, k, s) {
    const px = x * (0.72 + a * 2.7) + s
    const py = y * (0.72 + a * 2.7) + s
    const bend = fbm(px * 0.72, py * 0.72)
    let n = fbm(px + bend * b * 3.6, py - bend * b * 2.8)
    n = clamp(n * 0.75 + 0.23 * exp(-(x * x + y * y) * 0.39))
    const v = fract(n * (7 + c * 18 + k * 12))
    const ink = 1 - smooth(d * 0.19, d * 0.19 + 0.045, min(v, 1 - v))
    return 0.24 + n * 0.67 - ink * 0.32
  },
})

const print = define({
  id: 'print', family: 'Experimental', name: 'Risografía', palette: 'Mandarina', presetSeed: 678434,
  description: 'Puntos de semitono con densidad variable y registro desplazado.',
  symmetry: ['free', 'mirror', 'horizontal', 'vertical', 'quadrants'],
  parameters: [
    parameter('Trama', 'Frecuencia de los puntos impresos.', 0.53),
    parameter('Registro', 'Distancia entre las dos tintas.', 0.44),
    parameter('Cobertura', 'Superficie cubierta por tinta.', 0.64),
    parameter('Ángulo', 'Inclinación de la segunda trama.', 0.39),
  ],
  glsl: `
    vec2 p=vec2(x,y);
    float scale=7.0+a*17.0+k*11.0;
    float n=fbm(p*1.53+s);
    float m=0.5+0.5*cos(x*2.7+y*1.6+s);
    float dots=length(fract(p*scale)-0.5);
    float dots2=length(fract(rot(p,0.19+d*0.50)*scale+vec2(b*0.53,b*0.71))-0.5);
    float arc=length(p-vec2(0.62*sin(s*1.1),0.54*cos(s)))*1.8;
    float inkMass=0.5+0.5*cos(arc+y*0.91+s*0.22);
    float cover=smoothstep(0.20,0.66,n*0.35+inkMass*0.65);
    float overprint=smoothstep(0.30,0.75,0.69*m+0.31*n);
    float ink=cover*(1.0-smoothstep(0.03+cover*c*0.50,0.06+cover*c*0.50,dots));
    float ink2=overprint*(1.0-smoothstep(0.05+overprint*c*0.44,0.08+overprint*c*0.44,dots2));
    return 0.94-ink*0.54-ink2*0.40;
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 7 + a * 17 + k * 11
    const n = fbm(x * 1.53 + s, y * 1.53 + s)
    const m = 0.5 + 0.5 * cos(x * 2.7 + y * 1.6 + s)
    const angle = 0.19 + d * 0.50
    const dots = hypot(fract(x * scale) - 0.5, fract(y * scale) - 0.5)
    const dots2 = hypot(fract((x * cos(angle) - y * sin(angle)) * scale + b * 0.53) - 0.5,
      fract((x * sin(angle) + y * cos(angle)) * scale + b * 0.71) - 0.5)
    const arc = hypot(x - 0.62 * sin(s * 1.1), y - 0.54 * cos(s)) * 1.8
    const inkMass = 0.5 + 0.5 * cos(arc + y * 0.91 + s * 0.22)
    const cover = smooth(0.20, 0.66, n * 0.35 + inkMass * 0.65)
    const overprint = smooth(0.30, 0.75, 0.69 * m + 0.31 * n)
    const ink = cover * (1 - smooth(0.03 + cover * c * 0.50, 0.06 + cover * c * 0.50, dots))
    const ink2 = overprint * (1 - smooth(0.05 + overprint * c * 0.44, 0.08 + overprint * c * 0.44, dots2))
    return 0.94 - ink * 0.54 - ink2 * 0.40
  },
})

const fractal = define({
  id: 'fracture', family: 'Experimental', name: 'Fractura', palette: 'Ultramar', presetSeed: 718831,
  description: 'Reflexiones recursivas que tallan planos y fracturas.',
  parameters: [
    parameter('Plegado', 'Distancia entre reflexiones recursivas.', 0.44),
    parameter('Rotación', 'Giro entre un nivel y el siguiente.', 0.52),
    parameter('Apertura', 'Anchura de las fisuras.', 0.38),
    parameter('Traslación', 'Desplazamiento recursivo del plano.', 0.46),
  ],
  glsl: `
    vec2 p=vec2(x,y)*0.74;
    float t=1.0;
    float stride=0.48+a*0.36;
    for(int i=0;i<6;i++){
      if(float(i)>2.0+k*4.0) break;
      p=abs(rot(p,0.14+b*0.78+s*0.033))-vec2(stride,0.36+d*0.36);
      t=min(t,abs(p.x)*pow(1.24,float(i)));
      p=p*1.29+vec2(0.11,-0.1);
    }
    return 0.13+0.61*exp(-t*(9.5+c*12.0))+0.15*cos(length(p)*6.0+s);
  `,
  sample(x, y, a, b, c, d, k, s) {
    x *= 0.74
    y *= 0.74
    let t = 1
    const angle = 0.14 + b * 0.78 + s * 0.033
    for (let i = 0; i < 6 && i <= 2 + k * 4; i++) {
      const px = abs(x * cos(angle) - y * sin(angle)) - (0.48 + a * 0.36)
      const py = abs(x * sin(angle) + y * cos(angle)) - (0.36 + d * 0.36)
      t = min(t, abs(px) * pow(1.24, i))
      x = px * 1.29 + 0.11
      y = py * 1.29 - 0.1
    }
    return 0.13 + 0.61 * exp(-t * (9.5 + c * 12)) + 0.15 * cos(hypot(x, y) * 6 + s)
  },
})

const dunes = define({
  id: 'dunes', family: 'Orgánicos', name: 'Dunas', palette: 'Oro viejo', presetSeed: 654703,
  description: 'Crestas suaves y capas de arena que se pierden en el horizonte.',
  parameters: [
    parameter('Capas', 'Cantidad de crestas visibles por debajo del horizonte.', 0.46),
    parameter('Ondulación', 'Altura y curvatura de las dunas.', 0.60),
    parameter('Sombra', 'Profundidad de la sombra junto a cada cresta.', 0.56),
    parameter('Horizonte', 'Posición vertical de las primeras dunas.', 0.42),
  ],
  glsl: `
    float wave=(0.13+b*0.38)*(sin(x*1.42+s+0.86*y)+0.30*cos(x*2.81-y*1.2+s*0.73));
    float ground=y+0.78-d*1.14-wave;
    float bands=ground*(1.7+a*3.2+k*1.35);
    float layer=floor(bands), depth=fract(bands);
    float light=0.5+0.5*cos(x*1.42+s+0.86*y);
    float glow=0.5+0.5*cos(x*1.26+s*0.6);
    float sky=0.44+0.27*exp(-abs(ground)*1.75)*(0.58+0.42*glow);
    float far=exp(-max(layer,0.0)*0.40);
    float sand=0.66+0.13*light+0.10*far
      -(0.16+c*0.35)*exp(-depth*(1.6+light*1.4))*(1.0-0.61*far);
    sand+=0.028*sin(depth*40.0+x*1.7)*depth*(1.0-depth)*(1.0-far);
    return mix(sky,sand,smoothstep(-0.008,0.008,ground));
  `,
  sample(x, y, a, b, c, d, k, s) {
    const phase = x * 1.42 + s + 0.86 * y
    const wave = (0.13 + b * 0.38) * (sin(phase) + 0.30 * cos(x * 2.81 - y * 1.2 + s * 0.73))
    const ground = y + 0.78 - d * 1.14 - wave
    const bands = ground * (1.7 + a * 3.2 + k * 1.35)
    const depth = fract(bands)
    const light = 0.5 + 0.5 * cos(phase)
    const glow = 0.5 + 0.5 * cos(x * 1.26 + s * 0.6)
    const sky = 0.44 + 0.27 * exp(-abs(ground) * 1.75) * (0.58 + 0.42 * glow)
    const far = exp(-max(floor(bands), 0) * 0.40)
    const sand = 0.66 + 0.13 * light + 0.10 * far
      - (0.16 + c * 0.35) * exp(-depth * (1.6 + light * 1.4)) * (1 - 0.61 * far)
      + 0.028 * sin(depth * 40 + x * 1.7) * depth * (1 - depth) * (1 - far)
    return mix(sky, sand, smooth(-0.008, 0.008, ground))
  },
})

const branches = define({
  id: 'branches', family: 'Orgánicos', name: 'Ramificaciones', palette: 'Liquen', presetSeed: 802469,
  description: 'Un tallo curvo del que brotan nervaduras y ramas finas.',
  parameters: [
    parameter('Apertura', 'Alcance lateral de las ramas principales.', 0.64),
    parameter('Curvatura', 'Inclinación de las ramas y curvatura del tallo.', 0.55),
    parameter('Densidad', 'Número de ramas que salen del tallo.', 0.48),
    parameter('Grosor', 'Grosor de las nervaduras y del tallo.', 0.55),
  ],
  glsl: `
    float t=(1.16-y)/1.97;
    float spine=0.24*sin(t*2.6+s)+b*0.42*(t-0.35);
    float dx=x-spine, reach=abs(dx);
    float lean=reach*(0.24+b*0.22)+pow(reach,1.6)*0.16;
    float rows=6.0+c*6.0+k*3.0;
    float stagger=dx>=0.0?0.28:-0.18;
    float branch=(t-lean)*rows+stagger;
    float root=(floor(branch)+0.5-stagger)/rows;
    float canopy=pow(max(0.0,sin(clamp(root,0.0,1.0)*3.14159265)),0.93);
    float span=(0.37+a*0.68)*canopy*(1.0-0.28*clamp(root,0.0,1.0));
    float taper=1.0-smoothstep(0.0,max(span,0.001),reach);
    float bend=(fract(branch)-0.5)/rows;
    float width=(0.003+d*0.013)*(0.22+0.78*taper);
    float rib=1.0-smoothstep(width,width+0.005,abs(bend));
    float twig=1.0-smoothstep(0.002+d*0.002,0.007+d*0.003,
      abs((fract(reach*(9.0+4.0*k))-0.5)*0.072+abs(bend)*0.81-0.022));
    twig*=smoothstep(0.006,0.02,reach)*(1.0-smoothstep(0.033,0.046,abs(bend)));
    float leaf=max(rib*(0.42+0.46*taper),twig*(0.14+0.42*taper));
    float growth=smoothstep(0.035,0.16,root)*(1.0-smoothstep(0.86,1.0,root));
    float stemWidth=(0.012+d*0.021)*(1.0-0.80*clamp(t,0.0,1.0));
    float stem=(1.0-smoothstep(stemWidth,stemWidth+0.008,reach))*(1.0-smoothstep(0.90,1.0,t));
    float mist=0.08+0.22*exp(-reach*1.85-abs(t-0.57)*1.60);
    return mist+max(0.55*stem,leaf*growth*(1.0-smoothstep(0.80,1.0,reach/max(span,0.001))))*0.75;
  `,
  sample(x, y, a, b, c, d, k, s) {
    const t = (1.16 - y) / 1.97
    const spine = 0.24 * sin(t * 2.6 + s) + b * 0.42 * (t - 0.35)
    const dx = x - spine
    const reach = abs(dx)
    const lean = reach * (0.24 + b * 0.22) + pow(reach, 1.6) * 0.16
    const rows = 6 + c * 6 + k * 3
    const stagger = dx >= 0 ? 0.28 : -0.18
    const branch = (t - lean) * rows + stagger
    const root = (floor(branch) + 0.5 - stagger) / rows
    const canopy = pow(max(0, sin(clamp(root) * Math.PI)), 0.93)
    const span = max(0.001, (0.37 + a * 0.68) * canopy * (1 - 0.28 * clamp(root)))
    const taper = 1 - smooth(0, span, reach)
    const bend = abs(fract(branch) - 0.5) / rows
    const width = (0.003 + d * 0.013) * (0.22 + 0.78 * taper)
    const rib = 1 - smooth(width, width + 0.005, bend)
    const twigDistance = abs((fract(reach * (9 + 4 * k)) - 0.5) * 0.072 + bend * 0.81 - 0.022)
    const twig = (1 - smooth(0.002 + d * 0.002, 0.007 + d * 0.003, twigDistance))
      * smooth(0.006, 0.02, reach) * (1 - smooth(0.033, 0.046, bend))
    const leaf = max(rib * (0.42 + 0.46 * taper), twig * (0.14 + 0.42 * taper))
    const growth = smooth(0.035, 0.16, root) * (1 - smooth(0.86, 1, root))
    const stemWidth = (0.012 + d * 0.021) * (1 - 0.80 * clamp(t))
    const stem = (1 - smooth(stemWidth, stemWidth + 0.008, reach)) * (1 - smooth(0.90, 1, t))
    const mist = 0.08 + 0.22 * exp(-reach * 1.85 - abs(t - 0.57) * 1.60)
    return mist + max(0.55 * stem, leaf * growth * (1 - smooth(0.80, 1, reach / span))) * 0.75
  },
})

export const generators: readonly Generator[] = [
  silk, atmosphere, modules, kaleid, moire, terrain, print, iridescence, vortex, arches, cells, fractal, ...geometry, dunes, branches, ...chromatic,
]
export const generatorById = new Map(generators.map((generator) => [generator.id, generator]))

export function accentField(x: number, y: number, phase: number) {
  return 0.5 + 0.5 * sin((x * 0.72 - y * 0.43) * TAU + phase + mod(noise(x, y), 1))
}
