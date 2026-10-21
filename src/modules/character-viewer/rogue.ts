/**
 * O que o Ladino faz com a ficha: **Poison Weapon** e **Debilitating Strike**.
 *
 * - **Poison Weapon** (Player Core pg. 171, 1 ação, manipular): aplica na arma um
 *   veneno de CONTATO ou de INJEÇÃO. O veneno fica na arma até acertar — por
 *   isso o app guarda "arma envenenada com X" e só quem sabe que acertou o
 *   apaga. Aplicar GASTA uma unidade do inventário (o mesmo contador dos
 *   consumíveis); veneno inalado ou ingerido não serve.
 * - **Debilitating Strike** (nível 9, ação livre): depois de um Golpe que acerta
 *   e causa dano num alvo desprevenido, escolhe −3 m (−10 pés) de deslocamento
 *   ou Enfraquecido 1 até o fim do próximo turno. O app não sabe se acertou,
 *   então é uma anotação da rolagem.
 *
 * O dano e o efeito do veneno são do GM (aflição na Iniciativa): o app mostra a
 * CD e a salvaguarda e deixa a rolagem dizer qual veneno entrou. Quem tem cada
 * coisa vem da ficha. Estado da MESA (campo `rogue`).
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { ItemTraits } from '../../services/itemTraits'

export interface RogueStored {
    /** Nome (do Pathbuilder) do veneno que está na arma; `null` = arma limpa. */
    poison: string | null
    /** Doses do veneno simples (o do talento) já usadas desde a última preparação diária. */
    simpleUsed: number
}

export const NO_ROGUE: RogueStored = { poison: null, simpleUsed: 0 }

/**
 * O veneno SIMPLES do Poison Weapon vai gravado em `poison` com este nome: um
 * nome que nenhum item do Pathbuilder tem, para não colidir com o inventário.
 */
export const SIMPLE_POISON = '@simple'

export function sanitizeRogue(raw: unknown): RogueStored {
    if (!raw || typeof raw !== 'object') return NO_ROGUE
    const r = raw as Partial<RogueStored>
    const poison = typeof r.poison === 'string' && r.poison.trim() ? r.poison.trim().slice(0, 120) : null
    const used = typeof r.simpleUsed === 'number' && Number.isFinite(r.simpleUsed) ? Math.min(99, Math.max(0, Math.floor(r.simpleUsed))) : 0
    return poison === null && used === 0 ? NO_ROGUE : { poison, simpleUsed: used }
}

export const isRogueEmpty = (s: RogueStored) => s.poison === null && s.simpleUsed === 0

/** Doses do veneno simples por dia: o nível do personagem (preparadas na preparação diária). */
export const simpleDoses = (build: BuildInfo): number => Math.max(0, build.level)

export const hasImprovedPoisonWeapon = (b: BuildInfo) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === 'improved poison weapon')

/** Dano do veneno simples: 1d4 de veneno, 2d4 com o Improved Poison Weapon — sem salvaguarda. */
export const simplePoisonDice = (b: BuildInfo): { count: number; faces: number } =>
    ({ count: hasImprovedPoisonWeapon(b) ? 2 : 1, faces: 4 })

export const isSimplePoison = (name: string | null) => name === SIMPLE_POISON

const norm = (s: string) => s.trim().toLowerCase()
export const hasPoisonWeapon = (b: BuildInfo) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === 'poison weapon')
export const hasDebilitatingStrike = (b: BuildInfo) => (b.specials ?? []).some((s) => norm(s) === 'debilitating strike')

/** Serve para Poison Weapon: veneno de contato ou de injeção. */
export function isApplicablePoison(traits: ItemTraits | null | undefined): boolean {
    if (!traits) return false
    const t = traits.traits.map(norm)
    return t.includes('poison') && (t.includes('contact') || t.includes('injury'))
}

export type Debilitation = 'speed' | 'enfeebled'

export const DEBILITATIONS: Array<{ id: Debilitation; label: string; note: string }> = [
    { id: 'speed', label: 'Deslocamento −3 m', note: 'Debilitating Strike: deslocamento −3 m (−10 pés) até o fim do próximo turno' },
    { id: 'enfeebled', label: 'Enfraquecido 1', note: 'Debilitating Strike: Enfraquecido 1 até o fim do próximo turno' },
]

/** O texto da rolagem sobre o veneno da arma. */
export function poisonNote(name: string, def: { dc: number | null; save: string | null } | null): string {
    const save = def?.save ? { fortitude: 'Fortitude', reflex: 'Reflexos', will: 'Vontade' }[def.save] ?? def.save : null
    return `veneno: ${name}${def?.dc ? ` (CD ${def.dc}${save ? ` ${save}` : ''})` : ''}`
}
