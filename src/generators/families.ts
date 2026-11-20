export const familyDescriptions = {
  Gradientes: 'Campos cromáticos',
  Fluidos: 'Corrientes y pliegues',
  Geometría: 'Formas y retículas',
  Simetría: 'Orden y reflejos',
  'Op Art': 'Interferencia óptica',
  Orgánicos: 'Ruido y contornos',
  Experimental: 'Tramas y recursión',
}
export type Family = keyof typeof familyDescriptions
export const families = Object.keys(familyDescriptions) as Family[]
