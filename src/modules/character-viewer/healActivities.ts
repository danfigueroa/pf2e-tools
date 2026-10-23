/**
 * Curas que são uma AÇÃO do personagem, com dado próprio — o "Usar" genérico só cobra a ação e a
 * cura ficava à mão. Hoje: a **Searing Restoration** (talento de Inventor, Guns & Gears pg. 26/27)
 * e o **Healer's Touch** das Healer's Gloves (GM Core pg. 290). Texto conferido na AON.
 *
 * - Searing Restoration: 1 ação, você ou uma criatura viva adjacente recupera **1d10**, +1d10 no 3º
 *   nível e a cada 2 níveis depois (3, 5, 7…); a criatura curada faz um teste simples imediato contra
 *   uma fonte de sangramento persistente. Tem o traço **Unstable** (abaixo).
 * - Healer's Touch: 1 ação, 1× por dia, **2d6+7** (a Greater, 4d6+15) em criatura viva, disposta e
 *   adjacente; vitalidade, não machuca morto-vivo.
 * - **Unstable** (Guns & Gears Remastered pg. 236): logo depois de aplicar o efeito, teste simples
 *   **CD 15** (13 se lendário em Ofício). Na falha, a inovação pifa e não faz mais ações Unstable até
 *   10 minutos de reajuste; na falha crítica, também **dano de fogo igual à metade do nível**.
 *   O app não sabe qual é a inovação nem se ela está em uso: marca "pifou" no campo `uses`
 *   (`UNSTABLE_BROKEN`) e o jogador devolve depois dos 10 minutos.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'

export interface HealActivity {
    /** Chave do "usada hoje" no campo `uses` (só quando `daily`). */
    key: string
    name: string
    actions: number
    daily: boolean
    unstable: boolean
    count: number
    faces: number
    flat: number
    /** "4d10", "2d6+7". */
    formula: string
    /** O que a regra acrescenta e o app não automatiza. */
    note: string
}

/** Marca em `uses`: a inovação pifou e não faz ação Unstable até o reajuste (10 minutos). */
export const UNSTABLE_BROKEN = 'unstable:broken'

const norm = (s: string) => s.trim().toLowerCase()
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === name)

const formulaOf = (count: number, faces: number, flat: number) => `${count}d${faces}${flat ? `+${flat}` : ''}`

/** Searing Restoration: 1d10 + 1d10 no 3º nível e a cada 2 níveis seguintes (3, 5, 7…). */
export const searingRestorationDice = (level: number): number => 1 + Math.max(0, Math.floor((Math.max(1, level) - 1) / 2))

export function featHeal(build: BuildInfo, name: string): HealActivity | null {
    if (norm(name) !== 'searing restoration' || !hasFeat(build, 'searing restoration')) return null
    const count = searingRestorationDice(build.level ?? 1)
    return {
        key: 'Searing Restoration',
        name: 'Searing Restoration',
        actions: 1,
        daily: false,
        unstable: true,
        count, faces: 10, flat: 0,
        formula: formulaOf(count, 10, 0),
        note: 'Quem foi curado pode fazer um teste simples imediato contra UMA fonte de sangramento persistente (a CD cai com ajuda apropriada).',
    }
}

export function itemHeal(itemName: string): HealActivity | null {
    const n = norm(itemName)
    if (!/^healer'?s gloves\b/.test(n)) return null
    const greater = /greater/.test(n)
    const [count, flat] = greater ? [4, 15] : [2, 7]
    return {
        key: "Healer's Touch",
        name: "Healer's Touch",
        actions: 1,
        daily: true,
        unstable: false,
        count, faces: 6, flat,
        formula: formulaOf(count, 6, flat),
        note: 'Criatura viva, disposta e adjacente. Efeito de vitalidade: não machuca morto-vivo.',
    }
}

/** Ofício lendário (rank 8) baixa a CD do teste simples de 15 para 13. */
export const unstableDc = (build: BuildInfo): number => ((build.proficiencies?.crafting ?? 0) >= 8 ? 13 : 15)

export type UnstableOutcome = 'success' | 'failure' | 'critFailure'

/** Teste simples: passa com a CD ou mais; falha crítica com 10 ou mais abaixo da CD, ou um 1 natural que a falha leva. */
export function unstableOutcome(d20: number, dc: number): UnstableOutcome {
    if (d20 >= dc) return 'success'
    return d20 <= dc - 10 || d20 === 1 ? 'critFailure' : 'failure'
}

/** Dano de fogo da falha crítica: metade do nível, no mínimo 1. */
export const unstableBurn = (level: number): number => Math.max(1, Math.floor((level ?? 1) / 2))
