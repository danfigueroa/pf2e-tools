/**
 * Spellstrike (Impossible Magic pg. 11) dentro do Golpe: o Magus escolhe uma
 * magia preparada, faz UM Golpe corpo a corpo e a magia entra nele.
 *
 * - A magia precisa levar 1 ou 2 ações e exigir ataque de magia ou salvaguarda.
 * - Magia com ataque usa o resultado do Golpe para os dois (o crítico dobra
 *   também a magia). Magia com salvaguarda: o alvo rola a salvaguarda normal e
 *   o dano da magia NÃO dobra com o crítico do Golpe.
 * - O dano dos dois soma para resistências e fraquezas.
 * - Truque não gasta slot; as outras gastam o slot da magia preparada.
 *
 * Entram as magias de qualquer bloco de conjuração (ver `spellstrikeOptions`) e
 * os truques de foco — os psi cantrips do arquétipo de Psíquico (o Imaginary
 * Weapon do Loki), que o Pathbuilder manda em `build.focus`, fora dos blocos.
 */
import type { BuildInfo, SpellCaster, SpellDescription } from '../../pathbuilder/types'
import { slotKey } from './components/useSpellSlots'
import { actionSymbol, isMythicMagicCaster } from './helpers'
import { castRankForSlot } from './heightening'
import { actionRange } from './actionVariants'
import { collectFocusSpells } from './spellNames'
import { hasPsychicArchetype } from './psiAmps'

export interface SpellstrikeOption {
    /** Identidade estável na lista: `bloco|nível|nome` (a mesma magia pode estar em dois blocos). */
    id: string
    name: string
    /** O bloco de conjuração de onde ela vem ("Magus", "Archetype Wizard", "Mythic Magic"…). */
    caster: string
    /** Posição do bloco em `build.spellCasters` — dele sai a CD da magia de salvaguarda. */
    casterIndex: number
    spellLevel: number
    /** Rank em que a magia entra no Golpe (truque = metade do nível, arredondada para cima). */
    rank: number
    /** `mythic` = Mythic Magic: não gasta slot, gasta 1 Ponto Mítico. */
    kind: 'cantrip' | 'prepared' | 'spontaneous' | 'mythic'
    /** Chave do grupo de slots e quantos há — `null` para truque e Mythic Magic. */
    slot: { key: string; total: number } | null
    /** O que ainda resta (slots, ou Pontos Míticos); `null` = à vontade. */
    left: number | null
    /**
     * Truque de foco (fora dos blocos de conjuração): a CD sai do grupo de foco, não de um bloco
     * (`casterIndex` é −1), e `psychic` diz se é psi cantrip — o que dá o amp no Golpe.
     */
    focus?: { dc: number | null; psychic: boolean }
}

/** O bloco de conjuração do Magus, com o índice que as chaves de slot usam. */
export function magusCaster(build: BuildInfo): { caster: SpellCaster; index: number } | null {
    const index = (build.spellCasters ?? []).findIndex((c) => c.name.trim().toLowerCase() === 'magus' && !c.innate)
    return index >= 0 ? { caster: build.spellCasters[index], index } : null
}

/**
 * As magias que podem ir no Golpe: as de QUALQUER bloco de conjuração da ficha — o Spellstrike só
 * pede que você conjure uma magia de 1 ou 2 ações com ataque ou salvaguarda, venha de onde vier
 * (o Live Wire do arquétipo de Mago e o Blazing Bolt do Mythic Magic entram). Só dá para ter
 * Spellstrike se a ficha tem a característica; quem a chama checa.
 *
 * O Mythic Magic não tem slot: cada conjuração gasta 1 Ponto Mítico (`mythicLeft`). O ataque
 * continua sendo o do Golpe — a proficiência mítica da magia não entra, porque quem rola é o Strike.
 */
export function spellstrikeOptions(build: BuildInfo, usedOf: (key: string) => number, mythicLeft = 0): SpellstrikeOption[] {
    const out: SpellstrikeOption[] = []
    ;(build.spellCasters ?? []).forEach((caster, index) => {
        const mythicMagic = isMythicMagicCaster(caster)
        const spontaneous = caster.spellcastingType === 'spontaneous'
        for (const level of caster.spells) {
            const counts = new Map<string, number>()
            for (const n of level.list) counts.set(n, (counts.get(n) ?? 0) + 1)
            for (const [name, count] of counts) {
                const rank = castRankForSlot(level.spellLevel, build.level)
                const base = { id: `${index}|${level.spellLevel}|${name}`, name, caster: caster.name, casterIndex: index, spellLevel: level.spellLevel, rank }
                if (mythicMagic) {
                    out.push({ ...base, kind: 'mythic', slot: null, left: mythicLeft })
                } else if (level.spellLevel === 0) {
                    out.push({ ...base, kind: 'cantrip', slot: null, left: null })
                } else if (spontaneous) {
                    const total = caster.perDay?.[level.spellLevel] ?? 0
                    const key = slotKey(index, caster.name, level.spellLevel)
                    out.push({ ...base, kind: 'spontaneous', slot: { key, total }, left: Math.max(0, total - usedOf(key)) })
                } else {
                    const key = slotKey(index, caster.name, level.spellLevel, name)
                    out.push({ ...base, kind: 'prepared', slot: { key, total: count }, left: Math.max(0, count - usedOf(key)) })
                }
            }
        }
    })
    // Truques de foco: à vontade, como os outros truques. O que já veio de um bloco não repete.
    const known = new Set(out.map((o) => o.name))
    for (const entry of collectFocusSpells(build)) {
        if (!entry.cantrip || known.has(entry.name)) continue
        const { proficiency, abilityBonus, itemBonus } = entry.group
        const dc = proficiency != null && abilityBonus != null ? 10 + build.level + proficiency + abilityBonus + (itemBonus ?? 0) : null
        const psychic = build.class === 'Psychic' || (entry.tradition === 'occult' && hasPsychicArchetype(build))
        out.push({
            id: `foco|${entry.tradition}|${entry.name}`, name: entry.name, caster: 'Truques de foco', casterIndex: -1,
            spellLevel: 0, rank: castRankForSlot(0, build.level), kind: 'cantrip', slot: null, left: null, focus: { dc, psychic },
        })
    }
    return out
}

/** Por que a magia não serve para Spellstrike; `null` = serve (ou ainda não dá para saber). */
export function spellstrikeIssue(spell: SpellDescription | null): string | null {
    if (!spell) return null
    const sym = actionSymbol(spell.actions)
    // Magia de ação variável (Blazing Bolt, 1 a 3) serve se puder ser conjurada com 1 ou 2 ações.
    const range = actionRange(spell.actions)
    if (range) {
        if (range.min > 2) return 'Spellstrike só aceita magia de 1 ou 2 ações.'
    } else if (spell.actions != null && sym !== '◆' && sym !== '◆◆') {
        return 'Spellstrike só aceita magia de 1 ou 2 ações.'
    }
    const traits = (spell.traits ?? []).map((t) => t.toLowerCase())
    const hasSave = !!(spell.defense ?? '').trim()
    if (!traits.includes('attack') && !hasSave) {
        return 'A magia precisa exigir ataque de magia ou salvaguarda.'
    }
    return null
}

/** A magia usa o ataque do Golpe (e dobra no crítico)? Senão é salvaguarda. */
export const spellstrikeUsesAttack = (spell: SpellDescription): boolean =>
    (spell.traits ?? []).some((t) => t.toLowerCase() === 'attack')
