/**
 * Onde o Ponto Mítico pode virar proficiência mítica (✦) numa rolagem — e QUAL talento permite.
 *
 * O ✦ aparecia em toda rolagem de personagem mítico, mas pelas regras (War of Immortals) cada
 * uso depende de um talento:
 * - **Rewrite Fate** (todos do grupo têm): reroda um teste de perícia ou uma salvaguarda com
 *   proficiência mítica. Não vale para ataque.
 * - **Mythic Strike** (1 ação — o próprio Golpe): o único ✦ de ataque com arma. Brukuthur,
 *   Nathaniel e Thalos não têm.
 * - **Ears that Hear the Truth**: Sense Motive e a Percepção da iniciativa.
 * - **Feet that Stride the Sky** / **Arms that Cut the Waves**: salto e natação.
 * - **Unbelievably Believable**: Mentir, Causar Impressão, Pedir e Coletar Informações (o Loki).
 * - Ataque de magia: nenhum — o Mythic Magic já conjura com proficiência mítica.
 *
 * Quem não tem o talento do contexto não vê o botão. Onde dois valem (Percepção de iniciativa:
 * Ears OU Rewrite Fate), vence o mais específico.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'

export type MythicContext = 'check' | 'strike' | 'spell-attack' | 'initiative' | 'sense-motive' | 'jump' | 'swim' | 'influence'

export interface MythicOption {
    /** O talento que permite. */
    feat: string
    /** Texto do botão: "✦ Mythic Strike". */
    label: string
}

const norm = (s: string) => s.trim().toLowerCase()

/** Talento ou habilidade pelo nome (Rewrite Fate vem em `specials`; os demais em `feats`). */
function has(build: BuildInfo, name: string): boolean {
    const n = norm(name)
    return (build.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === n)
        || (build.specials ?? []).some((s) => norm(String(s)) === n)
}

const SPECIFIC: Partial<Record<MythicContext, string>> = {
    'strike': 'Mythic Strike',
    'initiative': 'Ears that Hear the Truth',
    'sense-motive': 'Ears that Hear the Truth',
    'jump': 'Feet that Stride the Sky',
    'swim': 'Arms that Cut the Waves',
    'influence': 'Unbelievably Believable',
}

/** Contextos que também são teste de perícia, onde o Rewrite Fate serve de reserva. */
const SKILL_CONTEXTS: ReadonlySet<MythicContext> = new Set(['check', 'initiative', 'sense-motive', 'jump', 'swim', 'influence'])

export function mythicOptionFor(build: BuildInfo, context: MythicContext): MythicOption | null {
    const specific = SPECIFIC[context]
    if (specific && has(build, specific)) return { feat: specific, label: `✦ ${specific}` }
    if (SKILL_CONTEXTS.has(context) && has(build, 'Rewrite Fate')) return { feat: 'Rewrite Fate', label: '✦ Rewrite Fate' }
    return null
}
