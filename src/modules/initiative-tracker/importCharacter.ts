import type { BuildInfo } from '../character-sheet/types'
import { charSlugFromName } from '../character-viewer/charId'
import { abilityMod, totalHp } from '../character-viewer/helpers'
import { parseResistanceStrings } from './defenses'
import type { AonCreature } from '../../services/creatures'
import type { NpcCombatant, PcCombatant } from './types'

/**
 * Ficha → combatente. Guarda só o que o encontro precisa: o `BuildInfo`
 * inteiro no `localStorage` seria uma segunda cópia da ficha, capaz de
 * divergir da real. O vínculo com o estado da mesa é o slug, que sai apenas do
 * nome — então um level-up e um novo import não órfãvam PV nem condições.
 */
export function pcFromBuild(
    build: BuildInfo,
    preset?: { filename: string; klass: string },
): PcCombatant {
    const { values, notes } = parseResistanceStrings(build.resistances ?? [])

    return {
        id: crypto.randomUUID(),
        kind: 'pc',
        name: build.name,
        slug: charSlugFromName(build.name),
        // A ficha do Pathbuilder traz a classe em inglês; o preset já tem o rótulo pt-BR.
        klass: preset?.klass ?? build.class,
        level: build.level,
        initiative: 0,
        ac: build.acTotal?.acTotal ?? 10,
        perception: build.level + build.proficiencies.perception + abilityMod(build.abilities.wis),
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
    }
}

/** Criatura da AON → combatente. `index` numera as cópias ("Goblin Warrior 2"). */
export function npcFromCreature(creature: AonCreature, index = 0): NpcCombatant {
    const maxHp = Math.max(1, creature.hp)
    return {
        id: crypto.randomUUID(),
        kind: 'npc',
        name: index > 0 ? `${creature.name} ${index + 1}` : creature.name,
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
    }
}
