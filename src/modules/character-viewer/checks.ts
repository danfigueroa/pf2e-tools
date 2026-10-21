// Totais dos testes da ficha — salvaguardas, Percepção, perícias e Saberes —
// com a conta à mostra.
//
// É a ÚNICA fonte desses números: a Visão Geral e as Perícias desenham daqui, e
// a rolagem rola daqui. Duas contas para o mesmo número sairiam de sincronia, e
// a rolagem seria a primeira a mentir.
//
// O que entra, na ordem do memorial:
//   proficiência  nível + rank (destreinado não soma o nível no Remaster)
//   atributo      o modificador do atributo do teste
//   item          `build.mods` do Pathbuilder — runa resiliente nas
//                 salvaguardas, botas na Furtividade, o anel do Nathaniel no
//                 Arcanismo. Antes isto ficava de fora e todo o grupo aparecia
//                 com as salvaguardas 1 abaixo do real.
//   armadura      penalidade de armadura nas perícias de FOR/DES, quando a FOR
//                 não alcança a exigência da armadura (números do AON)
//   condições     `effectiveParts`, que já resolve "o mesmo tipo não empilha"

import type { BuildInfo, Proficiencies } from '../../pathbuilder/types'
import { abilityMod, ABILITY_LABELS, mythicProficiencyDelta, proficiencyLabel, type AbilityKey } from './helpers'
import { effectiveParts, SKILL_TARGET, type ConditionModifiers, type ModTarget } from './conditions'

export type CheckPartKind = 'prof' | 'ability' | 'item' | 'armor' | 'condition' | 'base' | 'map' | 'other' | 'mythic'

/** Uma parcela do memorial: "Especialista +14", "CON +4", "Amedrontado 1 −1". */
export interface CheckPart {
    label: string
    value: number
    kind: CheckPartKind
}

export interface Check {
    label: string
    /** Nome em inglês — chave do `build.mods` e do que a mesa vê. */
    en: string
    /** Rank de proficiência (0/2/4/6/8). */
    rank: number
    /** O número do teste, já com as condições. */
    total: number
    /** O mesmo sem as condições — é o "base" do selo de condição. */
    base: number
    /** Soma das condições (0 quando nada pesa). */
    conditionDelta: number
    parts: CheckPart[]
    /**
     * Quanto somar ao `total` para trocar a proficiência pela mítica. É troca,
     * não bônus por cima: desconta o que a proficiência normal já pôs no número.
     */
    mythicDelta: number
}

/** Os números de armadura que a perícia precisa — vêm do AON (`services/gear.ts`). */
export interface ArmorPenalty {
    /** Penalidade de armadura, negativa ou zero ("−2"). */
    checkPenalty: number
    /** Modificador de FOR que zera a penalidade; `null` = sem exigência. */
    strength: number | null
}

export type SaveKey = 'fortitude' | 'reflex' | 'will'

export const SAVES: ReadonlyArray<{ key: SaveKey; label: string; en: string; ability: AbilityKey }> = [
    { key: 'fortitude', label: 'Fortitude', en: 'Fortitude', ability: 'con' },
    { key: 'reflex', label: 'Reflexos', en: 'Reflex', ability: 'dex' },
    { key: 'will', label: 'Vontade', en: 'Will', ability: 'wis' },
]

export type SkillKey = keyof Pick<Proficiencies,
    | 'acrobatics' | 'arcana' | 'athletics' | 'crafting' | 'deception' | 'diplomacy' | 'intimidation'
    | 'medicine' | 'nature' | 'occultism' | 'performance' | 'religion' | 'society' | 'stealth'
    | 'survival' | 'thievery'>

export const SKILLS: ReadonlyArray<{ key: SkillKey; label: string; en: string; ability: AbilityKey }> = [
    { key: 'acrobatics', label: 'Acrobacia', en: 'Acrobatics', ability: 'dex' },
    { key: 'arcana', label: 'Arcanismo', en: 'Arcana', ability: 'int' },
    { key: 'athletics', label: 'Atletismo', en: 'Athletics', ability: 'str' },
    { key: 'crafting', label: 'Ofício', en: 'Crafting', ability: 'int' },
    { key: 'deception', label: 'Engano', en: 'Deception', ability: 'cha' },
    { key: 'diplomacy', label: 'Diplomacia', en: 'Diplomacy', ability: 'cha' },
    { key: 'intimidation', label: 'Intimidação', en: 'Intimidation', ability: 'cha' },
    { key: 'medicine', label: 'Medicina', en: 'Medicine', ability: 'wis' },
    { key: 'nature', label: 'Natureza', en: 'Nature', ability: 'wis' },
    { key: 'occultism', label: 'Ocultismo', en: 'Occultism', ability: 'int' },
    { key: 'performance', label: 'Performance', en: 'Performance', ability: 'cha' },
    { key: 'religion', label: 'Religião', en: 'Religion', ability: 'wis' },
    { key: 'society', label: 'Sociedade', en: 'Society', ability: 'int' },
    { key: 'stealth', label: 'Furtividade', en: 'Stealth', ability: 'dex' },
    { key: 'survival', label: 'Sobrevivência', en: 'Survival', ability: 'wis' },
    { key: 'thievery', label: 'Roubo', en: 'Thievery', ability: 'dex' },
]

/** Rótulo pt-BR do tipo de bônus do Pathbuilder ("Item Bonus" → "Item"). */
const BONUS_TYPE_LABEL: Record<string, string> = {
    'item bonus': 'Item',
    'item penalty': 'Item',
    'status bonus': 'Estado',
    'status penalty': 'Estado',
    'circumstance bonus': 'Circunstância',
    'circumstance penalty': 'Circunstância',
    'untyped bonus': 'Bônus',
    'untyped penalty': 'Penalidade',
}

