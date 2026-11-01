// Regera `src/modules/character-viewer/sharedClassFeatures.ts`: os nomes de característica de classe que a AON
// tem em MAIS DE UMA classe ("Weapon Expertise", "Expert Spellcaster"…). Para esses, a ficha busca a descrição
// com a classe junto ("Weapon Expertise (Magus)") — o texto muda de classe para classe, e sem isso a descrição
// saía da primeira classe que a AON devolvesse (o Druida para o Magus).
//   node scripts/fetch-shared-class-features.mjs   (confira o diff)
import { writeFileSync } from 'node:fs'
import { searchAonRaw } from '../api/_lib/aon.js'

const byName = new Map()
for (let from = 0; ; from += 500) {
  const { hits } = await searchAonRaw({ category: 'class-feature', limit: 500, from, sort: [{ 'name.keyword': 'asc' }] })
  for (const { _source: s } of hits) {
    for (const c of (Array.isArray(s.class) ? s.class : [s.class]).filter(Boolean)) {
      if (!byName.has(s.name)) byName.set(s.name, new Set())
      byName.get(s.name).add(c)
    }
  }
  if (hits.length < 500) break
}
const shared = [...byName].filter(([, classes]) => classes.size > 1).map(([name]) => name).sort()
if (shared.length === 0) throw new Error('Nenhum nome compartilhado — a AON mudou o índice?')

const body = `// GERADO por scripts/fetch-shared-class-features.mjs — não edite à mão (rode o script e confira o diff).
//
// Características de classe que a AON tem com o MESMO nome em mais de uma classe. Para elas a ficha busca a
// descrição com a classe do personagem ("Weapon Expertise (Magus)"): o texto muda (armas simples do Druida ×
// marciais do Magus, a tradição do Bardo), e o cache de descrições é global por nome. O servidor reconhece o
// parêntese como classe (\`classHint\` em \`api/_lib/feat-core.js\`) e escolhe a entrada daquela classe.
import type { BuildInfo } from '../../pathbuilder/types'

export const SHARED_CLASS_FEATURES: ReadonlySet<string> = new Set([
${shared.map((n) => `    ${JSON.stringify(n)},`).join('\n')}
])

/** O nome com que a habilidade é BUSCADA (e guardada no cache): com a classe, se o nome é de várias classes. */
export function specialLookupName(build: Pick<BuildInfo, 'class'>, name: string): string {
    const cls = String(build.class ?? '').trim()
    return cls && SHARED_CLASS_FEATURES.has(name) ? \`\${name} (\${cls})\` : name
}
`
writeFileSync(new URL('../src/modules/character-viewer/sharedClassFeatures.ts', import.meta.url), body)
console.log(`${shared.length} nomes compartilhados`)
