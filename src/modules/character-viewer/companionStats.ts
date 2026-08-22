// Cálculo determinístico da ficha de um companheiro animal.
//
// O backend (api/_lib/companion-core.js) entrega a base CANÔNICA do companheiro
// jovem, direto dos campos estruturados do AON. Aqui aplicamos o que depende da
// ficha do personagem: o nível e as evoluções (mature / nimble / savage).
// Nenhum número vem de IA — as regras abaixo são RAW e citadas nos comentários.
//
// Regras (Player Core, "Animal Companions", p. 206-211):
// - Young: nível igual ao seu; trained em ataques desarmados, defesa sem
//   armadura, barding, TODOS os salvamentos, Percepção, Acrobacia e Atletismo.
//   PV = PV de ancestralidade do tipo + (6 + mod Con) por nível.
//   Companheiros calculam modificadores como um PC (nível + proficiência + atributo).
// - Mature: cresce um tamanho (se Médio ou menor); +1 Str/Dex/Con/Wis;
//   Percepção e salvamentos → perito; Intimidação/Furtividade/Sobrevivência →
//   treinado (perito se o tipo já dava treinado); dano de 1 dado passa a 2 dados.
// - Nimble: +2 Dex, +1 Str/Con/Wis; Acrobacia → perito; +2 de dano; ataques mágicos.
// - Savage: cresce um tamanho (se Médio ou menor); +2 Str, +1 Dex/Con/Wis;
//   Atletismo → perito; +3 de dano; ataques mágicos.
//   (Só o savage cresce de tamanho nesta etapa — o nimble não.)

import type { CompanionStats, Pet } from '../character-sheet/types'

// Ranks de proficiência: o bônus é 2 × rank, e só soma o nível se proficiente.
export const UNTRAINED = 0
export const TRAINED = 1
export const EXPERT = 2

export type Rank = 0 | 1 | 2 | 3 | 4

function profBonus(rank: Rank, level: number): number {
    return rank > 0 ? level + rank * 2 : 0
}

const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

// "If your companion is Medium or smaller, it grows by one size."
function growSize(size: string): string {
    const i = SIZE_ORDER.indexOf(size)
    if (i < 0 || i > SIZE_ORDER.indexOf('Medium')) return size
    return SIZE_ORDER[i + 1]
}

// Barding usa as mesmas regras de armadura. Valores da tabela de Barding; o
// Pathbuilder só informa o tipo, sem runas, então o bônus de item é o base.
const BARDING = {
    light: { ac: 1, dexCap: 3, checkPenalty: -1 },
    heavy: { ac: 2, dexCap: 2, checkPenalty: -2 },
}

function bardingOf(armor?: string) {
    if (!armor || !/barding/i.test(armor)) return null
    return /heavy/i.test(armor) ? { ...BARDING.heavy, kind: 'heavy' } : { ...BARDING.light, kind: 'light' }
}

export interface ComputedAttack {
    name: string
    category: string
    actions: string
    traits: string[]
    attack: number
    damage: string        // "2d8+9"
    damageType: string    // canônico EN
    magical: boolean
}

export interface ComputedSkill {
    name: string          // canônico EN
    rank: Rank
    modifier: number
}

export interface ComputedCompanion {
    /** "Young" | "Mature" | "Nimble" | "Savage" — estágio alcançado */
    stage: string
    level: number
    size: string          // canônico EN
    speed: number
    speeds: Record<string, number>
    hp: number
    ac: number
    abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
    perception: { rank: Rank; modifier: number }
    saves: { fortitude: ComputedSkill; reflex: ComputedSkill; will: ComputedSkill }
    skills: ComputedSkill[]
    attacks: ComputedAttack[]
    senses: string
    supportBenefit: string
    advancedManeuver: string | null
    /** Manobra avançada só é aprendida ao virar nimble/savage. */
    hasAdvancedManeuver: boolean
    barding: { kind: string; ac: number; dexCap: number; checkPenalty: number } | null
    summary: string
    sourceBook?: string
}

