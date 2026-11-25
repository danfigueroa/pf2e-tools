// Escolhas de classe (subclasse): doutrina, racket, metodologia, consciência… Cada tipo da AON pertence a uma classe e é
// uma escolha só, no nível da característica que a abre (o texto de cada classe na AON: "choose a …"). Tipos com várias
// escolhas ou contagem por nível (ikons, táticas, runas, aparições, lições, tese arcana) ficam fora até serem conferidos:
// o motor avisa em vez de inventar a quantidade.
import { tr } from '../../../i18n'
import type { RuleEntry } from '../rules/types'

interface ChoiceType { className: string; label: string; feature: RegExp }

/** Tipo da AON → classe dona e a característica que abre a escolha (pelo nome). */
export const CLASS_CHOICE_TYPES: Record<string, ChoiceType> = {
    'arcane-school': { className: 'Wizard', label: tr('Escola arcana', 'Arcane school'), feature: /arcane school/i },
    bloodline: { className: 'Sorcerer', label: tr('Linhagem', 'Bloodline'), feature: /bloodline/i },
    cause: { className: 'Champion', label: tr('Causa', 'Cause'), feature: /cause/i },
    'conscious-mind': { className: 'Psychic', label: tr('Mente consciente', 'Conscious mind'), feature: /conscious mind/i },
    'subconscious-mind': { className: 'Psychic', label: tr('Mente subconsciente', 'Subconscious mind'), feature: /subconscious mind/i },
    doctrine: { className: 'Cleric', label: tr('Doutrina', 'Doctrine'), feature: /doctrine/i },
    'druidic-order': { className: 'Druid', label: tr('Ordem druídica', 'Druidic order'), feature: /order/i },
    eidolon: { className: 'Summoner', label: tr('Eidolon', 'Eidolon'), feature: /eidolon/i },
    'grim-fascination': { className: 'Necromancer', label: tr('Fascínio sombrio', 'Grim fascination'), feature: /fascination/i },
    'hunters-edge': { className: 'Ranger', label: tr("Hunter's Edge", "Hunter's Edge"), feature: /hunter's edge/i },
    'hybrid-study': { className: 'Magus', label: tr('Estudo híbrido', 'Hybrid study'), feature: /hybrid study/i },
    implement: { className: 'Thaumaturge', label: tr('Implemento', 'Implement'), feature: /implement/i },
    innovation: { className: 'Inventor', label: tr('Inovação', 'Innovation'), feature: /innovation/i },
    instinct: { className: 'Barbarian', label: tr('Instinto', 'Instinct'), feature: /instinct/i },
    methodology: { className: 'Investigator', label: tr('Metodologia', 'Methodology'), feature: /methodology/i },
    muse: { className: 'Bard', label: tr('Musa', 'Muse'), feature: /muse/i },
    mystery: { className: 'Oracle', label: tr('Mistério', 'Mystery'), feature: /myster/i },
    patron: { className: 'Witch', label: tr('Patrono', 'Patron'), feature: /patron/i },
    practice: { className: 'Animist', label: tr('Prática', 'Practice'), feature: /practice/i },
    racket: { className: 'Rogue', label: tr('Racket', 'Racket'), feature: /racket/i },
    'research-field': { className: 'Alchemist', label: tr('Campo de pesquisa', 'Research field'), feature: /research field/i },
    style: { className: 'Swashbuckler', label: tr('Estilo', 'Style'), feature: /style/i },
    way: { className: 'Gunslinger', label: tr('Caminho', 'Way'), feature: /\bway\b/i },
}

/** Tipos com contagem que o motor ainda não conhece: aviso, sem slot. */
export const UNCOUNTED_CHOICE_TYPES: Record<string, string> = {
    ikon: 'Exemplar', epithet: 'Exemplar', tactic: 'Commander', 'runesmith-rune': 'Runesmith', apparition: 'Animist',
    lesson: 'Witch', 'arcane-thesis': 'Wizard',
}

export interface ClassChoiceSlot {
    key: string
    type: string
    level: number
    label: string
    options: RuleEntry[]
}

/** Slots de escolha de classe para a classe escolhida, com o nível da característica que os abre. */
export function classChoiceSlots(cls: RuleEntry | undefined, options: RuleEntry[]): ClassChoiceSlot[] {
    if (!cls) return []
    const features = cls.class?.features ?? []
    const out: ClassChoiceSlot[] = []
    for (const [type, spec] of Object.entries(CLASS_CHOICE_TYPES)) {
        if (spec.className.toLowerCase() !== cls.name.toLowerCase()) continue
        const level = features.find((f) => spec.feature.test(f.name))?.level ?? 1
        const list = options.filter((o) => o.type === type)
        if (list.length) out.push({ key: `class-choice:${type}`, type, level, label: spec.label, options: list })
    }
    return out
}

/**
 * Path to Perfection do Monk (Player Core 2 pg. 114): Fortitude, Reflexos ou Vontade vai a mestre; o Second escolhe OUTRA
 * a mestre; o Third leva uma das duas a lendário. O texto diz "the chosen saving throw", então vira escolha por nível.
 */
export const SAVE_CHOICE_FEATURES: { name: RegExp; rank: 3 | 4 }[] = [
    { name: /^path to perfection$/i, rank: 3 },
    { name: /^second path to perfection$/i, rank: 3 },
    { name: /^third path to perfection$/i, rank: 4 },
]
