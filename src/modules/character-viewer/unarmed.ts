import type { BuildInfo } from '../character-sheet/types'
import { strikingDice } from '../character-sheet/weapon'
import { abilityMod } from './helpers'

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
    antler: { en: 'Antler', name: 'Galhada', die: 'd6', damageType: 'perfurante', traits: ['finesse'] },
    beak: { en: 'Beak', name: 'Bico', die: 'd6', damageType: 'perfurante', traits: ['finesse'] },
    claw: { en: 'Claw', name: 'Garra', die: 'd4', damageType: 'cortante', traits: ['agile', 'finesse'] },
    fangs: { en: 'Fangs', name: 'Presas', die: 'd6', damageType: 'perfurante', traits: ['finesse'] },
    fist: { en: 'Fist', name: 'Punho', die: 'd4', damageType: 'contundente', traits: ['agile', 'finesse', 'nonlethal'] },
    horn: { en: 'Horn', name: 'Chifre', die: 'd6', damageType: 'perfurante', traits: ['finesse'] },
    jaws: { en: 'Jaws', name: 'Mandíbulas', die: 'd6', damageType: 'perfurante', traits: ['finesse'] },
    tail: { en: 'Tail', name: 'Cauda', die: 'd6', damageType: 'contundente', traits: ['finesse', 'trip'] },
    talon: { en: 'Talon', name: 'Talão', die: 'd4', damageType: 'perfurante', traits: ['agile', 'finesse'] },
    tongue: { en: 'Tongue', name: 'Língua', die: 'd6', damageType: 'contundente', traits: ['finesse'] },
    wing: { en: 'Wing', name: 'Asa', die: 'd4', damageType: 'contundente', traits: ['agile', 'finesse'] },
}

const TRAIT_LABELS: Record<string, string> = {
    agile: 'Ágil',
    finesse: 'Acuidade',
    nonlethal: 'Não letal',
    trip: 'Derrubar',
    unarmed: 'Desarmado',
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
    ardagar: { animal: 'Urso', attacks: ['claw', 'jaws'] },
}

/** Itens que concedem um ataque desarmado — casados pelo nome do item. */
const ITEM_ATTACKS: Record<string, { base: UnarmedBase; note: string }> = {
    'wolfjaw armor': {
        base: {
            en: 'Jaws',
            name: 'Mandíbulas',
            die: 'd8',
            damageType: 'perfurante',
            traits: ['trip'],
            extraDamage: ['1 de frio'],
        },
        note: 'Ativação ◆ (uma vez por hora) para ganhar o ataque; feito com as mãos.',
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
            ? `${known.animal}: ataque animal à escolha do personagem — a ficha não registra qual foi.`
            : 'Ataque animal à escolha do personagem — a ficha não registra qual foi.'
        for (const key of keys) {
            grants.push({ base: ANIMAL_ATTACKS[key], source, note, choice: true })
        }
    } else {
        grants.push({ base: ANIMAL_ATTACKS.fist, source: 'Todo personagem' })
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

/** Ataques desarmados do personagem, com ataque e dano já calculados. */
export function unarmedAttacks(build: BuildInfo): UnarmedAttack[] {
    const runes = handwrapRunes(build)
    const strMod = abilityMod(build.abilities.str)
    const dexMod = abilityMod(build.abilities.dex)
    const profBonus = build.proficiencies?.unarmed ?? 0
    // Destreinado não soma o nível (PF2e Remaster).
    const profMod = profBonus > 0 ? build.level + profBonus : 0

    return collectGrants(build).map((grant, idx) => {
        const b = grant.base
        const finesse = b.traits.includes('finesse')
        const agile = b.traits.includes('agile')
        // Acuidade permite trocar Força por Destreza no ataque; o dano de corpo
        // a corpo continua sendo Força.
        const usesDex = finesse && dexMod > strMod
        const attackMod = usesDex ? dexMod : strMod
        const dice = `${strikingDice(runes.striking)}${b.die}`
        const damage = strMod === 0 ? dice : `${dice}${strMod > 0 ? '+' : ''}${strMod}`

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
        }
    })
}