// Perícias em pt-BR (o vocabulário mecânico chega canônico em inglês do AON).
const SKILL_LABELS: Record<string, string> = {
    Acrobatics: 'Acrobacia', Arcana: 'Arcanismo', Athletics: 'Atletismo',
    Crafting: 'Ofício', Deception: 'Engano', Diplomacy: 'Diplomacia',
    Intimidation: 'Intimidação', Medicine: 'Medicina', Nature: 'Natureza',
    Occultism: 'Ocultismo', Performance: 'Performance', Religion: 'Religião',
    Society: 'Sociedade', Stealth: 'Furtividade', Survival: 'Sobrevivência',
    Thievery: 'Roubo', Lore: 'Saber',
    Fortitude: 'Fortitude', Reflex: 'Reflexos', Will: 'Vontade',
}

export function translateSkill(name: string): string {
    return SKILL_LABELS[name] ?? name
}

// Sentidos chegam como texto livre do AON ("low-light vision, scent (imprecise,
// 30 feet)"). Tradução por expressão, do mais específico para o mais genérico.
const SENSE_PATTERNS: Array<[RegExp, string]> = [
    [/\blow-light vision\b/gi, 'visão em penumbra'],
    [/\bgreater darkvision\b/gi, 'visão no escuro superior'],
    [/\bdarkvision\b/gi, 'visão no escuro'],
    [/\bscent\b/gi, 'olfato'],
    [/\btremorsense\b/gi, 'sentir vibração'],
    [/\becholocation\b/gi, 'ecolocalização'],
    [/\bwavesense\b/gi, 'sentir ondas'],
    [/\bimprecise\b/gi, 'impreciso'],
    [/\bprecise\b/gi, 'preciso'],
    [/\bvague\b/gi, 'vago'],
    [/(\d+)\s*feet\b/gi, '$1 pés'],
]

export function translateSenses(text: string): string {
    return SENSE_PATTERNS.reduce((acc, [re, pt]) => acc.replace(re, pt), String(text || ''))
}

const RANK_LABELS = ['Destreinado', 'Treinado', 'Perito', 'Mestre', 'Lendário']

export function rankLabel(rank: Rank): string {
    return RANK_LABELS[rank] ?? RANK_LABELS[0]
}

// Rótulo do estágio para exibição.
const STAGE_LABELS: Record<string, string> = {
    Young: 'Jovem', Mature: 'Maduro', Nimble: 'Ágil (Nimble)', Savage: 'Selvagem (Savage)',
}

export function stageLabel(stage: string): string {
    return STAGE_LABELS[stage] ?? stage
}

const SKILL_ABILITY: Record<string, keyof ComputedCompanion['abilities']> = {
    Acrobatics: 'dex', Athletics: 'str', Stealth: 'dex', Survival: 'wis',
    Intimidation: 'cha', Nature: 'wis', Perception: 'wis', Medicine: 'wis',
    Deception: 'cha', Diplomacy: 'cha', Performance: 'cha', Religion: 'wis',
    Arcana: 'int', Crafting: 'int', Occultism: 'int', Society: 'int',
    Thievery: 'dex', Lore: 'int',
}

