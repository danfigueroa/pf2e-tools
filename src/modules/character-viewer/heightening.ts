// Cálculo de heightening (Conjurada com Nível Mais Alto) no client.
// O backend fornece o rank base da magia (spell.level, vindo do AON); as
// entradas de heightening vêm do parser de descrição (format-description.ts),
// que preserva expressões de dado ("2d6") mesmo após a tradução.

import type { HeightenedEntry } from './format-description'
import type { SpellComponent, SpellDescription } from '../character-sheet/types'
import { translateDamageType } from '../transformation-statblock/i18n'

/** Rank efetivo de conjuração: truques e focus spells (slot 0) elevam
 *  automaticamente para ceil(nível/2) (regra Remaster); slots normais usam o
 *  próprio nível do slot. Arquétipos com progressão de conjuração atrasada não
 *  são distinguíveis no JSON do Pathbuilder — assumimos a progressão padrão. */
export function castRankForSlot(slotLevel: number, characterLevel: number): number {
    return slotLevel === 0 ? Math.ceil(characterLevel / 2) : slotLevel
}

export interface AppliedHeightened extends HeightenedEntry {
    applies: boolean   // esta entrada vale para o rank conjurado?
    times: number      // "+N": quantas aplicações; rank fixo: 1
}

/** Normaliza o "level" textual de uma entrada de heightening:
 *  "+1" → {plus:1}; "3rd"/"3º"/"Nível 3"/"3" → {fixed:3}; senão null. */
export function parseHeightenedLevel(level: string): { plus: number } | { fixed: number } | null {
    const t = level.trim()
    const plus = t.match(/^\+\s*(\d+)$/)
    if (plus) return { plus: Number(plus[1]) }
    const fixed = t.match(/^(?:Nível|Level)?\s*(\d+)\s*(?:st|nd|rd|th|[º°ª])?\.?$/i)
    if (fixed) return { fixed: Number(fixed[1]) }
    return null
}

/** Marca cada entrada como aplicável (com multiplicidade) para baseRank→castRank.
 *  - "+N": times = floor((castRank - baseRank) / N), acumula;
 *  - rank fixo: entradas fixas substituem, não acumulam — só a MAIOR ≤ castRank aplica;
 *  - baseRank null/undefined → tudo applies=false (sem dado para calcular). */
export function applyHeightening(
    entries: HeightenedEntry[],
    baseRank: number | null | undefined,
    castRank: number,
): AppliedHeightened[] {
    let bestFixed = -1
    if (baseRank != null) {
        for (const e of entries) {
            const p = parseHeightenedLevel(e.level)
            if (p && 'fixed' in p && p.fixed <= castRank && p.fixed > bestFixed) bestFixed = p.fixed
        }
    }
    return entries.map((e) => {
        if (baseRank == null) return { ...e, applies: false, times: 0 }
        const p = parseHeightenedLevel(e.level)
        if (!p) return { ...e, applies: false, times: 0 }
        if ('plus' in p) {
            const times = p.plus > 0 ? Math.floor((castRank - baseRank) / p.plus) : 0
            return { ...e, applies: times >= 1, times: Math.max(times, 0) }
        }
        const applies = p.fixed === bestFixed
        return { ...e, applies, times: applies ? 1 : 0 }
    })
}

/** Entradas de heightening da magia: as estruturadas do backend quando
 *  existirem (parseadas do EN canônico — confiáveis), senão as extraídas do
 *  texto traduzido pelo parser (fallback para payloads antigos). */
export function spellHeightenedEntries(
    spell: Pick<SpellDescription, 'heightenedEntries'> | undefined,
    parsedEntries: HeightenedEntry[] | undefined,
): HeightenedEntry[] {
    if (spell?.heightenedEntries?.length) return spell.heightenedEntries
    return parsedEntries ?? []
}

/** Um número da magia já no rank conjurado. */
export interface ScaledComponent extends SpellComponent {
    value: { count: number; faces: number; flat: number }
    /** O valor mudou em relação ao da prosa (a magia foi elevada e esta regra pegou nele). */
    changed: boolean
    /**
     * A entrada de rank fixo que vale neste rank não pôde ser lida, e este número
     * é dos que as entradas de rank fixo mexem: o valor mostrado (o da prosa)
     * provavelmente não é o deste rank. A entrada aparece em texto logo abaixo.
     */
    uncertain: boolean
}

