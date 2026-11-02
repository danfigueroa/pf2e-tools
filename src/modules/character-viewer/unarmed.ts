import type { BuildInfo } from '../../pathbuilder/types'
import { strikingDice } from '../../pathbuilder/weapon'
import { abilityMod } from './helpers'
import { tr } from '../../i18n'

/**
 * Ataques desarmados. O JSON do Pathbuilder **não exporta ataque desarmado
 * nenhum** — nem o punho padrão, nem os naturais de ancestralidade/item — então
 * a tabela abaixo é escrita à mão a partir das regras (mesma ideia dos guias
 * curados em `combatGuides.ts`). Os números saem calculados daqui, das regras
 * do Remaster; nada vem pronto da ficha.
 */

/** Ataque desarmado já calculado, pronto para exibir. */
export interface UnarmedAttack {
    id: string
    /** Nome em pt-BR. */
    name: string
    /** Nome canônico em inglês (o que se busca na AON). */
    en: string
    attack: number
    /** Fórmula de dano: "1d4+2". */
    damage: string
    damageType: string
    extraDamage?: string[]
    /** Traits já em pt-BR. */
    traits: string[]
    /** Penalidade de ataques múltiplos: ágil dá −4/−8, o resto −5/−10. */
    map: string
    /** De onde o ataque vem (ancestralidade, item…). */
    source: string
    note?: string
    /** Escolha do jogador que a ficha não registra — mostramos as opções. */
    choice?: boolean
    /** Ataque de Destreza (acuidade valendo a pena) — muda a condição que pesa. */
    usesDex: boolean
    /** Traços que mudam a rolagem (MAP e atributo), fora da lista traduzida. */
    agile: boolean
    finesse: boolean
}

interface UnarmedBase {
    en: string
    name: string
    die: string
    damageType: string
    /** Canônicos em inglês; traduzidos no render (`TRAIT_LABELS`). */
    traits: string[]
    extraDamage?: string[]
}

/**
 * Tabela "Unarmed Attack" da ancestralidade Awakened Animal (Howl of the Wild
 * pg. 22). Todos são do grupo brawling e têm o trait unarmed.
 */
const ANIMAL_ATTACKS: Record<string, UnarmedBase> = {
    antler: { en: 'Antler', name: tr('Galhada', 'Antler'), die: 'd6', damageType: tr('perfurante', 'piercing'), traits: ['finesse'] },
    beak: { en: 'Beak', name: tr('Bico', 'Beak'), die: 'd6', damageType: tr('perfurante', 'piercing'), traits: ['finesse'] },
    claw: { en: 'Claw', name: tr('Garra', 'Claw'), die: 'd4', damageType: tr('cortante', 'slashing'), traits: ['agile', 'finesse'] },
    fangs: { en: 'Fangs', name: tr('Presas', 'Fangs'), die: 'd6', damageType: tr('perfurante', 'piercing'), traits: ['finesse'] },
    fist: { en: 'Fist', name: tr('Punho', 'Fist'), die: 'd4', damageType: tr('contundente', 'bludgeoning'), traits: ['agile', 'finesse', 'nonlethal'] },
    horn: { en: 'Horn', name: tr('Chifre', 'Horn'), die: 'd6', damageType: tr('perfurante', 'piercing'), traits: ['finesse'] },
    jaws: { en: 'Jaws', name: tr('Mandíbulas', 'Jaws'), die: 'd6', damageType: tr('perfurante', 'piercing'), traits: ['finesse'] },
    tail: { en: 'Tail', name: tr('Cauda', 'Tail'), die: 'd6', damageType: tr('contundente', 'bludgeoning'), traits: ['finesse', 'trip'] },
    talon: { en: 'Talon', name: tr('Talão', 'Talon'), die: 'd4', damageType: tr('perfurante', 'piercing'), traits: ['agile', 'finesse'] },
    tongue: { en: 'Tongue', name: tr('Língua', 'Tongue'), die: 'd6', damageType: tr('contundente', 'bludgeoning'), traits: ['finesse'] },
    wing: { en: 'Wing', name: tr('Asa', 'Wing'), die: 'd4', damageType: tr('contundente', 'bludgeoning'), traits: ['agile', 'finesse'] },
}