/**
 * Os bônus que o Pathbuilder declara para um teste, por nome em inglês. O
 * Pathbuilder já resolveu o empilhamento do que ele mesmo declara (um valor por
 * tipo), então cada entrada vira uma parcela. Casamento sem caixa: "Stealth".
 */
export function pathbuilderBonuses(build: BuildInfo, names: string[]): CheckPart[] {
    const mods = build.mods ?? {}
    const wanted = new Set(names.map((n) => n.toLowerCase()))
    const out: CheckPart[] = []
    for (const [key, byType] of Object.entries(mods)) {
        if (!wanted.has(key.toLowerCase()) || !byType || typeof byType !== 'object') continue
        for (const [type, value] of Object.entries(byType)) {
            if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) continue
            out.push({ label: BONUS_TYPE_LABEL[type.toLowerCase()] ?? type, value, kind: 'item' })
        }
    }
    return out
}

/** Parcelas das condições que de fato entraram na conta do alvo. */
export function conditionParts(mods: ConditionModifiers, target: ModTarget): CheckPart[] {
    return effectiveParts(mods, target)
        .filter((p) => p.value !== 0)
        .map((p) => ({ label: p.from, value: p.value, kind: 'condition' as const }))
}

const sum = (parts: CheckPart[]) => parts.reduce((s, p) => s + p.value, 0)

interface CheckInput {
    label: string
    en: string
    /** Nomes aceitos no `build.mods` (o Saber vem como "Warfare Lore" ou "Warfare"). */
    modNames: string[]
    rank: number
    ability: AbilityKey
    target: ModTarget
    armor?: ArmorPenalty | null
}

function buildCheck(build: BuildInfo, mods: ConditionModifiers, input: CheckInput): Check {
    const { level } = build
    const { rank, ability } = input
    const parts: CheckPart[] = [
        // Destreinado não soma o nível no Remaster.
        { label: proficiencyLabel(rank), value: rank > 0 ? level + rank : 0, kind: 'prof' },
        { label: ABILITY_LABELS[ability], value: abilityMod(build.abilities[ability]), kind: 'ability' },
        ...pathbuilderBonuses(build, input.modNames),
    ]
    const acp = armorCheckPenalty(build, ability, input.armor)
    if (acp) parts.push({ label: 'Armadura', value: acp, kind: 'armor' })

    const base = sum(parts)
    const cond = conditionParts(mods, input.target)
    // Reflexive Shield: o bônus do escudo erguido é de circunstância e SOMA aos
    // penalizadores (só a pior penalidade do tipo entra em `conditionParts`).
    if (input.target === 'reflex' && mods.reflexShield) {
        cond.push({ label: 'Reflexive Shield (escudo erguido)', value: mods.reflexShield, kind: 'condition' })
    }
    const conditionDelta = sum(cond)
    return {
        label: input.label,
        en: input.en,
        rank,
        total: base + conditionDelta,
        base,
        conditionDelta,
        parts: [...parts, ...cond],
        mythicDelta: mythicProficiencyDelta(level, rank),
    }
}

/**
 * Penalidade de armadura: só perícia de FOR ou DES, só quando a FOR não alcança
 * a exigência da armadura vestida. Não vale para ação com o traço ataque
 * (Agarrar, Empurrar…) — isso a ficha não tem como saber, e o diálogo avisa.
 */
export function armorCheckPenalty(build: BuildInfo, ability: AbilityKey, armor: ArmorPenalty | null | undefined): number {
    if (!armor || armor.checkPenalty >= 0) return 0
    if (ability !== 'str' && ability !== 'dex') return 0
    if (armor.strength != null && abilityMod(build.abilities.str) >= armor.strength) return 0
    return armor.checkPenalty
}

export function saveCheck(build: BuildInfo, key: SaveKey, mods: ConditionModifiers): Check {
    const def = SAVES.find((s) => s.key === key)!
    return buildCheck(build, mods, {
        label: def.label,
        en: def.en,
        modNames: [def.en],
        rank: build.proficiencies[key] ?? 0,
        ability: def.ability,
        target: key,
    })
}

export function perceptionCheck(build: BuildInfo, mods: ConditionModifiers): Check {
    return buildCheck(build, mods, {
        label: 'Percepção',
        en: 'Perception',
        modNames: ['Perception'],
        rank: build.proficiencies.perception ?? 0,
        ability: 'wis',
        target: 'perception',
    })
}

export function skillCheck(
    build: BuildInfo,
    key: SkillKey,
    mods: ConditionModifiers,
    armor?: ArmorPenalty | null,
): Check {
    const def = SKILLS.find((s) => s.key === key)!
    return buildCheck(build, mods, {
        label: def.label,
        en: def.en,
        modNames: [def.en],
        rank: build.proficiencies[key] ?? 0,
        ability: def.ability,
        target: SKILL_TARGET[def.ability],
        armor,
    })
}

/** Saber: sempre INT; o nome do Pathbuilder vem sem o "Lore". */
export function loreCheck(build: BuildInfo, lore: [string, number], mods: ConditionModifiers): Check {
    const [name, rank] = lore
    return buildCheck(build, mods, {
        label: `Saber (${name})`,
        en: `${name} Lore`,
        modNames: [`${name} Lore`, `Lore: ${name}`, name],
        rank: rank ?? 0,
        ability: 'int',
        target: SKILL_TARGET.int,
    })
}
