// Monstro reescalado → combatente do gerenciador de Iniciativa.
//
// Espelha `npcFromCreature` de initiative-tracker/importCharacter.ts, mas com os
// números já ajustados e o nível no nome: numa lista de turnos, "Bugbear
// Tormentor" e "Bugbear Tormentor (N8)" são criaturas diferentes e o GM precisa
// ver qual é qual.

import type { NpcCombatant } from '../initiative-tracker/types'
import type { ScaledMonster } from './types'

export function npcFromScaled(monster: ScaledMonster, index = 0): NpcCombatant {
    const maxHp = Math.max(1, monster.hp)
    const base = `${monster.source.name} (N${monster.level})`
    return {
        id: crypto.randomUUID(),
        kind: 'npc',
        name: index > 0 ? `${base} ${index + 1}` : base,
        level: monster.level,
        initiative: 0,
        ac: monster.ac,
        perception: monster.perception,
        maxHp,
        current: maxHp,
        temp: 0,
        conditions: {},
        delayed: false,
        defeated: false,
        durations: {},
        resistances: monster.resistances,
        weaknesses: monster.weaknesses,
        immunities: monster.source.immunities,
        defenseNotes: monster.source.defenseNotes,
        traits: monster.source.traits,
        aonUrl: monster.source.url,
    }
}
