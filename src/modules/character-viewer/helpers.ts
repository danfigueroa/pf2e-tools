import { TRADITION_COLORS, ink } from '../../theme/palette'
import { parseFeatEntry, type Abilities, type BuildInfo, type SpellCaster } from '../character-sheet/types'

export type AbilityKey = keyof Pick<Abilities, 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>

export const ABILITY_LABELS: Record<AbilityKey, string> = {
    str: 'FOR',
    dex: 'DES',
    con: 'CON',
    int: 'INT',
    wis: 'SAB',
    cha: 'CAR',
}

export function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2)
}

// Proficiência mítica (War of Immortals): um passo acima de lendário.
// Bônus = nível + 10 (lendário é nível + 8). Usada só quando uma habilidade
// mítica manda, normalmente gastando um Ponto Mítico.
export const MYTHIC_PROFICIENCY_BONUS = 10
export { MYTHIC_COLOR } from '../../theme/palette'

// Personagem "mítico" = possui ao menos um talento do tipo Mythic Feat.
export function isMythicCharacter(build: BuildInfo): boolean {
    return (build.feats ?? []).some((f) => /mythic/i.test(parseFeatEntry(f).type))
}

export function signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`
}

export function proficiencyLabel(rank: number): string {
    switch (rank) {
        case 0: return 'Destreinado'
        case 2: return 'Treinado'
        case 4: return 'Especialista'
        case 6: return 'Mestre'
        case 8: return 'Lendário'
        default: return rank > 0 ? `+${rank}` : 'Destreinado'
    }
}

// Símbolo Unicode para ações Pathfinder. Cobre formatos do AON
// ("Three Actions", "OneAction", "1") e do JSON Pathbuilder.
export function actionSymbol(actions?: string | number): string {
    if (actions == null) return ''
    // Normaliza: lowercase + remove espaços para casar "Three Actions" e "ThreeActions" igual.
    const s = String(actions).toLowerCase().replace(/\s+/g, '').trim()
    if (s === '1' || s === 'oneaction' || s === 'singleaction' || s === 'one') return '◆'
    if (s === '2' || s === 'twoactions' || s === 'two') return '◆◆'
    if (s === '3' || s === 'threeactions' || s === 'three') return '◆◆◆'
    if (s === 'reaction' || s === 'r') return '⤴'
    if (s === 'free' || s === 'freeaction' || s === '0') return '◇'
    if (s.includes('to')) return '◆—◆◆◆' // "1 to 3 actions"
    return ''
}

// Cores temáticas por tradição mágica (PF2e canônico) — os tons vivem em
// src/theme/palette.ts, entonados para ler sobre pergaminho.
export { TRADITION_COLORS } from '../../theme/palette'

export function traditionColor(tradition: string): string {
    return TRADITION_COLORS[tradition?.toLowerCase()] || ink.disabled
}

export function traditionLabel(tradition: string): string {
    const map: Record<string, string> = {
        arcane: 'Arcano',
        divine: 'Divino',
        occult: 'Oculto',
        primal: 'Primal',
    }
    return map[tradition?.toLowerCase()] || tradition
}

// CD e bônus de ataque de conjuração de um caster (proficiency já vem
// resolvida do Pathbuilder como bônus 2/4/6/8).
export function spellcasterStats(build: BuildInfo, caster: SpellCaster): { dc: number; attack: number } {
    const abilityScore = (build.abilities as unknown as Record<string, number>)[caster.ability] || 10
    const attack = build.level + caster.proficiency + abilityMod(abilityScore)
    return { dc: 10 + attack, attack }
}

export function getAonSearchUrl(name: string): string {
    return `https://2e.aonprd.com/Search.aspx?q=${encodeURIComponent(name)}`
}

// Total HP: ancestralidade + classe*nível + bonusHpPerLevel*nível + bonusHp + CON*nível
export function totalHp(opts: {
    ancestryHp: number
    classHp: number
    bonusHp: number
    bonusHpPerLevel: number
    level: number
    conScore: number
}): number {
    const conMod = abilityMod(opts.conScore)
    return opts.ancestryHp
        + (opts.classHp + opts.bonusHpPerLevel + conMod) * opts.level
        + opts.bonusHp
}
