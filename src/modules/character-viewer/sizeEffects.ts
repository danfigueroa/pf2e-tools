/**
 * Mudança de tamanho ativa no personagem (Enlarge / Shrink), e o que ela faz
 * com os números da ficha e com o token do mapa.
 *
 * Hoje só a runa homebrew do Brukuthur (`customRunes.ts`) liga isto, mas o
 * efeito é o das magias, então mora à parte: a Iniciativa e o mapa precisam
 * dele sem saber de runa nenhuma.
 *
 * O estado é da MESA (campo `size`): o GM vê o Desajeitado na Iniciativa e o
 * token muda de tamanho no mapa de todo mundo. Como as condições de aflição,
 * o Desajeitado do Enlarge é DERIVADO, nunca gravado — desligar o efeito tira
 * a condição junto, sem ninguém precisar lembrar de desmarcar.
 */
import type { ConditionState } from './components/useConditions'
import type { ConditionModifiers } from './conditions'

export type SizeEffectId = 'enlarge' | 'shrink'

/** O que fica gravado na mesa. */
export interface SizeEffectStored {
    /** Efeito ligado agora; `null` = tamanho normal. */
    active: SizeEffectId | null
    /** A ativação do dia já foi gasta (a runa é 1×/dia). */
    used: boolean
    /** Quando foi ligado (ms) — só para mostrar há quanto tempo. */
    since?: number
}

export const NO_SIZE_EFFECT: SizeEffectStored = { active: null, used: false }

export function sanitizeSizeEffect(raw: unknown): SizeEffectStored {
    if (!raw || typeof raw !== 'object') return NO_SIZE_EFFECT
    const r = raw as Partial<SizeEffectStored>
    const active = r.active === 'enlarge' || r.active === 'shrink' ? r.active : null
    const since = typeof r.since === 'number' && Number.isFinite(r.since) ? r.since : undefined
    return { active, used: !!r.used || !!active, ...(active && since ? { since } : {}) }
}

/** Categorias de tamanho, da menor para a maior, como o Pathbuilder as escreve. */
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const
type SizeKey = (typeof SIZES)[number]

const SIZE_LABEL: Record<SizeKey, string> = {
    tiny: 'Miúdo',
    small: 'Pequeno',
    medium: 'Médio',
    large: 'Grande',
    huge: 'Enorme',
    gargantuan: 'Imenso',
}

/** Canônico em inglês, como `sizeName` do Pathbuilder e `size` da AON. */
const SIZE_EN: Record<SizeKey, string> = {
    tiny: 'Tiny',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    huge: 'Huge',
    gargantuan: 'Gargantuan',
}

const sizeKey = (size: string | null | undefined): SizeKey => {
    const s = (size ?? '').trim().toLowerCase()
    return (SIZES as readonly string[]).includes(s) ? (s as SizeKey) : 'medium'
}

export interface SizeEffectDef {
    id: SizeEffectId
    /** Magia da AON que o efeito reproduz, e o rank. */
    spell: string
    rank: number
    label: string
    /** Tamanho resultante. */
    size: SizeKey
    /** Condições que o efeito impõe enquanto dura. */
    conditions: ConditionState
    /** Bônus de estado no dano dos Golpes corpo a corpo. */
    meleeDamage: number
    summary: string
}

/**
 * As duas magias como a runa as dá: Enlarge no 4º rank, Shrink no rank base.
 * Números do Player Core (Enlarge pg. 329, Shrink pg. 356).
 */
export const SIZE_EFFECTS: Record<SizeEffectId, SizeEffectDef> = {
    enlarge: {
        id: 'enlarge',
        spell: 'Enlarge',
        rank: 4,
        label: 'Aumentar',
        size: 'huge',
        conditions: { clumsy: 1 },
        meleeDamage: 4,
        summary:
            'Enorme por 5 minutos: desajeitado 1, alcance +10 ft e +4 de bônus de estado no dano '
            + 'dos Golpes corpo a corpo. Sem efeito em quem já é Enorme ou maior.',
    },
    shrink: {
        id: 'shrink',
        spell: 'Shrink',
        rank: 2,
        label: 'Encolher',
        size: 'tiny',
        conditions: {},
        meleeDamage: 0,
        summary:
            'Miúdo por 5 minutos e alcance 0. O equipamento encolhe junto e volta ao tamanho '
            + 'original se for removido. Sem efeito em quem já é Miúdo.',
    },
}

/**
 * O efeito NÃO funciona quando a criatura já está no tamanho final ou além
 * ("This spell has no effect on a Huge or larger creature").
 */
export function sizeEffectApplies(id: SizeEffectId, baseSize: string | null | undefined): boolean {
    const from = SIZES.indexOf(sizeKey(baseSize))
    const to = SIZES.indexOf(SIZE_EFFECTS[id].size)
    return id === 'enlarge' ? from < to : from > to
}

/** O efeito que de fato vale agora, ou `null`. */
export function activeSizeEffect(stored: SizeEffectStored, baseSize: string | null | undefined): SizeEffectDef | null {
    if (!stored.active || !sizeEffectApplies(stored.active, baseSize)) return null
    return SIZE_EFFECTS[stored.active]
}

/** Condições impostas — entram como DERIVADAS, como as de aflição. */
export function sizeEffectConditions(effect: SizeEffectDef | null): ConditionState {
    return effect ? effect.conditions : {}
}

/**
 * Os modificadores da ficha com o bônus de dano corpo a corpo do efeito. A
 * identidade se mantém sem efeito — as seções são `memo`.
 */
export function withSizeEffect(mods: ConditionModifiers, effect: SizeEffectDef | null): ConditionModifiers {
    if (!effect || !effect.meleeDamage) return mods
    const from = `${effect.spell} ${effect.rank}º (estado)`
    return { ...mods, meleeDamage: [{ from, type: 'status', value: effect.meleeDamage }] }
}

/** Tamanho em inglês, o que o mapa entende (`sizeSquares`). */
export function effectiveSizeEn(baseSize: string | null | undefined, effect: SizeEffectDef | null): string {
    return SIZE_EN[effect ? effect.size : sizeKey(baseSize)]
}

export function sizeLabel(size: string | null | undefined): string {
    return SIZE_LABEL[sizeKey(size)]
}
