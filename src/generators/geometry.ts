import { TAU, clamp, fract, hash, mix, mod, rotate, smooth } from '../engine/math'
import type { Generator, Parameter } from '../engine/types'

const { abs, atan2, floor, hypot, max, min, sin } = Math
const sqrt3 = Math.sqrt(3)
const geometryStyle = (style: Omit<Generator, 'version' | 'family' | 'symmetry'>): Generator => ({
  version: 1, family: 'Geometría', symmetry: ['free', 'mirror', 'horizontal', 'vertical', 'quadrants', 'radial', 'kaleido'],
  ...style,
})
const control = (label: string, description: string, initial: number): Parameter =>
  ({ label, description, initial, safe: [0.19, 0.82] })

const facets = geometryStyle({
  id: 'facets', name: 'Facetas', palette: 'Ultramar', presetSeed: 315207,
  description: 'Un mosaico de triángulos equiláteros con luz y juntas regulables.',
  parameters: [
    control('Densidad', 'Cantidad de triángulos en la trama.', 0.41),
    control('Inclinación', 'Giro de la retícula triangular.', 0.44),
    control('Junta', 'Separación entre los triángulos.', 0.26),
    control('Relieve', 'Intensidad del degradado dentro de cada pieza.', 0.64),
  ],
  glsl: `
    vec2 p=rot(vec2(x,y),(b-0.5)*1.05)*(1.1+a*3.2+k*1.7);
    vec2 grid=vec2(p.x-p.y/1.7320508,p.y*2.0/1.7320508);
    vec2 cell=floor(grid), f=fract(grid);
    float face=step(1.0,f.x+f.y);
    f=mix(f,1.0-f,face);
    float edge=min(min(f.x,f.y),1.0-f.x-f.y);
    float h=hash(cell+vec2(floor(s*13.0),face*23.0));
    float tone=0.18+face*0.28+h*0.22+d*0.28*(1.0-f.x-f.y);
    return mix(0.07,tone,smoothstep(c*0.075,c*0.075+0.013,edge));
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 1.1 + a * 3.2 + k * 1.7
    const [rx, ry] = rotate(x, y, (b - 0.5) * 1.05)
    const u = (rx - ry / sqrt3) * scale
    const v = ry * 2 / sqrt3 * scale
    let fu = fract(u)
    let fv = fract(v)
    const face = fu + fv >= 1 ? 1 : 0
    if (face) {
      fu = 1 - fu
      fv = 1 - fv
    }
    const edge = min(fu, fv, 1 - fu - fv)
    const h = hash(floor(u) + floor(s * 13), floor(v) + face * 23)
    const tone = 0.18 + face * 0.28 + h * 0.22 + d * 0.28 * (1 - fu - fv)
    return mix(0.07, tone, smooth(c * 0.075, c * 0.075 + 0.013, edge))
  },
})

const cubes = geometryStyle({
  id: 'isometric', name: 'Cubos isométricos', palette: 'Marea', presetSeed: 613255,
  description: 'Rombos que encajan en cubos mediante tres planos de luz.',
  parameters: [
    control('Densidad', 'Cantidad de cubos en la trama.', 0.48),
    control('Contraste de caras', 'Diferencia de luz entre los tres planos.', 0.65),
    control('Junta', 'Separación alrededor de cada cubo.', 0.19),
    control('Variación tonal', 'Diferencia de tono entre cubos.', 0.44),
  ],
  glsl: `
    vec2 p=vec2(x,y)*(2.2+a*5.2+k*2.6);
    vec2 span=vec2(1.7320508,3.0);
    vec2 first=mod(p+span*0.5,span)-span*0.5;
    vec2 second=mod(p,span)-span*0.5;
    vec2 f=dot(first,first)<dot(second,second)?first:second;
    vec2 cell=(p-f)/span;
    float angle=dot(f,f)>0.0?atan(f.y,f.x):0.0;
    float face=floor(mod(angle+TAU*5.0/12.0,TAU)/(TAU/3.0));
    float light=face==0.0?1.0:face==1.0?0.0:0.45;
    float edge=0.8660254-max(abs(f.x),0.5*abs(f.x)+0.8660254*abs(f.y));
    float h=hash(floor(cell*2.0+0.5)+floor(s*17.0));
    float tone=0.29+light*(0.24+b*0.31)+(h-0.5)*d*0.27;
    return mix(0.09,tone,smoothstep(c*0.16,c*0.16+0.022,edge));
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 2.2 + a * 5.2 + k * 2.6
    const px = x * scale
    const py = y * scale
    const firstX = mod(px + sqrt3 / 2, sqrt3) - sqrt3 / 2
    const firstY = mod(py + 1.5, 3) - 1.5
    const secondX = mod(px, sqrt3) - sqrt3 / 2
    const secondY = mod(py, 3) - 1.5
    const first = firstX * firstX + firstY * firstY < secondX * secondX + secondY * secondY
    const fx = first ? firstX : secondX
    const fy = first ? firstY : secondY
    const face = floor(mod(atan2(fy, fx) + TAU * 5 / 12, TAU) / (TAU / 3))
    const light = face === 0 ? 1 : face === 1 ? 0 : 0.45
    const edge = sqrt3 / 2 - max(abs(fx), 0.5 * abs(fx) + sqrt3 / 2 * abs(fy))
    const offset = floor(s * 17)
    const h = hash(floor((px - fx) * 2 / sqrt3 + 0.5) + offset, floor((py - fy) * 2 / 3 + 0.5) + offset)
    const tone = 0.29 + light * (0.24 + b * 0.31) + (h - 0.5) * d * 0.27
    return mix(0.09, tone, smooth(c * 0.16, c * 0.16 + 0.022, edge))
  },
})

