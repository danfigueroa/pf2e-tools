import type { BuildInfo } from '../character-sheet/types'
import { charSlugFromName } from '../character-viewer/charId'
import { totalHp } from '../character-viewer/helpers'
import { perceptionCheck } from '../character-viewer/checks'
import { NO_MODIFIERS } from '../character-viewer/conditions'
import { parseResistanceStrings } from './defenses'
import type { AonCreature } from '../../services/creatures'
import type { NpcCombatant, NpcShield, PcCombatant } from './types'
import { shieldItemOf } from '../character-viewer/shield'
import { rageSpec } from '../character-viewer/rage'

/**
 * Deslocamento do personagem para o mapa: o da ficha MAIS os bônus, nunca
 * menos. O `speedBonus` do Pathbuilder embute a penalidade da armadura pesada,
 * e na mesa ela não vale para quem tem como anulá-la — o Ghan Buri exporta
 * `speed 25` e `speedBonus −10` (Hero's Plate) e anda os 25 pés dele
 * (decisão do usuário). Os bônus positivos (Fleet, a velocidade do bárbaro)
 * continuam somando.
 */
export function pcSpeed(build: BuildInfo): number {
    return build.attributes.speed + Math.max(0, build.attributes.speedBonus || 0)
}

/**
 * Deslocamento de uma criatura da AON: o terrestre; sem ele (quem só voa,
 * como o Will-o'-Wisp), o maior que ela tiver.
 */
export function creatureSpeed(speed: Record<string, number> | undefined): number | undefined {
    if (!speed) return undefined
    const value = speed.land ?? speed.max ?? Math.max(0, ...Object.values(speed))
    return value > 0 ? value : undefined
}

/**
 * Ficha → combatente. Guarda só o que o encontro precisa: o `BuildInfo`
 * inteiro no `localStorage` seria uma segunda cópia da ficha, capaz de
 * divergir da real. O vínculo com o estado da mesa é o slug, que sai apenas do
 * nome — então um level-up e um novo import não órfãvam PV nem condições.
 */
export function pcFromBuild(
    build: BuildInfo,
    preset?: { filename: string; klass: string; name: string },
): PcCombatant {
    const { values, notes } = parseResistanceStrings(build.resistances ?? [])

    return {
        id: crypto.randomUUID(),
        kind: 'pc',
        // O preset tem o nome curto ("Ceros"), que cabe no cartão; o slug continua
        // saindo do nome da ficha, senão o combatente não acharia o estado da mesa.
        name: preset?.name ?? build.name,
        slug: charSlugFromName(build.name),
        // A ficha do Pathbuilder traz a classe em inglês; o preset já tem o rótulo pt-BR.
        klass: preset?.klass ?? build.class,
        level: build.level,
        initiative: 0,
        ac: build.acTotal?.acTotal ?? 10,
        // Mesmo número da Ficha Virtual, bônus de item incluído (sem condições:
        // as do combatente são aplicadas no cartão).
        perception: perceptionCheck(build, NO_MODIFIERS).total,
        baseMaxHp: totalHp({
            ancestryHp: build.attributes.ancestryhp,
            classHp: build.attributes.classhp,
            bonusHp: build.attributes.bonushp,
            bonusHpPerLevel: build.attributes.bonushpPerLevel,
            level: build.level,
            conScore: build.abilities.con,
        }),
        delayed: false,
        defeated: false,
        durations: {},
        // O Pathbuilder praticamente não exporta resistência (as fichas de
        // exemplo vêm com a lista vazia), então isto é uma semente editável.
        resistances: values,
        weaknesses: {},
        immunities: [],
        defenseNotes: notes,
        presetFile: preset?.filename,
        shieldItem: shieldItemOf(build) ?? undefined,
        rage: rageSpec(build) ?? undefined,
        size: build.sizeName || undefined,
        speed: pcSpeed(build),
    }
}

/** Criatura da AON → combatente. `index` numera as cópias ("Goblin Warrior 2"). */
export function npcFromCreature(creature: AonCreature, index = 0): NpcCombatant {
    const maxHp = Math.max(1, creature.hp)
    return {
        id: crypto.randomUUID(),
        kind: 'npc',
        name: index > 0 ? `${creature.name} ${index + 1}` : creature.name,
        aonName: creature.name,
        level: creature.level,
        initiative: 0,
        ac: creature.ac,
        perception: creature.perception,
        maxHp,
        current: maxHp,
        temp: 0,
        conditions: {},
        delayed: false,
        defeated: false,
        durations: {},
        resistances: creature.resistances,
        weaknesses: creature.weaknesses,
        immunities: creature.immunities,
        defenseNotes: creature.defenseNotes,
        traits: creature.traits,
        aonUrl: creature.url,
        shield: creature.shield ? npcShieldFrom(creature.shield) : undefined,
        size: creature.size ?? undefined,
        speed: creatureSpeed(creature.speed),
    }
}

/** O escudo lido do texto da AON, inteiro e abaixado. */
export function npcShieldFrom(s: NonNullable<AonCreature['shield']>, name = 'Escudo'): NpcShield {
    return {
        name,
        bonus: s.bonus,
        hardness: s.hardness,
        maxHp: s.hp,
        bt: s.bt,
        canBlock: s.block,
        hp: s.hp,
        raised: false,
    }
}

/** Monstro digitado à mão. */
export function npcFromManual(input: {
    name: string
    maxHp: number
    ac: number
    level: number
    initiative: number
    perception?: number
    /** Em inglês, como a AON manda ("Large") — vira a pegada do token no mapa. */
    size?: string
}): NpcCombatant {
    const maxHp = Math.max(1, Math.floor(input.maxHp))
    return {
        id: crypto.randomUUID(),
        kind: 'npc',
        name: input.name.trim() || 'Monstro',
        level: input.level,
        initiative: input.initiative,
        ac: input.ac,
        perception: input.perception,
        maxHp,
        current: maxHp,
        temp: 0,
        conditions: {},
        delayed: false,
        defeated: false,
        durations: {},
        resistances: {},
        weaknesses: {},
        immunities: [],
        defenseNotes: [],
        size: input.size,
    }
}

/**
 * Nome pelo qual buscar a ficha completa deste monstro na AON.
 *
 * Encontro salvo antes do campo `aonName` não tem o nome de origem gravado, e
 * a URL da AON não o carrega — então ele é reconstruído desfazendo os DOIS
 * sufixos que o próprio app acrescenta: a marca de nível do escalar monstro
 * ("Bugbear Tormentor (N8)") e a numeração de cópia ("Goblin Warrior 2"), nessa
 * ordem, porque as duas se acumulam.
 *
 * Exige `aonUrl`: sem ele o combatente foi digitado à mão e não há ficha que
 * buscar — melhor não oferecer o botão do que oferecer um que sempre falha.
 *
 * @returns o nome, ou `null` quando o combatente não veio da AON.
 */
export function aonNameOf(npc: NpcCombatant): string | null {
    if (npc.aonName) return npc.aonName
    if (!npc.aonUrl) return null
    const stripped = npc.name
        .replace(/\s+\d+$/, '')
        .replace(/\s*\(N-?\d+\)$/i, '')
        .trim()
    return stripped || null
}
