/**
 * Runas **homebrew** — inventadas na mesa, sem entrada na AON.
 *
 * O Pathbuilder não sabe delas, e editar o JSON da ficha à mão seria perdido no
 * próximo export (ou na próxima publicação). Por isso o catálogo casa **pelo
 * nome do personagem** e pelo tipo de item (mesma ideia de `magicWeapons.ts` e
 * `combatGuides.ts`): a runa continua na ficha qualquer que seja a versão.
 *
 * Nomes de item e de magia ficam canônicos em inglês (é a chave de busca na
 * AON); a prosa é pt-BR.
 */
import type { Armor, BuildInfo, Weapon } from '../character-sheet/types'
import type { SizeEffectId } from './sizeEffects'

/** Uma ativação da runa: o que ela faz e quais magias ela imita. */
export interface RuneActivation {
    name: string
    /** Símbolo de ação, no formato de `actionSymbol` ("1", "2", "reaction"…). */
    actions: string
    traits: string[]
    frequency?: string
    effect: string
    /**
     * Mudanças de tamanho que a ativação liga (`sizeEffects.ts`): viram botões
     * que aplicam os números na ficha, na Iniciativa e no token do mapa.
     */
    sizeEffects?: SizeEffectId[]
}

export interface CustomRune {
    name: string
    level: number
    traits: string[]
    source: string
    price: string
    usage: string
    description: string
    activations: RuneActivation[]
    /** O que é regra mas depende do GM — vira nota, nunca número. */
    notes?: string[]
}

interface CustomRuneEntry {
    character: (build: BuildInfo) => boolean
    /** Onde a runa está gravada: a armadura vestida ou a arma de nome `weapon`. */
    on: { kind: 'armor' } | { kind: 'weapon'; weapon: string }
    /** Runa da AON que esta substitui na ficha (deixa de aparecer). */
    replaces?: string
    rune: CustomRune
}

export const nameStarts = (prefix: string) => (b: BuildInfo) =>
    (b.name || '').trim().toLowerCase().startsWith(prefix)

const CUSTOM_RUNES: CustomRuneEntry[] = [
    {
        // O Pathbuilder exporta "Brukuthur, The Barbarian Android".
        character: nameStarts('brukuthur'),
        on: { kind: 'armor' },
        // A Size-Changing da ficha é a runa que esta reengenharia substituiu.
        replaces: 'Size-Changing',
        rune: {
            name: "Brukuthur's Size-Changing",
            level: 11,
            traits: ['Incomum', 'Mágico'],
            source: 'Invenção própria (homebrew)',
            price: '1.400 po',
            usage: 'gravada em armadura; Volume —',
            description:
                'Esta armadura tem matrizes arcanas reforçadas e circuitos de autômato '
                + 'superdimensionados que permitem a ela e a quem a veste mudar drasticamente de '
                + 'tamanho. Graças à engenharia única, os condutos mágicos são disparados por '
                + 'interruptores mecânicos na própria armadura, dispensando o foco mental.',
            activations: [
                {
                    name: 'Mudar de Tamanho',
                    actions: '1',
                    traits: ['manipular'],
                    frequency: '1× por dia',
                    effect:
                        'A armadura altera o seu chassi e gera um efeito mecânico estritamente '
                        + 'igual a uma Enlarge de 4º rank ou a uma Shrink em você.',
                    sizeEffects: ['enlarge', 'shrink'],
                },
            ],
            notes: [
                'Sem traço de concentração: os interruptores dispensam o foco mental, então a '
                + 'ativação não depende de você conseguir se concentrar.',
                'Enlarge e Giant\'s Stature são polimorfia. Se os dois valem juntos (e qual '
                + 'tamanho resulta) é decisão do GM — a ficha não soma um ao outro.',
            ],
        },
    },
]

function entriesFor(build: BuildInfo) {
    return CUSTOM_RUNES.filter((e) => e.character(build))
}

/** A armadura que a runa "na armadura" ocupa: a vestida, senão a primeira. */
function runeArmor(build: BuildInfo): Armor | undefined {
    const armor = build.armor ?? []
    return armor.find((a) => a.worn) ?? armor[0]
}

function matches(build: BuildInfo, entry: CustomRuneEntry, item: Armor | Weapon, kind: 'armor' | 'weapon') {
    if (entry.on.kind !== kind) return false
    if (entry.on.kind === 'weapon') {
        return item.name.trim().toLowerCase() === entry.on.weapon.trim().toLowerCase()
    }
    return runeArmor(build) === item
}

/** Runas homebrew gravadas neste item. */
export function customRunesOf(build: BuildInfo, item: Armor | Weapon, kind: 'armor' | 'weapon'): CustomRune[] {
    return entriesFor(build).filter((e) => matches(build, e, item, kind)).map((e) => e.rune)
}

/** As runas do item como a mesa as vê: a substituída sai, a homebrew entra. */
export function itemRuneNames(build: BuildInfo, item: Armor | Weapon, kind: 'armor' | 'weapon'): string[] {
    const entries = entriesFor(build).filter((e) => matches(build, e, item, kind))
    const replaced = new Set(entries.map((e) => e.replaces?.toLowerCase()).filter(Boolean))
    const kept = (item.runes ?? []).filter((r) => !replaced.has(r.toLowerCase()))
    return [...kept, ...entries.map((e) => e.rune.name)]
}

/**
 * O nome de exibição do Pathbuilder ("+1 Armor Resilient Size-Changing Studded
 * Leather") com a runa substituída trocada pela homebrew.
 */
export function itemDisplayName(build: BuildInfo, item: Armor | Weapon, kind: 'armor' | 'weapon'): string {
    const label = item.display || item.name
    let out = label
    for (const e of entriesFor(build)) {
        if (!e.replaces || !matches(build, e, item, kind)) continue
        out = out.replace(new RegExp(`\\b${escapeRegExp(e.replaces)}\\b`, 'i'), e.rune.name)
    }
    return out
}

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