const ribbons = geometryStyle({
  id: 'truchet', name: 'Cintas Truchet', palette: 'Terracota', presetSeed: 267193,
  description: 'Cuartos de círculo que se conectan en cintas, bucles y laberintos.',
  parameters: [
    control('Densidad', 'Cantidad de baldosas en la trama.', 0.41),
    control('Anchura', 'Grosor total de cada cinta.', 0.51),
    control('Filete', 'Intensidad de la línea interior.', 0.55),
    control('Orientación', 'Proporción de baldosas con la misma orientación.', 0.50),
  ],
  glsl: `
    vec2 p=vec2(x,y)*(1.45+a*3.2+k*2.0)+vec2(0.37,0.62);
    vec2 cell=floor(p), f=fract(p);
    float h=hash(cell+floor(s*29.0));
    if(h<0.13+d*0.74) f.x=1.0-f.x;
    float edge=min(abs(length(f)-0.5),abs(length(1.0-f)-0.5));
    float width=0.046+b*0.124;
    float ribbon=1.0-smoothstep(width,width+0.016,edge);
    float stripe=1.0-smoothstep(width*0.19,width*0.37,edge);
    return mix(0.13,0.79-c*0.41*stripe,ribbon);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const scale = 1.45 + a * 3.2 + k * 2
    const px = x * scale + 0.37
    const py = y * scale + 0.62
    const offset = floor(s * 29)
    const h = hash(floor(px) + offset, floor(py) + offset)
    const fx = h < 0.13 + d * 0.74 ? 1 - fract(px) : fract(px)
    const fy = fract(py)
    const edge = min(abs(hypot(fx, fy) - 0.5), abs(hypot(1 - fx, 1 - fy) - 0.5))
    const width = 0.046 + b * 0.124
    const ribbon = 1 - smooth(width, width + 0.016, edge)
    const stripe = 1 - smooth(width * 0.19, width * 0.37, edge)
    return mix(0.13, 0.79 - c * 0.41 * stripe, ribbon)
  },
})

const silhouettes = geometryStyle({
  id: 'silhouettes', name: 'Figuras', palette: 'Órbita', presetSeed: 805319,
  description: 'Una figura protagonista con un eco desplazado y espacio alrededor.',
  parameters: [
    { label: 'Figura', description: 'Contorno de la figura principal.', initial: 0.125, safe: [0, 1],
      choices: ['Círculo', 'Cuadrado', 'Triángulo', 'Hexágono'] },
    control('Tamaño', 'Tamaño de la composición principal.', 0.53),
    control('Separación', 'Distancia entre la figura y su eco.', 0.54),
    control('Giro', 'Inclinación de la figura y la diagonal del eco.', 0.39),
  ],
  glsl: `
    float kind=min(floor(a*4.0),3.0);
    vec2 p=rot(vec2(x,y),(d-0.5)*1.57);
    float scale=0.34+b*0.42;
    vec2 shift=vec2(0.13+c*0.36,-0.06-c*0.13);
    vec2 main=(p+shift*0.31)/scale, echo=(p-shift)/(scale*(0.72+k*0.16));
    vec2 h=vec2(abs(main.x),abs(echo.x)), v=vec2(main.y,echo.y);
    vec2 edge;
    if(kind==0.0) edge=vec2(length(main),length(echo))-1.0;
    else if(kind==1.0) edge=max(h,abs(v))-0.79;
    else if(kind==2.0) edge=max(v-0.5,0.8660254*h-0.5*v-0.5);
    else edge=max(h,0.5*h+0.8660254*abs(v))-0.8660254;
    vec2 mask=1.0-smoothstep(vec2(-0.012),vec2(0.014),edge);
    float bg=0.07+0.13*exp(-dot(p,p)*0.72);
    float fill=0.64+0.19*clamp(main.x*0.3-main.y*0.24+0.5,0.0,1.0);
    float rim=smoothstep(-0.065,-0.035,edge.x)*(0.04+0.08*k);
    return mix(mix(bg,0.40+0.06*sin(s),mask.y),fill+rim,mask.x);
  `,
  sample(x, y, a, b, c, d, k, s) {
    const kind = min(floor(a * 4), 3)
    const [px, py] = rotate(x, y, (d - 0.5) * 1.57)
    const scale = 0.34 + b * 0.42
    const shiftX = 0.13 + c * 0.36
    const shiftY = -0.06 - c * 0.13
    const mainX = (px + shiftX * 0.31) / scale
    const mainY = (py + shiftY * 0.31) / scale
    const echoScale = scale * (0.72 + k * 0.16)
    const mainEdge = shapeEdge(kind, mainX, mainY)
    const echoEdge = shapeEdge(kind, (px - shiftX) / echoScale, (py - shiftY) / echoScale)
    const bg = 0.07 + 0.13 * Math.exp(-(px * px + py * py) * 0.72)
    const fill = 0.64 + 0.19 * clamp(mainX * 0.3 - mainY * 0.24 + 0.5)
    const rim = smooth(-0.065, -0.035, mainEdge) * (0.04 + 0.08 * k)
    const base = mix(bg, 0.40 + 0.06 * sin(s), 1 - smooth(-0.012, 0.014, echoEdge))
    return mix(base, fill + rim, 1 - smooth(-0.012, 0.014, mainEdge))
  },
})

function shapeEdge(kind: number, x: number, y: number) {
  const h = abs(x)
  if (kind === 0) return hypot(x, y) - 1
  if (kind === 1) return max(h, abs(y)) - 0.79
  if (kind === 2) return max(y - 0.5, sqrt3 / 2 * h - 0.5 * y - 0.5)
  return max(h, 0.5 * h + sqrt3 / 2 * abs(y)) - sqrt3 / 2
}

export const geometry = [facets, cubes, ribbons, silhouettes] as const