export interface ScaledSpell {
    components: ScaledComponent[]
    /** Rank conjurado acima do rank base. */
    heightened: boolean
    /** Entradas aplicáveis neste rank, com a marca de quais já viraram número. */
    entries: (AppliedHeightened & { resolved: boolean })[]
}

/**
 * Os números da magia no rank conjurado, a partir do `scaling` que o backend
 * leu do inglês (`api/_lib/spell-scaling.js`). `+N` acumula
 * `floor((rank − base)/N)` vezes; rank fixo vale a maior entrada ≤ rank, uma
 * vez — a mesma regra de `applyHeightening`. "increases to" substitui.
 *
 * `null` quando o payload não traz `scaling` (cache antigo) ou não se sabe o
 * rank base — aí vale o caminho antigo (`computeHeightenedDamage`).
 */
export function scaleSpell(spell: SpellDescription, castRank: number): ScaledSpell | null {
    const scaling = spell.scaling
    if (!scaling || spell.level == null) return null
    const texts = spell.heightenedEntries ?? []
    const applied = applyHeightening(
        scaling.rules.map((r, i) => ({ level: r.level, text: texts[i]?.text ?? '' })),
        spell.level,
        castRank,
    )
    const values = new Map(scaling.components.map((c) => [c.id, { count: c.count, faces: c.faces, flat: c.flat }]))
    const isFixed = (level: string) => {
        const p = parseHeightenedLevel(level)
        return p != null && 'fixed' in p
    }
    // Rank fixo SUBSTITUI o anterior (só a maior entrada ≤ rank vale). Se a que
    // vale não foi lida, os números que as outras entradas fixas mexem ficam
    // sem valor conhecido neste rank — voltar ao da prosa seria mentir.
    const fixedUnreadable = applied.some((a, i) => a.applies && isFixed(a.level) && !(scaling.rules[i].safe ?? scaling.rules[i].resolved))
    const touchedByFixed = new Set(scaling.rules.filter((r) => isFixed(r.level)).flatMap((r) => r.adds.map((a) => a.id)))
    applied.forEach((a, i) => {
        if (!a.applies) return
        for (const add of scaling.rules[i].adds) {
            const v = values.get(add.id)
            if (!v) continue
            if (add.mode === 'set') {
                values.set(add.id, { count: add.count, faces: add.count ? add.faces : v.faces, flat: add.flat })
            } else {
                values.set(add.id, { count: v.count + add.count * a.times, faces: v.faces, flat: v.flat + add.flat * a.times })
            }
        }
    })
    return {
        heightened: castRank > spell.level,
        components: scaling.components.map((c) => {
            const value = values.get(c.id)!
            return {
                ...c,
                value,
                changed: value.count !== c.count || value.flat !== c.flat || value.faces !== c.faces,
                uncertain: fixedUnreadable && touchedByFixed.has(c.id),
            }
        }),
        entries: applied
            .map((a, i) => ({ ...a, resolved: scaling.rules[i].resolved && !fixedUnreadable }))
            .filter((a) => a.applies),
    }
}

/** `3d6`, `1d6+2`, `5`. */
export function formatValue(v: { count: number; faces: number; flat: number }): string {
    if (v.count === 0) return String(v.flat)
    return `${v.count}d${v.faces}${v.flat > 0 ? `+${v.flat}` : ''}`
}

/** Dano/cura de um componente em pt-BR: "6d4 fogo persistente", "5d8 PV". */
export function componentLabel(c: ScaledComponent): string {
    const value = `${formatValue(c.value)}${c.uncertain ? ' (?)' : ''}`
    if (c.kind === 'healing') return `${value} PV`
    if (c.kind === 'tempHp') return `${value} PV temporários`
    const types = c.types.map(translateDamageType).join('/')
    return [value, types, c.persistent ? 'persistente' : ''].filter(Boolean).join(' ')
}

/** Números não-dano, com rótulo: "Dureza", "Resistência (fogo)", "Cura extra". */
export const NAMED_LABEL: Partial<Record<SpellComponent['kind'], string>> = {
    hardness: 'Dureza',
    resistance: 'Resistência',
    weakness: 'Fraqueza',
    healingExtra: 'Cura extra',
}

export function namedLabel(c: ScaledComponent): string {
    const base = NAMED_LABEL[c.kind] ?? (c.kind === 'tempHp' ? 'PV temporários' : 'Valor')
    return c.types.length ? `${base} (${c.types.map(translateDamageType).join('/')})` : base
}