const TRAIT_LABELS: Record<string, string> = {
    agile: tr('Ágil', 'Agile'),
    finesse: tr('Acuidade', 'Finesse'),
    nonlethal: tr('Não letal', 'Nonlethal'),
    trip: tr('Derrubar', 'Trip'),
    unarmed: tr('Desarmado', 'Unarmed'),
}

/**
 * Awakened Animal: a herança dá **um** ataque animal no lugar do punho,
 * escolhido com o GM (Howl of the Wild pg. 22). A ficha não registra qual,
 * então listamos os típicos que cada herança sugere.
 */
const AWAKENED_HERITAGE_CHOICES: Record<string, string[]> = {
    'running animal': ['claw', 'jaws', 'tail'],
    'climbing animal': ['claw', 'fist', 'jaws'],
    'flying animal': ['beak', 'claw', 'jaws', 'talon', 'wing'],
    'swimming animal': ['claw', 'jaws', 'tail'],
}

/**
 * A ficha registra só a herança (Running Animal, Flying Animal…), que é ampla
 * demais — Running Animal cobre de urso a cavalo. Quando sabemos a espécie do
 * personagem, a lista sai daqui, casando **pelo nome** como os guias de
 * `combatGuides.ts`: o urso do Ardagar não tem cauda para atacar.
 */
const CHARACTER_ANIMALS: Record<string, { animal: string; attacks: string[] }> = {
    ardagar: { animal: tr('Urso', 'Bear'), attacks: ['claw', 'jaws'] },
}

/** Itens que concedem um ataque desarmado — casados pelo nome do item. */
const ITEM_ATTACKS: Record<string, { base: UnarmedBase; note: string }> = {
    'wolfjaw armor': {
        base: {
            en: 'Jaws',
            name: tr('Mandíbulas', 'Jaws'),
            die: 'd8',
            damageType: tr('perfurante', 'piercing'),
            traits: ['trip'],
            extraDamage: [tr('1 de frio', '1 cold')],
        },
        note: tr('Ativação ◆ (uma vez por hora) para ganhar o ataque; feito com as mãos.', 'Activation ◆ (once per hour) to gain the attack; made with the hands.'),
    },
}

interface Grant {
    base: UnarmedBase
    source: string
    note?: string
    choice?: boolean
}

/** Runas de Handwraps of Mighty Blows, que valem para todo ataque desarmado. */
interface UnarmedRunes {
    potency: number
    striking: string | null
}

/**
 * O Pathbuilder exporta o item só pelo nome, então as runas saem do próprio
 * nome ("+2 Greater Striking Handwraps of Mighty Blows").
 */
function handwrapRunes(build: BuildInfo): UnarmedRunes {
    const entry = (build.equipment ?? []).find((e) => /handwraps/i.test(String(e?.[0] ?? '')))
    if (!entry) return { potency: 0, striking: null }
    const name = String(entry[0])
    const pot = name.match(/\+(\d)/)
    const striking = /major\s+striking/i.test(name) ? 'major striking'
        : /greater\s+striking/i.test(name) ? 'greater striking'
            : /striking/i.test(name) ? 'striking'
                : null
    return { potency: pot ? Number(pot[1]) : 0, striking }
}

