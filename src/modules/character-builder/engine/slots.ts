// Slots de talento por nível (MOTOR-DE-REGRAS §9 e §14). Os níveis da classe vêm do catálogo (`featLevels`, do Foundry,
// conferidos contra a tabela de avanço da AON nas 29 classes). As variantes, conferidas na AON:
// - Free Archetype (GM Core pg. 84, "Building a Character"): um talento de classe extra no 2º nível e em todo nível par,
//   só para talentos de arquétipo.
// - Mítico (War of Immortals pg. 77, "Mythic Progression"): um talento mítico extra no 2º nível e em todo nível par; no
//   12º, obrigatoriamente o talento de destino.
// - Ancestry Paragon (Gamemastery Guide pg. 194, legado): dois talentos de ancestralidade no 1º e mais um em cada nível
//   ímpar (3º, 5º, 7º…), 11 no total — no lugar dos de 1/5/9/13/17.
import { tr } from '../../../i18n'
import type { BuildState, MesaRules } from '../types'
import type { RuleEntry } from '../rules/types'

export type FeatKind = 'ancestry' | 'class' | 'general' | 'skill' | 'archetype' | 'mythic' | 'paragon'

export interface FeatSlot {
    key: string
    kind: FeatKind
    level: number
    label: string
    /** Escolha concedida por outro talento (ChoiceSet), com o filtro dele. */
    parent?: string
    /** Teto de nível do talento quando menor que o do slot (Combat Flexibility: 8º ou menor). */
    maxLevel?: number
}

/**
 * Características que abrem slot de talento (Player Core pg. 136): Combat Flexibility, no 9º, um talento de Fighter de
 * 8º nível ou menor; Improved Flexibility, no 15º, mais um de até 14º. O Pathbuilder também os trata como slots.
 */
const FEATURE_SLOTS: { name: RegExp; kind: FeatKind; maxLevel: number; key: string }[] = [
    { name: /^combat flexibility$/i, kind: 'class', maxLevel: 8, key: 'flexibility' },
    { name: /^improved flexibility$/i, kind: 'class', maxLevel: 14, key: 'flexibility' },
]

export interface VariantFlags {
    freeArchetype: boolean
    mythic: boolean
    ancestralParagon: boolean
}

/** Variantes valendo para este personagem: a do personagem, quando definida, senão a da mesa. */
export function variantFlags(state: BuildState, mesa?: MesaRules): VariantFlags {
    const own = state.options.variants ?? {}
    const v = mesa?.variants
    return {
        freeArchetype: own.freeArchetype ?? v?.freeArchetype ?? false,
        mythic: state.options.mythic?.enabled ?? v?.mythic.enabled ?? false,
        ancestralParagon: own.ancestralParagon ?? v?.ancestralParagon ?? false,
    }
}

const KIND_LABEL: Record<FeatKind, string> = {
    ancestry: tr('Talento de ancestralidade', 'Ancestry feat'),
    class: tr('Talento de classe', 'Class feat'),
    general: tr('Talento geral', 'General feat'),
    skill: tr('Talento de perícia', 'Skill feat'),
    archetype: tr('Arquétipo livre', 'Free archetype'),
    mythic: tr('Talento mítico', 'Mythic feat'),
    paragon: tr('Ancestry Paragon', 'Ancestry Paragon'),
}
export const featKindLabel = (kind: FeatKind) => KIND_LABEL[kind]

const EVEN = Array.from({ length: 10 }, (_, i) => (i + 1) * 2)
const ODD = Array.from({ length: 10 }, (_, i) => i * 2 + 1)

/** Todos os slots de talento do 1 ao 20 (o plano mostra os futuros esmaecidos). */
export function featSlots(cls: RuleEntry | undefined, flags: VariantFlags): FeatSlot[] {
    const slots: FeatSlot[] = []
    const add = (kind: FeatKind, levels: number[]) => {
        for (const level of levels) slots.push({ key: `${kind}-feat-${level}`, kind, level, label: KIND_LABEL[kind] })
    }
    const fl = cls?.class?.featLevels
    const ancestryLevels = fl?.ancestry ?? [1, 5, 9, 13, 17]
    add('ancestry', ancestryLevels)
    if (cls) {
        add('class', fl?.class ?? [])
        add('general', fl?.general ?? [])
        add('skill', fl?.skill ?? [])
    }
    for (const feature of cls?.class?.features ?? []) {
        const spec = FEATURE_SLOTS.find((f) => f.name.test(feature.name))
        if (spec) slots.push({ key: `${spec.key}-feat-${feature.level}`, kind: spec.kind, level: feature.level, maxLevel: spec.maxLevel, label: feature.name })
    }
    if (flags.freeArchetype) add('archetype', EVEN)
    if (flags.mythic) add('mythic', EVEN)
    // Paragon: completa os de ancestralidade até "dois no 1º e um em cada ímpar".
    if (flags.ancestralParagon) add('paragon', [1, ...ODD.filter((l) => l > 1 && !ancestryLevels.includes(l))])
    const order: FeatKind[] = ['ancestry', 'paragon', 'class', 'archetype', 'skill', 'general', 'mythic']
    return slots.sort((a, b) => a.level - b.level || order.indexOf(a.kind) - order.indexOf(b.kind))
}

/** O talento serve para o slot? (pelos traços; o motor avisa, não trava). */
export function fitsSlot(feat: RuleEntry, kind: FeatKind, ctx: { className?: string; ancestryTraits: string[] }): boolean {
    const traits = new Set((feat.traits ?? []).map((t) => t.toLowerCase()))
    switch (kind) {
    // Talento de arquétipo também ocupa slot de classe (Player Core pg. 215: "archetype feats … class feat").
    case 'class': return (!!ctx.className && traits.has(ctx.className.toLowerCase())) || traits.has('archetype')
    case 'archetype': return traits.has('archetype')
    case 'ancestry':
    case 'paragon': return ctx.ancestryTraits.some((t) => traits.has(t.toLowerCase()))
    case 'general': return traits.has('general')
    case 'skill': return traits.has('skill')
    case 'mythic': return traits.has('mythic')
    }
}