const DAMAGE_KINDS: SpellComponent['kind'][] = ['damage', 'healing']

/** Os componentes de dano e cura (os que vão na linha "Dano"). */
export const damageComponents = (scaled: ScaledSpell): ScaledComponent[] =>
    scaled.components.filter((c) => DAMAGE_KINDS.includes(c.kind) || (c.kind === 'tempHp' && c.count > 0))

/** Dano no rank conjurado, para o resumo da linha da magia. Com `scaling`,
 *  todos os componentes ("3d8 contundente, 3d8 frio"); sem, o caminho antigo.
 *  Vírgula e não "+": às vezes os danos somam (Ice Storm), às vezes são
 *  alternativas (Gouging Claw é cortante OU perfurante; Blazing Bolt é a versão
 *  de 1 ação OU a de 2) — e a prosa não diz qual é qual de um jeito legível. */
export function damageAtRank(spell: SpellDescription, castRank: number): string | null {
    const scaled = scaleSpell(spell, castRank)
    if (scaled) {
        const dmg = damageComponents(scaled)
        return dmg.length ? dmg.map(componentLabel).join(', ') : null
    }
    if (!spell.damage) return null
    const base = `${spell.damage}${spell.damageType ? ` ${spell.damageType}` : ''}`
    if (spell.level == null || !spell.heightenedEntries?.length) return base
    const applied = applyHeightening(spell.heightenedEntries, spell.level, castRank)
    const dmg = computeHeightenedDamage(spell, applied)
    return dmg ? `${dmg}${spell.damageType ? ` ${spell.damageType}` : ''}` : base
}

/** Entrada de heightening "pura de dano" — o efeito dela já está representado
 *  pelo dano recalculado, então não precisa reaparecer no bloco "neste nível".
 *  Só no caminho antigo (payload sem `scaling`); com ele, quem decide é `resolved`.
 *  Estrito de propósito: qualquer cláusula extra ("e a fraqueza aumenta...")
 *  mantém a entrada visível. */
export function isPureDamageEntry(text: string): boolean {
    const t = text.trim()
    return /^(?:O dano (?:inicial |persistente )?aumenta em|The (?:initial |persistent )?damage increases by|A (?:quantidade de )?cura aumenta em|The (?:amount of )?healing increases by)\s+\d+d\d+(?:\s*[+-]\s*\d+)?[.!]?$/i.test(t)
}

const DICE_RE = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/

/** Caminho antigo, para payload sem `scaling`.
 *  Dano final no rank conjurado, ou null quando não parseável com segurança.
 *  Estratégia conservadora — melhor não calcular do que mostrar número errado:
 *  1. dado base: spell.damage ("1d8") ou a 1ª expressão NdS(+F)? da descrição;
 *  2. exige exatamente UMA entrada "+N" aplicável contendo exatamente UMA
 *     expressão de dado com o MESMO número de faces do dado base;
 *  3. resultado = (base + incremento×times)d faces (+ flat somado). */
export function computeHeightenedDamage(
    spell: Pick<SpellDescription, 'damage' | 'description'>,
    applied: AppliedHeightened[],
): string | null {
    const baseSrc = spell.damage && DICE_RE.test(spell.damage) ? spell.damage : spell.description
    const baseMatch = baseSrc?.match(DICE_RE)
    if (!baseMatch) return null
    const baseCount = Number(baseMatch[1])
    const faces = Number(baseMatch[2])
    const baseFlat = baseMatch[3] ? Number(baseMatch[3]) : 0

    const plusApplied = applied.filter((e) => {
        const p = parseHeightenedLevel(e.level)
        return e.applies && p != null && 'plus' in p
    })
    if (plusApplied.length !== 1) return null
    const entry = plusApplied[0]

    const diceInEntry = entry.text.match(new RegExp(DICE_RE.source, 'g'))
    if (!diceInEntry || diceInEntry.length !== 1) return null
    const incMatch = diceInEntry[0].match(DICE_RE)
    if (!incMatch) return null
    const incCount = Number(incMatch[1])
    const incFaces = Number(incMatch[2])
    const incFlat = incMatch[3] ? Number(incMatch[3]) : 0
    if (incFaces !== faces) return null

    const totalCount = baseCount + incCount * entry.times
    const totalFlat = baseFlat + incFlat * entry.times
    return totalFlat > 0 ? `${totalCount}d${faces}+${totalFlat}` : `${totalCount}d${faces}`
}