export function computeCompanion(
    base: CompanionStats,
    pet: Pet,
    level: number,
): ComputedCompanion {
    const abilities = { ...base.abilities }
    let size = base.size
    let diceCount = 1
    let bonusDamage = 0
    let magical = false

    // Young: proficiências iniciais.
    const ranks: Record<string, Rank> = {
        Acrobatics: TRAINED,
        Athletics: TRAINED,
    }
    for (const s of base.skills || []) ranks[s] = TRAINED
    let perceptionRank: Rank = TRAINED
    let saveRank: Rank = TRAINED
    const defenseRank: Rank = TRAINED   // sem armadura e barding

    const incredibleType = (pet.incredibleType || '').toLowerCase()
    // Um companheiro incrível já passou por mature, mesmo que a ficha só marque
    // o estágio final.
    const isMature = Boolean(pet.mature || pet.incredible)
    const isNimble = Boolean(pet.incredible) && incredibleType.includes('nimble')
    const isSavage = Boolean(pet.incredible) && incredibleType.includes('savage')

    if (isMature) {
        size = growSize(size)
        abilities.str += 1
        abilities.dex += 1
        abilities.con += 1
        abilities.wis += 1
        perceptionRank = EXPERT
        saveRank = EXPERT
        // Trained nas três; perito se o tipo já dava trained.
        for (const s of ['Intimidation', 'Stealth', 'Survival']) {
            ranks[s] = ranks[s] === TRAINED ? EXPERT : TRAINED
        }
        diceCount = 2
    }

    if (isNimble) {
        abilities.dex += 2
        abilities.str += 1
        abilities.con += 1
        abilities.wis += 1
        ranks.Acrobatics = EXPERT
        bonusDamage = 2
        magical = true
    } else if (isSavage) {
        size = growSize(size)
        abilities.str += 2
        abilities.dex += 1
        abilities.con += 1
        abilities.wis += 1
        ranks.Athletics = EXPERT
        bonusDamage = 3
        magical = true
    }

    const stage = isSavage ? 'Savage' : isNimble ? 'Nimble' : isMature ? 'Mature' : 'Young'

    // PV = ancestralidade + (6 + Con) por nível.
    const hp = base.ancestryHp + (6 + abilities.con) * level

    // CA: barding limita a Dex aplicável e dá bônus de item (máx +3 para
    // companheiros, que aqui nunca é atingido porque não há runas no Pathbuilder).
    const barding = bardingOf(pet.armor)
    const dexForAc = barding ? Math.min(abilities.dex, barding.dexCap) : abilities.dex
    const ac = 10 + dexForAc + profBonus(defenseRank, level) + (barding?.ac ?? 0)

    const mkSkill = (name: string, rank: Rank, ability: number): ComputedSkill => ({
        name, rank, modifier: profBonus(rank, level) + ability,
    })

    const skills = Object.entries(ranks)
        .map(([name, rank]) => mkSkill(name, rank, abilities[SKILL_ABILITY[name] ?? 'str']))
        .sort((a, b) => a.name.localeCompare(b.name))

    const attacks: ComputedAttack[] = (base.attacks || []).map((a) => {
        // Finesse permite usar Dex no ataque; o dano continua usando Força.
        const finesse = a.traits.some((t) => /finesse/i.test(t))
        const attackAbility = finesse ? Math.max(abilities.str, abilities.dex) : abilities.str
        const die = a.damageDice.replace(/^\d+/, '')     // "1d8" → "d8"
        const dmgBonus = abilities.str + bonusDamage
        return {
            name: a.name,
            category: a.category,
            actions: a.actions,
            traits: a.traits,
            attack: profBonus(TRAINED, level) + attackAbility,
            damage: `${diceCount}${die}${dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : dmgBonus) : ''}`,
            damageType: a.damageType,
            magical,
        }
    })

    return {
        stage,
        level,
        size,
        speed: base.speed,
        speeds: base.speeds || {},
        hp,
        ac,
        abilities,
        perception: { rank: perceptionRank, modifier: profBonus(perceptionRank, level) + abilities.wis },
        saves: {
            fortitude: mkSkill('Fortitude', saveRank, abilities.con),
            reflex: mkSkill('Reflex', saveRank, abilities.dex),
            will: mkSkill('Will', saveRank, abilities.wis),
        },
        skills,
        attacks,
        senses: base.senses,
        supportBenefit: base.supportBenefit,
        advancedManeuver: base.advancedManeuver,
        hasAdvancedManeuver: isNimble || isSavage,
        barding,
        summary: base.summary,
        sourceBook: base.sourceBook,
    }
}