function collectGrants(build: BuildInfo): Grant[] {
    const grants: Grant[] = []
    const heritage = (build.heritage || '').toLowerCase()

    if (/awakened animal/i.test(build.ancestry || '')) {
        // A herança substitui o punho por um ataque animal.
        const known = CHARACTER_ANIMALS[(build.name || '').trim().toLowerCase()]
        const keys = known?.attacks ?? AWAKENED_HERITAGE_CHOICES[heritage] ?? ['claw', 'jaws']
        const source = known?.animal
            ?? (build.heritage ? `${build.heritage} (Awakened Animal)` : 'Awakened Animal')
        const note = known
            ? tr(`${known.animal}: ataque animal à escolha do personagem — a ficha não registra qual foi.`, `${known.animal}: animal attack of the character's choice — the sheet doesn't record which one.`)
            : tr('Ataque animal à escolha do personagem — a ficha não registra qual foi.', 'Animal attack of the character\'s choice — the sheet doesn\'t record which one.')
        for (const key of keys) {
            grants.push({ base: ANIMAL_ATTACKS[key], source, note, choice: true })
        }
    } else {
        grants.push({ base: ANIMAL_ATTACKS.fist, source: tr('Todo personagem', 'Every character') })
    }

    // Itens equipados (armadura vestida ou item investido) que dão ataque.
    const itemNames = [
        ...(build.armor ?? []).map((a) => a.name),
        ...(build.equipment ?? []).map((e) => String(e?.[0] ?? '')),
    ]
    for (const raw of itemNames) {
        const hit = ITEM_ATTACKS[raw.toLowerCase()]
        if (hit) grants.push({ base: hit.base, source: raw, note: hit.note })
    }

    return grants
}

const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => s.trim().toLowerCase() === name.toLowerCase())

/**
 * Weapon Specialization (Player Core): dano a mais com armas e ataques desarmados em que o personagem é
 * perito (+2), mestre (+3) ou lendário (+4); a Greater Weapon Specialization dobra (4, 6, 8). O Pathbuilder já
 * soma isso nas ARMAS (`damageBonus`), mas não existe ataque desarmado no export — a conta é daqui.
 */
export function weaponSpecializationBonus(build: BuildInfo, rank: number): number {
    if (rank < 4) return 0
    const greater = hasSpecial(build, 'Greater Weapon Specialization')
    if (!greater && !hasSpecial(build, 'Weapon Specialization')) return 0
    const step = rank >= 8 ? 2 : rank >= 6 ? 1 : 0
    return (greater ? [4, 6, 8] : [2, 3, 4])[step]
}

/** Ataques desarmados do personagem, com ataque e dano já calculados. */
export function unarmedAttacks(build: BuildInfo): UnarmedAttack[] {
    const runes = handwrapRunes(build)
    const strMod = abilityMod(build.abilities.str)
    const dexMod = abilityMod(build.abilities.dex)
    const profBonus = build.proficiencies?.unarmed ?? 0
    // Destreinado não soma o nível (PF2e Remaster).
    const profMod = profBonus > 0 ? build.level + profBonus : 0
    const specBonus = weaponSpecializationBonus(build, profBonus)
    // Powerful Fist (Monge, Player Core 2 pg. 114): o punho passa de 1d4 para 1d6.
    const powerfulFist = hasSpecial(build, 'Powerful Fist')

    return collectGrants(build).map((grant, idx) => {
        const b = grant.base
        const finesse = b.traits.includes('finesse')
        const agile = b.traits.includes('agile')
        // Acuidade permite trocar Força por Destreza no ataque; o dano de corpo
        // a corpo continua sendo Força.
        const usesDex = finesse && dexMod > strMod
        const attackMod = usesDex ? dexMod : strMod
        const die = powerfulFist && b.en === 'Fist' ? 'd6' : b.die
        const dice = `${strikingDice(runes.striking)}${die}`
        const flat = strMod + specBonus
        const damage = flat === 0 ? dice : `${dice}${flat > 0 ? '+' : ''}${flat}`

        return {
            id: `${b.en}-${idx}`,
            name: b.name,
            en: b.en,
            attack: profMod + attackMod + runes.potency,
            damage,
            damageType: b.damageType,
            extraDamage: b.extraDamage,
            traits: [...b.traits, 'unarmed'].map((t) => TRAIT_LABELS[t] ?? t),
            map: agile ? '−4 / −8' : '−5 / −10',
            source: grant.source,
            note: grant.note,
            choice: grant.choice,
            usesDex,
            agile,
            finesse,
        }
    })
}
